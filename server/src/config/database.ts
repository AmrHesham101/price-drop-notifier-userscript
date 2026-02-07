import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/price-drop-notifier';

export async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✓ MongoDB connected successfully');
    } catch (error) {
        console.error('✗ MongoDB connection error:', error);
        process.exit(1);
    }
}

export async function disconnectDatabase() {
    try {
        await mongoose.disconnect();
        console.log('✓ MongoDB disconnected');
    } catch (error) {
        console.error('✗ MongoDB disconnection error:', error);
    }
}

// Mongoose connection events
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to', MONGODB_URI);
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

// Handle application termination
process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
});
