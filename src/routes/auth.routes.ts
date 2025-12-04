import { Router } from 'express';
import { loginController, registerController, changePasswordController, logoutController, validateTokenController } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', loginController);
router.post('/register', registerController);
router.post('/change-password', requireAuth, changePasswordController);
router.post('/logout', requireAuth, logoutController);
router.post('/validate', validateTokenController);

export default router;
