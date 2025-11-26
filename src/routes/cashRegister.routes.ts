import { Router } from 'express';
import {
	createCashRegister,
	listCashRegisters,
	getCashRegister,
	updateCashRegister,
	deleteCashRegister,
} from '../controllers/cashRegister.controller';

const router = Router();

router.post('/', createCashRegister);
router.get('/', listCashRegisters);
router.get('/:id', getCashRegister);
router.put('/:id', updateCashRegister);
router.delete('/:id', deleteCashRegister);

export default router;
