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
    createdAt: Date;
    updatedAt: Date;
}

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
}, {
    timestamps: true,
});

// Compound index for efficient duplicate checking
SubscriptionSchema.index({ email: 1, 'product.url': 1 });

// Static method to check if subscription exists
SubscriptionSchema.statics.exists = async function(email: string, url: string): Promise<boolean> {
    const count = await this.countDocuments({ email, 'product.url': url });
    return count > 0;
};

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
