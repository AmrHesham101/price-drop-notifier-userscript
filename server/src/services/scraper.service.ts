/**
 * Scraper service
 *
 * Responsible for fetching product pages and extracting a small product
 * representation (name, price, url). Uses Cheerio for fast HTML parsing
 * and falls back to Puppeteer (with stealth plugin) when client-side rendering is required.
 */
import { load } from 'cheerio';
import { USER_AGENT, PLAYWRIGHT_TIMEOUT } from '../config/constants';
import { isValidUrl } from '../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find Chrome executable in project directory
function findChromeExecutable(): string | undefined {
    // Check environment variable first
    if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // Check project chrome directory
    const projectRoot = join(__dirname, '..', '..', '..');
    const chromePatterns = [
        'chrome/win64-*/chrome-win64/chrome.exe',  // Windows
        'chrome/mac-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium',  // Mac
        'chrome/linux-*/chrome-linux/chrome',  // Linux
    ];

    // For Windows, manually check the pattern
    const chromeDir = join(projectRoot, 'chrome');
    if (existsSync(chromeDir)) {
        const fs = require('fs');
        const versions = fs.readdirSync(chromeDir).filter((f: string) => f.startsWith('win64-'));
        if (versions.length > 0) {
            const chromePath = join(chromeDir, versions[0], 'chrome-win64', 'chrome.exe');
            if (existsSync(chromePath)) {
                console.log('✅ Found Chrome at:', chromePath);
                return chromePath;
            }
        }
    }

    // Fallback to system Chrome
    console.log('⚠️ Chrome not found in project directory, will use system Chrome');
    return undefined;
}

export interface ScrapedProduct {
    name: string;
    price: string;
    url: string;
}

const PRICE_SELECTORS = [
    // Meta tags (check first as they're most reliable)
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    '[itemprop=price]',

    // Amazon specific (2024+ selectors)
    '.a-price[data-a-size="xl"] .a-offscreen',
    '.a-price[data-a-size="large"] .a-offscreen',
    'span.a-price.aok-align-center span.a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_desktop .a-price .a-offscreen',
    '.priceToPay .a-offscreen',
    '.a-section.a-spacing-none.aok-align-center .a-price .a-offscreen',
    '.a-price-whole',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price .a-offscreen',
    '#price_inside_buybox',
    '#priceblock_saleprice',

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
    '.price',
];

