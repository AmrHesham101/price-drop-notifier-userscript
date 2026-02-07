import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import rateLimit from 'express-rate-limit';

// Config
import { connectDatabase } from './config/database';
import { PORT, RATE_LIMIT } from './config/constants';

// Services
import { initEmailService } from './services/email.service';
import { startPeriodicChecks } from './services/notifier.service';

// Routes
import subscriptionRoutes from './routes/subscription.routes';
import extractionRoutes from './routes/extraction.routes';
import adminRoutes from './routes/admin.routes';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// CORS middleware - allow requests from any origin (for development)
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: RATE_LIMIT.windowMs,
    max: RATE_LIMIT.max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Static files
const publicDir = path.join(__dirname, '..', 'public');
const buildDir = path.join(__dirname, '..', '..', 'build');
app.use('/assets', express.static(path.join(publicDir, 'assets'), { maxAge: '1d' }));
app.use('/build', express.static(buildDir, { maxAge: '1d' }));
app.use('/demo', express.static(path.join(publicDir, 'demo')));
app.use('/embed', express.static(path.join(publicDir, 'embed')));

// Routes
app.use('/', subscriptionRoutes);
app.use('/', extractionRoutes);
app.use('/', adminRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({ ok: false, error: 'Route not found' });
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize and start server
async function startServer() {
    try {
        // Connect to MongoDB
        await connectDatabase();

        // Initialize email service
        await initEmailService();

        // Start Express server
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📝 Demo page: http://localhost:${PORT}/demo/index.html\n`);
        });

        // Start periodic price checks
        startPeriodicChecks();
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
