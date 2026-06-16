import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import * as cartController from '../controllers/cartController.js';

const router = Router();
router.use(requireAuth);

router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.patch('/items/:itemId', cartController.updateItem);
router.delete('/items/:itemId', cartController.removeItem);
router.delete('/', cartController.clearCart);

export default router;
