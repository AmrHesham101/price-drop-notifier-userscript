/**
 * Application-wide constants and defaults.
 * Override via environment variables when necessary.
 */
export const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

export const RATE_LIMIT = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max requests per window
};

/** Interval in ms between periodic price checks */
export const NOTIFIER_INTERVAL = 10 * 60 * 1000; // 10 minutes

/** Number of subscriptions to process in each batch (prevents memory overload) */
export const BATCH_SIZE = 20;

/** Minimum interval (ms) between checking the same subscription (prevents redundant checks) */
export const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** Minimum delay (ms) between requests to the same domain (rate limiting to avoid bans) */
export const DOMAIN_DELAY_MS = 2000; // 2 seconds

/** Fetch timeouts (ms) for network requests */
export const FETCH_TIMEOUT = 10000; // 10 seconds

/** Playwright navigation timeout (ms) */
export const PLAYWRIGHT_TIMEOUT = 20000; // 20 seconds

/** User-Agent string used for server-side scraping requests */
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
