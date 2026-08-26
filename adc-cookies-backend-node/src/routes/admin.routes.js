import { Router } from 'express';
import { requireAdminSession } from '../services/adminAuth.service.js';

import products from './admin/products.routes.js';
import orders from './admin/orders.routes.js';
import petpooja from './admin/petpooja.routes.js';
import stores from './admin/stores.routes.js';
import coupons from './admin/coupons.routes.js';
import users from './admin/users.routes.js';
import contact from './admin/contact.routes.js';
import settings from './admin/settings.routes.js';
import insights from './admin/insights.routes.js';
import delivery from './admin/delivery.routes.js';
import shipments from './admin/shipments.routes.js';
import cancelRefund from './admin/cancelRefund.routes.js';
import uploads from './admin/uploads.routes.js';

/*
 * Everything under /api/admin, split by domain.
 *
 * requireAdminSession is applied ONCE here rather than in each sub-router, so a new file cannot
 * accidentally ship unauthenticated: anything mounted below is already behind the gate.
 *
 * That gate is the admin's OWN session (see adminAuth.js), not users.role. A customer's Supabase
 * token — however it was obtained — grants nothing here.
 *
 * The sub-routers keep their full paths ('/products', '/orders/:id/shipment', ...) and are all
 * mounted at '/', so the URLs are byte-identical to when this was one file. Splitting the file
 * must not move an endpoint.
 */
const router = Router();
router.use(requireAdminSession);

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
router.use('/', cancelRefund);
router.use('/', uploads);

export default router;
