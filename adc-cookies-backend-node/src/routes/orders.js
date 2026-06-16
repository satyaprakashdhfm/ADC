import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import * as ordersController from '../controllers/ordersController.js';

const router = Router();
router.use(requireAuth);

router.post('/', ordersController.createOrder);
router.get('/', ordersController.getOrders);
router.get('/:id', ordersController.getOrder);
router.get('/:id/tracking', ordersController.getTracking);
router.post('/:id/payment/verify', ordersController.verifyPayment);

export default router;
