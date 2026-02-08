import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Subscription } from '../models/Subscription.model';
import { randomDelay, parsePriceString } from '../utils';

interface SubscribeRequestBody {
    email: string;
    product: {
        name: string;
        price: string;
        url: string;
    };
}

export async function subscribe(req: Request, res: Response) {
    const timings: Record<string, number> = {
        start: Date.now(),
        received: Date.now(),
    };

    // Log incoming request details (for network tracking)
    console.log('\n📥 ========== INCOMING REQUEST ==========');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('IP:', req.ip || req.socket.remoteAddress);
    console.log('User-Agent:', req.get('user-agent'));
    console.log('Content-Type:', req.get('content-type'));
    console.log('Origin:', req.get('origin') || 'N/A');
    console.log('Referer:', req.get('referer') || 'N/A');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('=========================================\n');

    // Validation
    timings.validationStart = Date.now();
    const errors = validationResult(req);
    timings.validationEnd = Date.now();

    if (!errors.isEmpty()) {
        const latency = Date.now() - timings.start;
        console.log('📤 Response: 400 Bad Request | Latency:', latency + 'ms');
        console.log('Response Body:', JSON.stringify({ ok: false, errors: errors.array() }));
        return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const body = req.body as SubscribeRequestBody;
    const { email, product } = body;

    // Random delay to simulate processing
    timings.processingStart = Date.now();
    await new Promise((r) => setTimeout(r, randomDelay()));
    timings.processingEnd = Date.now();

    try {
        // Check if subscription already exists
        timings.dbQueryStart = Date.now();
        const exists = await Subscription.findOne({
            email,
            'product.url': product.url,
        });
        timings.dbQueryEnd = Date.now();

        if (exists) {
            const latency = Date.now() - timings.start;
            console.log('📤 Response: 409 Conflict | Latency:', latency + 'ms');
            console.log('Response Body:', JSON.stringify({ ok: false, error: 'already_subscribed' }));
            printWaterfall(timings);
            return res.status(409).json({ ok: false, error: 'already_subscribed' });
        }

        // Simulate occasional server error
        if (Math.random() < 0.08) {
            const latency = Date.now() - timings.start;
            console.log('📤 Response: 500 Server Error (simulated) | Latency:', latency + 'ms');
            console.log('Response Body:', JSON.stringify({ ok: false, error: 'server_error' }));
            printWaterfall(timings);
            return res.status(500).json({ ok: false, error: 'server_error' });
        }

        // Create new subscription
        timings.dbSaveStart = Date.now();

        // Parse initial price for price drop tracking
        const initialPrice = parsePriceString(product.price);
        console.log(`💰 Parsed price: "${product.price}" → ${initialPrice ?? 'null'}`);

        const subscription = new Subscription({
            email,
            product: {
                ...product,
                lastSeenPrice: initialPrice ?? undefined,
            },
        });

        await subscription.save();
        timings.dbSaveEnd = Date.now();
        timings.end = Date.now();

        const latency = timings.end - timings.start;
        console.log('📤 Response: 200 OK | Latency:', latency + 'ms');
        console.log('Response Body:', JSON.stringify({ ok: true }));
        printWaterfall(timings);
        return res.json({ ok: true });
    } catch (error) {
        console.error('❌ Subscribe error:', error);
        timings.end = Date.now();
        const latency = timings.end - timings.start;
        console.log('📤 Response: 500 Server Error | Latency:', latency + 'ms');
        console.log('Response Body:', JSON.stringify({ ok: false, error: 'server_error' }));
        printWaterfall(timings);
        return res.status(500).json({ ok: false, error: 'server_error' });
    }
}

function printWaterfall(timings: Record<string, number>) {
    console.log('\n⏱️  ========== REQUEST WATERFALL ==========');

    const phases = [];

    if (timings.validationStart && timings.validationEnd) {
        phases.push({
            name: 'Validation',
            duration: timings.validationEnd - timings.validationStart,
            start: timings.validationStart - timings.start
        });
    }

    if (timings.processingStart && timings.processingEnd) {
        phases.push({
            name: 'Processing/Delay',
            duration: timings.processingEnd - timings.processingStart,
            start: timings.processingStart - timings.start
        });
    }

    if (timings.dbQueryStart && timings.dbQueryEnd) {
        phases.push({
            name: 'DB Query (Check Exists)',
            duration: timings.dbQueryEnd - timings.dbQueryStart,
            start: timings.dbQueryStart - timings.start
        });
    }

    if (timings.dbSaveStart && timings.dbSaveEnd) {
        phases.push({
            name: 'DB Save',
            duration: timings.dbSaveEnd - timings.dbSaveStart,
            start: timings.dbSaveStart - timings.start
        });
    }

    const totalTime = (timings.end || Date.now()) - timings.start;

    phases.forEach(phase => {
        const bar = '█'.repeat(Math.floor((phase.duration / totalTime) * 40));
        const percentage = ((phase.duration / totalTime) * 100).toFixed(1);
        console.log(`${phase.name.padEnd(25)} ${phase.duration.toString().padStart(4)}ms [${percentage.padStart(5)}%] ${bar}`);
    });

    console.log(`${'─'.repeat(70)}`);
    console.log(`${'Total Time'.padEnd(25)} ${totalTime.toString().padStart(4)}ms [100.0%]`);
    console.log('==========================================\n');
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
