import { Router } from 'express';
import {
	createPrescription,
	listPrescriptions,
	getPrescription,
	updatePrescription,
	deletePrescription,
} from '../controllers/prescription.controller';

const router = Router();

router.post('/', createPrescription);
router.get('/', listPrescriptions);
router.get('/:id', getPrescription);
router.put('/:id', updatePrescription);
router.delete('/:id', deletePrescription);

export default router;
