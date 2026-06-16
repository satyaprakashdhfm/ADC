import { Router } from 'express';
import { requireAuth } from '../middleware.js';
import * as addressesController from '../controllers/addressesController.js';

const router = Router();
router.use(requireAuth);

router.get('/', addressesController.getAddresses);
router.post('/', addressesController.addAddress);
router.delete('/:id', addressesController.deleteAddress);

export default router;
