import { Router } from 'express';
import authRoutes from './auth.routes';
import patientsRoutes from './patients.routes';
import cashRegisterRoutes from './cashRegister.routes';
import cashMovementRoutes from './cashMovement.routes';
import prescriptionRoutes from './prescription.routes';
import specialtyRoutes from './specialty.routes';
import userRoutes from './user.routes';
import historyEntryRoutes from './historyEntry.routes';
import paymentRoutes from './payment.routes';
import diagnosisRoutes from './diagnosis.routes';
import appointmentRoutes from './appointment.routes';
import whatsappRoutes from './whatsapp.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/patients', patientsRoutes);
router.use('/cash-register', cashRegisterRoutes);
router.use('/cash-movement', cashMovementRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/specialties', specialtyRoutes);
router.use('/users', userRoutes);
router.use('/history-entries', historyEntryRoutes);
router.use('/payments', paymentRoutes);
router.use('/diagnosis', diagnosisRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/whatsapp', whatsappRoutes);

export default router;
