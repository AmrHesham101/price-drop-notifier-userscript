export function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function parsePriceString(priceStr: string): number | null {
    if (!priceStr) return null;
    // remove non-number except dot and comma
    const m = priceStr.match(/[-+]?[0-9,.]+/);
    if (!m) return null;
    const s = m[0].replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

export function randomDelay(): number {
    return 800 + Math.floor(Math.random() * 2000);
}