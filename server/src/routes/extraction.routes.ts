import { Router } from 'express';
import { body } from 'express-validator';
import { extractProduct } from '../controllers/extraction.controller';

const router = Router();

const extractValidators = [
    body('url').isURL().withMessage('Invalid URL'),
];

// Extract product information from URL
router.post('/api/extract', extractValidators, extractProduct);

export default router;
