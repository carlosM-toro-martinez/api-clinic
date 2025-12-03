import { Router } from 'express';
import {
	createSpecialty,
	listSpecialties,
	getSpecialty,
	updateSpecialty,
	deleteSpecialty,
	addSpecialtyFees,
	addSpecialtySchedules,
} from '../controllers/specialty.controller';

const router = Router();

router.post('/', createSpecialty);
router.get('/', listSpecialties);
router.get('/:id', getSpecialty);
router.put('/:id', updateSpecialty);
router.delete('/:id', deleteSpecialty);
router.post('/:specialtyId/fees', addSpecialtyFees);
router.post('/:specialtyId/schedules', addSpecialtySchedules);

export default router;
