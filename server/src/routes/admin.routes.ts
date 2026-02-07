import { Router } from 'express';
import { triggerNotification } from '../controllers/admin.controller';

const router = Router();

// Manually trigger price check and notifications
router.post('/admin/trigger-notify', triggerNotification);

export default router;
