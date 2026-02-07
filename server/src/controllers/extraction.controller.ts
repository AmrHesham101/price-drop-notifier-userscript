import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { scrapeProduct } from '../services/scraper.service';

export async function extractProduct(req: Request, res: Response) {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const { url } = req.body;

    try {
        const product = await scrapeProduct(url);
        return res.json({ ok: true, product });
    } catch (error) {
        console.error('Extract product error:', error);
        return res.status(500).json({
            ok: false,
            error: 'fetch_failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