export async function extractFromHtml(html: string, url: string): Promise<ScrapedProduct> {
    const $ = load(html);

    // Title extraction (try opengraph, title tag, h1/h2, then platform-specific selectors)
    const ogTitle = ($('meta[property="og:title"]').attr('content') ||
        $('meta[name="og:title"]').attr('content')) as string | undefined;
    const titleTag = $('title').text().trim();
    const h1 = $('h1').first().text().trim();
    const h2 = $('h2').first().text().trim();

    // Amazon specific
    const amazonTitle = $('#productTitle').text().trim();
    if (amazonTitle) {
        console.log('✅ Found Amazon product title:', amazonTitle.substring(0, 60) + '...');
    }

    // eBay specific
    const ebayTitle = $('.x-item-title__mainTitle').text().trim() ||
        $('#itemTitle').text().trim() ||
        $('.it-ttl').text().trim();

    const name = (amazonTitle || ebayTitle || ogTitle || titleTag || h1 || h2 || '')
        .replace(/\s+/g, ' ')
        .trim() || url;

    console.log('📝 Title extraction sources:', {
        amazonTitle: amazonTitle ? amazonTitle.substring(0, 40) + '...' : 'none',
        ebayTitle: ebayTitle ? ebayTitle.substring(0, 40) + '...' : 'none',
        ogTitle: ogTitle ? ogTitle.substring(0, 40) + '...' : 'none',
        titleTag: titleTag ? titleTag.substring(0, 40) + '...' : 'none',
        selected: name.substring(0, 40) + '...'
    });

    // Price extraction using prioritized selectors.
    let price = '';
    let matchedSelector = '';
    for (const sel of PRICE_SELECTORS) {
        const el = $(sel).first();
        if (el && el.length) {
            const v = el.attr('content') || el.text();
            if (v && v.trim()) {
                price = v.trim();
                matchedSelector = sel;
                break;
            }
        }
    }

    if (price && matchedSelector) {
        console.log(`💰 Price extracted via selector: "${matchedSelector}" => "${price}"`);
    }

    // Fallback: attempt to find a currency-looking token in the page text
    if (!price) {
        const text = $.root().text();
        const m = text.match(/[$£€]\s?[0-9,]+\.?[0-9]{0,2}/) ||
            text.match(/[0-9][0-9,]+\.?[0-9]{0,2}\s?(USD|EUR|GBP|EGP)?/i);
        price = m ? m[0].trim() : 'unknown';
    }

    return {
        name: name || url,
        price: price || 'unknown',
        url,
    };
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
    if (!isValidUrl(url)) {
        throw new Error('Invalid URL format');
    }

    // For Amazon and eBay, skip the initial fetch and go straight to Puppeteer
    // These sites have strong bot detection that makes simple fetch unreliable
    const hostname = new URL(url).hostname.toLowerCase();
    const needsPuppeteerFirst =
        hostname.includes('amazon') ||
        hostname.includes('ebay');

    if (needsPuppeteerFirst) {
        console.log('🎭 Detected Amazon/eBay, using Puppeteer with stealth directly...');
        return await scrapeWithPuppeteer(url);
    }

    try {
        // Try a lightweight server-side fetch first (faster, less resource heavy)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
            },
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
            console.warn(`HTTP ${resp.status} for URL:`, url);
            throw new Error(`HTTP ${resp.status}`);
        }

        const html = await resp.text();
        let result = await extractFromHtml(html, url);

        // Check if extraction looks valid
        const needsPuppeteer = isInvalidExtraction(result, url);

        if (needsPuppeteer) {
            console.log('⚠️ Initial extraction looks invalid, trying Puppeteer fallback...');
            console.log('Initial result:', result);
            result = await scrapeWithPuppeteer(url);
        }

        return result;
    } catch (error) {
        console.error('Scraping error:', error);
        // Try Puppeteer as a last resort
        console.log('⚠️ Fetch failed, trying Puppeteer fallback...');
        return await scrapeWithPuppeteer(url);
    }
}

/**
 * Determine if extracted data looks invalid and needs Puppeteer
 */
function isInvalidExtraction(result: ScrapedProduct, url: string): boolean {
    // Check if name is missing or is just the URL
    if (!result.name || result.name === url) {
        return true;
    }

    // Check if price is unknown or looks invalid
    if (result.price === 'unknown') {
        return true;
    }

    // Check if price is just punctuation or very short
    const priceDigits = result.price.replace(/[^0-9]/g, '');
    if (priceDigits.length === 0 || priceDigits === '0') {
        return true;
    }

    // Check if name is a generic site name (too short or matches common patterns)
    const nameLen = result.name.trim().length;
    if (nameLen < 10) {
        return true;
    }

    // Check for common site names that indicate bad extraction
    const genericNames = [
        'amazon.com', 'amazon', 'ebay.com', 'ebay',
        'shop', 'store', 'buy', 'product',
        'home', 'homepage', 'welcome'
    ];

    const nameLower = result.name.toLowerCase();
    for (const generic of genericNames) {
        if (nameLower === generic || nameLower.includes(generic + ' ') || nameLower.startsWith(generic + ' -')) {
            return true;
        }
    }

    return false;
}

// Enable stealth plugin
puppeteer.use(StealthPlugin());

