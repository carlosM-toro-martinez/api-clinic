import { Router } from 'express';
import {
	createSpecialty,
	listSpecialties,
	getSpecialty,
	updateSpecialty,
	deleteSpecialty,
	addSpecialtyFees,
	addSpecialtySchedules,
	updateSpecialtyFee,
	deleteSpecialtyFee,
	updateSpecialtySchedule,
	deleteSpecialtySchedule,
	deleteSpecialtySchedulesBulk,
} from '../controllers/specialty.controller';

const router = Router();

router.post('/', createSpecialty);
router.get('/', listSpecialties);
router.get('/:id', getSpecialty);
router.put('/:id', updateSpecialty);
router.delete('/:id', deleteSpecialty);
router.post('/:specialtyId/fees', addSpecialtyFees);
router.post('/:specialtyId/schedules', addSpecialtySchedules);
router.put('/:specialtyId/fees/:feeId', updateSpecialtyFee);
router.delete('/:specialtyId/fees/:feeId', deleteSpecialtyFee);
router.put('/:specialtyId/schedules/:scheduleId', updateSpecialtySchedule);
router.delete('/:specialtyId/schedules/:scheduleId', deleteSpecialtySchedule);
router.delete('/:specialtyId/schedules', deleteSpecialtySchedulesBulk);

export default router;
