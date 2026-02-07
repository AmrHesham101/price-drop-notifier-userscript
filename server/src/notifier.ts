import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { load } from 'cheerio';
import { Subscription } from './types';
import { isValidUrl, parsePriceString } from './utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'subscriptions.json');

async function readData(): Promise<Subscription[]> {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf-8');
        return JSON.parse(raw) as Subscription[];
    } catch (e) {
        return [];
    }
}

async function writeData(data: Subscription[]) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function fetchPagePrice(url: string): Promise<number | null> {
    // Validate URL before attempting fetch
    if (!isValidUrl(url)) {
        console.warn('fetchPagePrice: Invalid URL format:', url);
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });
        if (!res.ok) {
            console.warn(`fetchPagePrice: HTTP ${res.status} for URL:`, url);
            return null;
        }
        const html = await res.text();
        const $ = load(html);

        // Price selectors - Amazon and eBay
        const selectors = [
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
            '[data-price]',
            '.price'
        ];

        let priceStr = '';
        for (const sel of selectors) {
            const el = $(sel).first(); // Take only the first match
            if (el && el.length) {
                const v = el.attr('content') || el.text();
                if (v && v.trim()) {
                    priceStr = v.trim();
                    break;
                }
            }
        }

        // Fallback to regex if no selector matched
        if (!priceStr) {
            const text = $.root().text();
            const m = text.match(/[$£€]\s?[0-9,]+\.?[0-9]{0,2}/) || text.match(/[0-9][0-9,]+\.?[0-9]{0,2}\s?(USD|EUR|GBP|EGP)?/i);
            priceStr = m ? m[0].trim() : '';
        }

        return priceStr ? parsePriceString(priceStr) : null;
    } catch (e) {
        console.error('fetchPagePrice error for URL:', url, e);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

let transporter: nodemailer.Transporter | null = null;
let etherealAccountInfo: any = null;

export async function initNotifier() {
    // create ethereal test account and transporter
    try {
        const account = await nodemailer.createTestAccount();
        etherealAccountInfo = account;
        transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: { user: account.user, pass: account.pass },
        });
        console.log('Notifier: Ethereal account created. Preview URL will be logged for sent messages.');
    } catch (e) {
        console.warn('Notifier: failed to create ethereal account, email disabled', e);
        transporter = null;
    }
    // Clean up any invalid subscriptions
    try {
        await cleanupInvalidSubscriptions();
    } catch (e) {
        console.warn('Notifier: failed to cleanup invalid subscriptions', e);
    }
}

export async function runNotifierOnce() {
    const subs = await readData();
    if (!subs.length) return { checked: 0, notified: 0 };
    let notified = 0;
    for (const s of subs) {
        const currentPrice = await fetchPagePrice(s.product.url);
        const claimedPrice = parsePriceString(s.product.price || '') ?? undefined;
        const lastSeen = s.product.lastSeenPrice ?? claimedPrice ?? undefined;
        if (currentPrice == null || lastSeen == null) continue; // can't compare
        if (currentPrice < lastSeen) {
            // send email
            if (transporter) {
                const info = await transporter.sendMail({
                    from: 'Price Drop Notifier <no-reply@example.com>',
                    to: s.email,
                    subject: `Price dropped: ${s.product.name}`,
                    text: `Price for ${s.product.name} dropped from ${lastSeen} to ${currentPrice}. URL: ${s.product.url}`,
                });
                console.log('Notifier: sent email', nodemailer.getTestMessageUrl(info));
            } else {
                console.log(`Notifier: would email ${s.email} about ${s.product.url} (no transporter)`);
            }
            s.product.lastSeenPrice = currentPrice;
            s.lastNotifiedAt = new Date().toISOString();
            notified++;
        } else {
            // update lastSeenPrice to current if available
            if (currentPrice != null) s.product.lastSeenPrice = currentPrice;
        }
    }
    await writeData(subs);
    return { checked: subs.length, notified };
}

export async function cleanupInvalidSubscriptions(): Promise<number> {
    const subs = await readData();
    const validSubs = subs.filter(sub => isValidUrl(sub.product.url));
    const removedCount = subs.length - validSubs.length;

    if (removedCount > 0) {
        await writeData(validSubs);
        console.log(`Notifier: Cleaned up ${removedCount} subscriptions with invalid URLs`);
    }

    return removedCount;
}

export function startPeriodic(intervalMs = 1000 * 60 * 15) {
    // default 15 minutes
    let timer: NodeJS.Timeout | null = null;
    initNotifier().then(() => {
        // run first check shortly after init
        setTimeout(() => runNotifierOnce().catch(console.error), 2000);
        timer = setInterval(() => runNotifierOnce().catch(console.error), intervalMs);
        console.log('Notifier: periodic checks started every', intervalMs / 60000, 'minutes');
    }).catch((e) => console.error('Notifier init failed', e));
    return () => { if (timer) clearInterval(timer); };
}
