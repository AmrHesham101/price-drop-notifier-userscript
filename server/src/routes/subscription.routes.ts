import { Router } from 'express';
import { body } from 'express-validator';
import { subscribe, getAllSubscriptions, deleteSubscription } from '../controllers/subscription.controller';

const router = Router();

const subscribeValidators = [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('product.url').isURL().withMessage('Invalid product URL'),
    body('product.name').notEmpty().isString().trim().escape().withMessage('Product name is required'),
    body('product.price')
        .notEmpty().withMessage('Product price is required')
        .isString().trim()
        .custom((value) => {
            // Reject "unknown" or invalid prices
            if (value.toLowerCase() === 'unknown' || value.trim() === '') {
                throw new Error('Unable to extract product price');
            }

            // Extract only digits from price
            const digits = value.replace(/[^0-9]/g, '');

            // Must have at least one digit
            if (digits.length === 0) {
                throw new Error('Price must contain at least one number');
            }

            // Digits cannot be only zeros
            if (parseInt(digits, 10) === 0) {
                throw new Error('Invalid price value');
            }

            // Price cannot be just punctuation
            if (/^[^a-zA-Z0-9]+$/.test(value)) {
                throw new Error('Price contains only symbols');
            }

            return true;
        }),
];

// Subscribe to price drop notifications
router.post('/subscribe-price-drop', subscribeValidators, subscribe);

// Get all subscriptions (admin)
router.get('/subscriptions', getAllSubscriptions);

// Delete subscription (admin)
router.delete('/subscriptions/:id', deleteSubscription);

export default router;
