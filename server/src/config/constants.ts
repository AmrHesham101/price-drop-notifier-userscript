export const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

export const RATE_LIMIT = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max requests per window
};

export const NOTIFIER_INTERVAL = 15 * 60 * 1000; // 15 minutes

export const FETCH_TIMEOUT = 10000; // 10 seconds

export const PLAYWRIGHT_TIMEOUT = 20000; // 20 seconds

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
