import { Router } from 'express';
import {
	createPayment,
	listPayments,
	getPayment,
	updatePayment,
	deletePayment,
} from '../controllers/payment.controller';

const router = Router();

router.post('/', createPayment);
router.get('/', listPayments);
router.get('/:id', getPayment);
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

export default router;
