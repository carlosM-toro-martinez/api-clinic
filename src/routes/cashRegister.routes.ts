import { Router } from 'express';
import {
	createCashRegister,
	listCashRegisters,
	getCashRegister,
	updateCashRegister,
	deleteCashRegister,
	closeCashRegister,
	listAllCashRegisters,
} from '../controllers/cashRegister.controller';

const router = Router();

router.post('/', createCashRegister);
router.post('/:id/close', closeCashRegister);
router.get('/', listCashRegisters);
router.get('/all', listAllCashRegisters);
router.get('/:id', getCashRegister);
router.put('/:id', updateCashRegister);
router.delete('/:id', deleteCashRegister);

export default router;
