import { Router } from 'express';
import { body } from 'express-validator';
import { subscribe, getAllSubscriptions, deleteSubscription } from '../controllers/subscription.controller';

const router = Router();

const subscribeValidators = [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('product.url').isURL().withMessage('Invalid product URL'),
    body('product.name').optional().isString().trim().escape(),
    body('product.price').optional().isString().trim().escape(),
];

// Subscribe to price drop notifications
router.post('/subscribe-price-drop', subscribeValidators, subscribe);

// Get all subscriptions (admin)
router.get('/subscriptions', getAllSubscriptions);

// Delete subscription (admin)
router.delete('/subscriptions/:id', deleteSubscription);

export default router;
