import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Subscription } from '../models/Subscription.model';
import { randomDelay } from '../utils';

interface SubscribeRequestBody {
    email: string;
    product: {
        name: string;
        price: string;
        url: string;
    };
}

export async function subscribe(req: Request, res: Response) {
    const start = Date.now();

    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const latency = Date.now() - start;
        console.log('POST /subscribe-price-drop 400', latency + 'ms');
        return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const body = req.body as SubscribeRequestBody;
    const { email, product } = body;

    // Random delay to simulate processing
    await new Promise((r) => setTimeout(r, randomDelay()));

    try {
        // Check if subscription already exists
        const exists = await Subscription.findOne({
            email,
            'product.url': product.url,
        });

        if (exists) {
            const latency = Date.now() - start;
            console.log('POST /subscribe-price-drop 409', latency + 'ms');
            return res.status(409).json({ ok: false, error: 'already_subscribed' });
        }

        // Simulate occasional server error
        if (Math.random() < 0.08) {
            const latency = Date.now() - start;
            console.log('POST /subscribe-price-drop 500', latency + 'ms');
            return res.status(500).json({ ok: false, error: 'server_error' });
        }

        // Create new subscription
        const subscription = new Subscription({
            email,
            product,
        });

        await subscription.save();

        const latency = Date.now() - start;
        console.log('POST /subscribe-price-drop 200', latency + 'ms');
        return res.json({ ok: true });
    } catch (error) {
        console.error('Subscribe error:', error);
        const latency = Date.now() - start;
        console.log('POST /subscribe-price-drop 500', latency + 'ms');
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
}

export async function getAllSubscriptions(req: Request, res: Response) {
    try {
        const subscriptions = await Subscription.find({}).sort({ createdAt: -1 });
        return res.json({ ok: true, subscriptions });
    } catch (error) {
        console.error('Get all subscriptions error:', error);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
}

export async function deleteSubscription(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const deleted = await Subscription.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ ok: false, error: 'Subscription not found' });
        }

        return res.json({ ok: true, message: 'Subscription deleted' });
    } catch (error) {
        console.error('Delete subscription error:', error);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
}