async function scrapeWithPuppeteer(url: string): Promise<ScrapedProduct> {
    let browser;
    try {
        console.log('🤖 Launching Puppeteer with stealth plugin for:', url);

        const chromePath = findChromeExecutable();
        console.log('🌐 Using Chrome executable:', chromePath || 'system default');

        // Launch browser with stealth mode
        browser = await puppeteer.launch({
            headless: true,
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
            ],
        });

        const page = await browser.newPage();

        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(USER_AGENT);

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        });

        console.log('🌐 Navigating to:', url);

        // Navigate with network idle
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: PLAYWRIGHT_TIMEOUT,
        });

        // Random delay to mimic human behavior (1-3 seconds)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Wait for common price elements to appear
        const priceSelectorsToWait = [
            '.a-price .a-offscreen',
            '#corePriceDisplay_desktop_feature_div',
            '.x-price-primary',
            '[itemprop=price]',
            '.price',
        ];

        for (const selector of priceSelectorsToWait) {
            try {
                await page.waitForSelector(selector, { timeout: 3000, visible: true });
                console.log(`✅ Found price element: ${selector}`);
                break;
            } catch (e) {
                console.log(`⏭️ Selector not found: ${selector}`);
            }
        }

        // Extract data directly from page (same as userscript)
        const extractedData = await page.evaluate(() => {
            // Title extraction
            const amazonTitle = document.querySelector('#productTitle');
            const ebayTitle = document.querySelector('.x-item-title__mainTitle') ||
                document.querySelector('#itemTitle') ||
                document.querySelector('.it-ttl');
            const ogTitle = document.querySelector('meta[property="og:title"]');
            const genericTitle = document.querySelector('h1') || document.querySelector('h2');

            const title = (
                amazonTitle?.textContent ||
                ebayTitle?.textContent ||
                (ogTitle as HTMLMetaElement)?.content ||
                genericTitle?.textContent ||
                document.title
            ).trim();

            // Price extraction with same selectors as userscript
            const priceSelectors = [
                '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
                '#corePrice_desktop .a-price .a-offscreen',
                '.priceToPay .a-offscreen',
                '#priceblock_ourprice',
                '#priceblock_dealprice',
                '.a-price .a-offscreen',
                '.x-price-primary .ux-textspans',
                '.x-price-primary',
                '#prcIsum',
                '.display-price',
                '.notranslate',
                '.price',
            ];

            let price = 'unknown';
            for (const sel of priceSelectors) {
                const priceEl = document.querySelector(sel);
                if (priceEl && priceEl.textContent?.trim()) {
                    price = priceEl.textContent.trim();
                    break;
                }
            }

            return { title, price };
        });

        console.log('📄 Puppeteer extracted from page:', extractedData);

        const result: ScrapedProduct = {
            name: extractedData.title || url,
            price: extractedData.price || 'unknown',
            url,
        };

        console.log('🤖 Final result:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.warn('❌ Puppeteer scraping failed:', error);
        return { name: url, price: 'unknown', url };
    } finally {
        if (browser) {
            await browser.close();
            console.log('🤖 Browser closed');
        }
    }
}

export async function fetchCurrentPrice(url: string): Promise<number | null> {
    if (!isValidUrl(url)) {
        console.warn('Invalid URL format:', url);
        return null;
    }

    // Use Puppeteer for Amazon/eBay for consistency
    const hostname = new URL(url).hostname.toLowerCase();
    const shouldUsePuppeteer =
        hostname.includes('amazon') ||
        hostname.includes('ebay');

    if (shouldUsePuppeteer) {
        try {
            const product = await scrapeWithPuppeteer(url);
            if (product.price && product.price !== 'unknown') {
                const numStr = product.price.replace(/[^0-9.]/g, '');
                const num = parseFloat(numStr);
                return isNaN(num) ? null : num;
            }
            return null;
        } catch (error) {
            console.error('fetchCurrentPrice (Puppeteer) error:', error);
            return null;
        }
    }

    // For other sites, use simple fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
        });

        if (!res.ok) {
            console.warn(`HTTP ${res.status} for URL:`, url);
            return null;
        }

        const html = await res.text();
        const $ = load(html);

        let priceStr = '';
        for (const sel of PRICE_SELECTORS) {
            const el = $(sel).first();
            if (el && el.length) {
                const v = el.attr('content') || el.text();
                if (v && v.trim()) {
                    priceStr = v.trim();
                    break;
                }
            }
        }

        // Fallback regex
        if (!priceStr) {
            const text = $.root().text();
            const m = text.match(/[$£€]\s?[0-9,]+\.?[0-9]{0,2}/) ||
                text.match(/[0-9][0-9,]+\.?[0-9]{0,2}\s?(USD|EUR|GBP|EGP)?/i);
            priceStr = m ? m[0].trim() : '';
        }

        if (!priceStr) return null;

        // Parse price string to a numeric value (strip currency symbols)
        const numStr = priceStr.replace(/[^0-9.]/g, '');
        const num = parseFloat(numStr);
        return isNaN(num) ? null : num;
    } catch (error) {
        console.error('fetchCurrentPrice error:', error);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}
