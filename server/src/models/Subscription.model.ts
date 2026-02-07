/**
 * Mongoose model for subscriptions.
 * Each subscription stores the subscriber email and a small product object
 * (name, price, url, and optional lastSeenPrice). Timestamps are enabled
 * so `createdAt` and `updatedAt` are available automatically.
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct {
    name: string;
    price: string;
    url: string;
    lastSeenPrice?: number;
}

export interface ISubscription extends Document {
    email: string;
    product: IProduct;
    lastNotifiedAt?: Date;
    lastCheckedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Embedded product schema - stored inline within the subscription document.
 */
const ProductSchema = new Schema<IProduct>({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: String,
        required: true,
        trim: true,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    lastSeenPrice: {
        type: Number,
        required: false,
    },
}, { _id: false });

const SubscriptionSchema = new Schema<ISubscription>({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            message: 'Invalid email format',
        },
    },
    product: {
        type: ProductSchema,
        required: true,
    },
    lastNotifiedAt: {
        type: Date,
        required: false,
    },
    lastCheckedAt: {
        type: Date,
        required: false,
    },
}, {
    timestamps: true,
});

// Compound index for efficient duplicate checking (email + product URL)
SubscriptionSchema.index({ email: 1, 'product.url': 1 });

/**
 * Static helper to quickly check for duplicates.
 * Usage: await Subscription.exists(email, url)
 */
SubscriptionSchema.statics.exists = async function (email: string, url: string): Promise<boolean> {
    const count = await this.countDocuments({ email, 'product.url': url });
    return count > 0;
};

/**
 * Export the model for use in controllers and services.
 */
export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
