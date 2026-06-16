import { Router } from 'express';
import * as couponsController from '../controllers/couponsController.js';

const router = Router();

router.get('/validate', couponsController.validateCoupon);

export default router;
