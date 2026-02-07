import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs/promises';
import { load } from 'cheerio';
import { runNotifierOnce, startPeriodic } from './notifier';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import rateLimit from 'express-rate-limit';
import { body, query, validationResult } from 'express-validator';
import { Product, Subscription } from './types';
import { isValidUrl, randomDelay } from './utils';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const app = express();

// CORS middleware - allow requests from any origin (for development)
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Static public files (assets, demo, embed)
const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', '..', 'build');
app.use('/assets', express.static(path.join(publicDir, 'assets'), { maxAge: '1d' }));
app.use('/build', express.static(buildDir, { maxAge: '1d' }));
app.use('/demo', express.static(path.join(publicDir, 'demo')));
app.use('/embed', express.static(path.join(publicDir, 'embed')));

const DATA_FILE = path.join(__dirname, '..', 'data', 'subscriptions.json');

async function readData() {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return [] as any[];
    }
}

async function writeData(data: any[]) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const subscribeValidators = [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('product.url').isURL().withMessage('Invalid product URL'),
    body('product.name').optional().isString().trim().escape(),
    body('product.price').optional().isString().trim().escape(),
];

type SubscribeRequestBody = {
    email: string;
    product: Product;
};

app.post('/subscribe-price-drop', subscribeValidators, async (req: express.Request, res: express.Response) => {
    const start: number = Date.now();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const latency = Date.now() - start;
        console.log('POST /subscribe-price-drop 400', latency + 'ms');
        return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const body = req.body as SubscribeRequestBody;
    const email: string = body.email;
    const product: Product = body.product;

    // Additional URL validation
    if (!isValidUrl(product.url)) {
        const latency = Date.now() - start;
        console.log('POST /subscribe-price-drop 400', latency + 'ms');
        return res.status(400).json({ ok: false, error: 'Invalid product URL format' });
    }

    await new Promise((r) => setTimeout(r, randomDelay()));

    try {
        const data = (await readData()) as Subscription[];
        const exists = data.find((s: Subscription) => s.product?.url === product.url && s.email === email);
        if (exists) {
            const latency = Date.now() - start;
            console.log('POST /subscribe-price-drop 409', latency + 'ms');
            return res.status(409).json({ ok: false, error: 'already_subscribed' });
        }

        // simulate occasional server error
        if (Math.random() < 0.08) {
            const latency = Date.now() - start;
            console.log('POST /subscribe-price-drop 500', latency + 'ms');
            return res.status(500).json({ ok: false, error: 'server_error' });
        }

        data.push({ email, product, createdAt: new Date().toISOString() });
        await writeData(data);

        const latency = Date.now() - start;
        console.log('POST /subscribe-price-drop 200', latency + 'ms');
        return res.json({ ok: true });
    } catch (err) {
        const latency = Date.now() - start;
        console.log('POST /subscribe-price-drop 500', latency + 'ms');
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

// admin trigger endpoint to run notifier manually
app.post('/admin/trigger-notify', async (req, res) => {
    try {
        const result = await runNotifierOnce();
        return res.json({ ok: true, result });
    } catch (e) {
        console.error('trigger-notify error', e);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
});

const extractValidators = [
    body('url').isURL().withMessage('Invalid URL'),
];

// API: extract product info from a URL (server-side fetch + cheerio, Playwright fallback)
interface ExtractedProduct {
    name: string;
    price: string;
    url: string;
    [key: string]: any;
}

type PlaywrightModule = typeof import('playwright');

app.post('/api/extract', extractValidators, async (req: express.Request, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const url = req.body.url as string;

    // Additional URL validation
    if (!isValidUrl(url)) {
        return res.status(400).json({ ok: false, error: 'Invalid URL format' });
    }

    async function extractFromHtml(html: string): Promise<ExtractedProduct> {
        const $ = load(html);

        // Title extraction - Amazon and eBay specific
        const ogTitle = ($('meta[property="og:title"]').attr('content') || $('meta[name="og:title"]').attr('content')) as string | undefined;
        const titleTag = $('title').text().trim();
        const h1 = $('h1').first().text().trim();
        const h2 = $('h2').first().text().trim();

        // Amazon specific
        const amazonTitle = $('#productTitle').text().trim();

        // eBay specific
        const ebayTitle = $('.x-item-title__mainTitle').text().trim() ||
            $('#itemTitle').text().trim() ||
            $('.it-ttl').text().trim();

        const name = (amazonTitle || ebayTitle || ogTitle || titleTag || h1 || h2 || '').replace(/\s+/g, ' ').trim();

        // Price selectors - Amazon and eBay
        const selectors: string[] = [
            // General meta tags
            'meta[property="product:price:amount"]',
            '[itemprop=price]',

            // Amazon specific - prioritize main product price containers
            '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
            '#corePrice_desktop .a-price .a-offscreen',
            '.priceToPay .a-offscreen',
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '.a-price .a-offscreen',

            // eBay specific
            '.x-price-primary .ux-textspans',
            '.x-price-primary',
            '#prcIsum',
            '#mm-saleDscPrc',
            '.display-price',
            '.notranslate',
            '.ui-display-price',

            // Generic
            '[data-price]',
            '.price'
        ];

        let price: string = '';
        for (const sel of selectors) {
            const el = $(sel).first(); // Take only the first match
            if (el && el.length) {
                const v = el.attr('content') || el.text();
                if (v && v.trim()) {
                    price = v.trim();
                    break;
                }
            }
        }

        if (!price) {
            const text = $.root().text();
            const m: RegExpMatchArray | null = text.match(/[$£€]\s?[0-9,]+\.?[0-9]{0,2}/) || text.match(/[0-9][0-9,]+\.?[0-9]{0,2}\s?(USD|EUR|GBP|EGP)?/i);
            price = m ? m[0].trim() : 'unknown';
        }

        return { name: name || url, price: price || 'unknown', url };
    }

    try {
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        const html: string = await resp.text();
        let result: ExtractedProduct = await extractFromHtml(html);

        if ((result.price === 'unknown' || !result.name || result.name === url)) {
            try {
                const pw: PlaywrightModule = await import('playwright');
                const browser = await pw.chromium.launch({ headless: true });
                const page = await browser.newPage();
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                const content: string = await page.content();
                await browser.close();
                const fallback: ExtractedProduct = await extractFromHtml(content);
                if (fallback.price && fallback.price !== 'unknown') result = fallback;
            } catch (e) {
                console.warn('playwright fallback failed', e);
            }
        }

        return res.json({ ok: true, product: result });
    } catch (e) {
        console.error('api/extract error', e);
        return res.status(500).json({ ok: false, error: 'fetch_failed' });
    }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // In production, you might want to exit, but for dev, log and continue
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
    console.log(`Price Drop Notifier server running on http://localhost:${PORT}`);
    // start notifier periodic checks (15 minutes default)
    try {
        startPeriodic();
    } catch (e) {
        console.warn('Failed to start notifier', e);
    }
});
