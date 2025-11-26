import { Router } from 'express';
import { loginController, registerController, changePasswordController } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', loginController);
router.post('/register', registerController);
router.post('/change-password', requireAuth, changePasswordController);

export default router;
