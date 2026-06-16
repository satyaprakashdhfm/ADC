import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import * as passwordResetController from '../controllers/passwordResetController.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/admin/login', authController.adminLogin);

router.post('/forgot-password', passwordResetController.forgotPassword);
router.post('/reset-password', passwordResetController.resetPassword);

export default router;
