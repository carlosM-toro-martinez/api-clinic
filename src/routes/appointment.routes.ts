import { Router } from 'express';
import {
	createAppointment,
	listAppointments,
	listAppointmentsByDoctor,
	listAppointmentsByPatient,
	getAppointment,
	updateAppointment,
	deleteAppointment
} from '../controllers/appointment.controller';

const router = Router();

router.post('/', createAppointment);
router.get('/', listAppointments);
router.get('/doctors', listAppointmentsByDoctor);
router.get('/patient/:patientId', listAppointmentsByPatient);
router.get('/:id', getAppointment);
router.put('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;
