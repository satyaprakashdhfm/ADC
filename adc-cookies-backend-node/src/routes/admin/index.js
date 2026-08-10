import { Router } from 'express';
import { requireAdmin } from '../../middleware.js';

import products from './products.js';
import orders from './orders.js';
import petpooja from './petpooja.js';
import stores from './stores.js';
import coupons from './coupons.js';
import users from './users.js';
import contact from './contact.js';
import settings from './settings.js';
import insights from './insights.js';
import delivery from './delivery.js';
import shipments from './shipments.js';

/*
 * Everything under /api/admin, split by domain.
 *
 * requireAdmin is applied ONCE here rather than in each sub-router, so a new file cannot
 * accidentally ship unauthenticated: anything mounted below is already behind the gate.
 *
 * The sub-routers keep their full paths ('/products', '/orders/:id/shipment', ...) and are all
 * mounted at '/', so the URLs are byte-identical to when this was one file. Splitting the file
 * must not move an endpoint.
 */
const router = Router();
router.use(requireAdmin);

router.use('/', products);
router.use('/', orders);
router.use('/', petpooja);
router.use('/', stores);
router.use('/', coupons);
router.use('/', users);
router.use('/', contact);
router.use('/', settings);
router.use('/', insights);
router.use('/', delivery);
router.use('/', shipments);

export default router;
