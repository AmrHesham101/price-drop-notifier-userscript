import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { scrapeProduct } from '../services/scraper.service';

export async function extractProduct(req: Request, res: Response) {
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

    const { url } = req.body;

    try {
        timings.scrapeStart = Date.now();
        const product = await scrapeProduct(url);
        timings.scrapeEnd = Date.now();
        timings.end = Date.now();

        const latency = timings.end - timings.start;
        console.log('📤 Response: 200 OK | Latency:', latency + 'ms');
        console.log('Response Body:', JSON.stringify({ ok: true, product }));
        printWaterfall(timings);
        return res.json({ ok: true, product });
    } catch (error) {
        console.error('❌ Extract product error:', error);
        timings.end = Date.now();
        const latency = timings.end - timings.start;
        const errorResponse = {
            ok: false,
            error: 'fetch_failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
        console.log('📤 Response: 500 Server Error | Latency:', latency + 'ms');
        console.log('Response Body:', JSON.stringify(errorResponse));
        printWaterfall(timings);
        return res.status(500).json(errorResponse);
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

    if (timings.scrapeStart && timings.scrapeEnd) {
        phases.push({
            name: 'Web Scraping',
            duration: timings.scrapeEnd - timings.scrapeStart,
            start: timings.scrapeStart - timings.start
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
