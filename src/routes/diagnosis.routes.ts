import { Router } from 'express';
import {
	createDiagnosis,
	listDiagnoses,
	getDiagnosis,
	updateDiagnosis,
	deleteDiagnosis,
} from '../controllers/diagnosis.controller';

const router = Router();

router.post('/', createDiagnosis);
router.get('/', listDiagnoses);
router.get('/:id', getDiagnosis);
router.put('/:id', updateDiagnosis);
router.delete('/:id', deleteDiagnosis);

export default router;
