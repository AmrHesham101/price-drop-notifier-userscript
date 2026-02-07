import { Request, Response } from 'express';
import { checkPriceDrops } from '../services/notifier.service';

export async function triggerNotification(req: Request, res: Response) {
    try {
        const result = await checkPriceDrops();
        return res.json({ ok: true, result });
    } catch (error) {
        console.error('Trigger notification error:', error);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
}
