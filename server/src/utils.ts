/**
 * Utility helpers used across the server.
 * These are lightweight, synchronous helpers with minimal dependencies
 * to keep scraping and notification logic simple and testable.
 */

/**
 * Validate that a string is an http/https URL.
 * @param url - The URL string to validate
 * @returns true when the string parses as an http(s) URL
 */
export function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Parse a human-formatted price string and return a numeric value.
 * Examples: "$1,299.00" -> 1299, "USD 99.99" -> 99.99
 * @param priceStr - The string containing a price
 * @returns numeric value or null if parsing failed
 */
export function parsePriceString(priceStr: string): number | null {
    if (!priceStr) return null;
    // Extract the first numeric-like token (allow commas and dots)
    const m = priceStr.match(/[-+]?[0-9,.]+/);
    if (!m) return null;
    // Remove thousands separators and parse
    const s = m[0].replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

/**
 * Return a small randomized delay (ms) used to make responses feel less deterministic
 * and to slightly stagger requests when simulating human-like behavior.
 */
export function randomDelay(): number {
    return 800 + Math.floor(Math.random() * 2000);
}