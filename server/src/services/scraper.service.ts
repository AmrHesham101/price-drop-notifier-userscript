/**
 * Scraper service
 *
 * Responsible for fetching product pages and extracting a small product
 * representation (name, price, url). Uses Cheerio for fast HTML parsing
 * and falls back to Playwright when client-side rendering is required.
 */
import { load } from 'cheerio';
import { USER_AGENT, PLAYWRIGHT_TIMEOUT } from '../config/constants';
import { isValidUrl } from '../utils';

export interface ScrapedProduct {
    name: string;
    price: string;
    url: string;
}

const PRICE_SELECTORS = [
    // Meta tags
    'meta[property="product:price:amount"]',
    '[itemprop=price]',

    // Amazon specific
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

    // eBay specific
    const ebayTitle = $('.x-item-title__mainTitle').text().trim() ||
        $('#itemTitle').text().trim() ||
        $('.it-ttl').text().trim();

    const name = (amazonTitle || ebayTitle || ogTitle || titleTag || h1 || h2 || '')
        .replace(/\s+/g, ' ')
        .trim() || url;

    // Price extraction using prioritized selectors.
    let price = '';
    for (const sel of PRICE_SELECTORS) {
        const el = $(sel).first();
        if (el && el.length) {
            const v = el.attr('content') || el.text();
            if (v && v.trim()) {
                price = v.trim();
                break;
            }
        }
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

    try {
        // Try a lightweight server-side fetch first (faster, less resource heavy)
        const resp = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
        });

        const html = await resp.text();
        let result = await extractFromHtml(html, url);

        // If extraction looks incomplete, fall back to Playwright (headless browser)
        if (result.price === 'unknown' || !result.name || result.name === url) {
            result = await scrapeWithPlaywright(url);
        }

        return result;
    } catch (error) {
        console.error('Scraping error:', error);
        throw new Error('Failed to scrape product');
    }
}

async function scrapeWithPlaywright(url: string): Promise<ScrapedProduct> {
    try {
        const pw = await import('playwright');
        const browser = await pw.chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PLAYWRIGHT_TIMEOUT });
        const content = await page.content();
        await browser.close();
        return await extractFromHtml(content, url);
    } catch (error) {
        console.warn('Playwright fallback failed:', error);
        return { name: url, price: 'unknown', url };
    }
}

export async function fetchCurrentPrice(url: string): Promise<number | null> {
    if (!isValidUrl(url)) {
        console.warn('Invalid URL format:', url);
        return null;
    }

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
