import { Router } from 'express';
import {
	createUser,
	listUsers,
	getUser,
	updateUser,
	deleteUser,
	listDoctors,
	deactivateUser,
} from '../controllers/user.controller';

const router = Router();

router.post('/', createUser);
router.get('/doctors', listDoctors);
router.get('/', listUsers);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.patch('/:id/deactivate', deactivateUser);
router.delete('/:id', deleteUser);

export default router;
