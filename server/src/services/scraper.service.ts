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

        // Check if extraction looks valid
        const needsPlaywright = isInvalidExtraction(result, url);

        if (needsPlaywright) {
            console.log('⚠️ Initial extraction looks invalid, trying Playwright fallback...');
            console.log('Initial result:', result);
            result = await scrapeWithPlaywright(url);
        }

        return result;
    } catch (error) {
        console.error('Scraping error:', error);
        throw new Error('Failed to scrape product');
    }
}

/**
 * Determine if extracted data looks invalid and needs Playwright
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

async function scrapeWithPlaywright(url: string): Promise<ScrapedProduct> {
    try {
        console.log('🎭 Launching Playwright browser for:', url);
        const pw = await import('playwright');
        const browser = await pw.chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PLAYWRIGHT_TIMEOUT });
        const content = await page.content();
        console.log('📄 Page content length:', content.length, 'bytes');

        await browser.close();
        console.log('🎭 Browser closed');

        const result = await extractFromHtml(content, url);
        console.log('🎭 Playwright extracted:', JSON.stringify(result, null, 2));

        return result;
    } catch (error) {
        console.warn('❌ Playwright fallback failed:', error);
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
