import { Router } from 'express';
import { requireAdmin } from '../middleware.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();
router.use(requireAdmin);

router.get('/dashboard', adminController.getDashboard);

router.get('/products', adminController.getProducts);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.patch('/products/:id/stock', adminController.updateStock);
router.delete('/products/:id', adminController.deleteProduct);

router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrder);
router.patch('/orders/:id/status', adminController.updateOrderStatus);

router.get('/coupons', adminController.getCoupons);
router.post('/coupons', adminController.createCoupon);
router.patch('/coupons/:id/toggle', adminController.toggleCoupon);

router.get('/users', adminController.getUsers);

router.get('/contact', adminController.getMessages);
router.patch('/contact/:id/handled', adminController.markMessageHandled);

export default router;
