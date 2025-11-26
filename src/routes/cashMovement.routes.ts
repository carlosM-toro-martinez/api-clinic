import { Router } from 'express';
import {
	createCashMovement,
	listCashMovements,
	getCashMovement,
	updateCashMovement,
	deleteCashMovement,
} from '../controllers/cashMovement.controller';

const router = Router();

router.post('/', createCashMovement);
router.get('/', listCashMovements);
router.get('/:id', getCashMovement);
router.put('/:id', updateCashMovement);
router.delete('/:id', deleteCashMovement);

export default router;
