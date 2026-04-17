import { Router } from 'express';
import {
	createAppointment,
	listAppointments,
	listAppointmentsByDoctor,
	listAppointmentsByPatient,
	getAppointment,
	updateAppointment,
	cancelAppointment,
	deleteAppointment
} from '../controllers/appointment.controller';

const router = Router();

router.post('/', createAppointment);
router.get('/', listAppointments);
router.get('/doctors', listAppointmentsByDoctor);
router.get('/patient/:patientId', listAppointmentsByPatient);
router.patch('/:id/cancel', cancelAppointment);
router.get('/:id', getAppointment);
router.put('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;
