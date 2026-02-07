/**
 * MongoDB connection helper using Mongoose.
 * Reads the connection string from `process.env.MONGODB_URI` (dot-env).
 * Defaults to a local MongoDB instance when not provided.
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/price-drop-notifier';

if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI not set in .env file. Using local MongoDB.');
}

/**
 * Connect to the database. Exits process on fatal connection error.
 */
export async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✓ MongoDB connected successfully');
    } catch (error) {
        console.error('✗ MongoDB connection error:', error);
        process.exit(1);
    }
}

/**
 * Gracefully disconnect from MongoDB.
 */
export async function disconnectDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✓ MongoDB disconnected');
    } catch (error) {
        console.error('✗ MongoDB disconnection error:', error);
    }
}

// Mongoose connection events for helpful runtime logs
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to', MONGODB_URI);
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

// Handle application termination to close DB connection cleanly
process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
});
