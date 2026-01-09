import { Router } from 'express';
import { patientsByDiagnosis, appointmentsWeekly, patientsGeneral, cashReport } from '../controllers/report.controller';

const router = Router();

// 1. Pacientes por diagnóstico de cada especialidad
router.get('/patients-by-diagnosis', patientsByDiagnosis);

// 2. Cantidad de citas semanales por especialidad
// optional query params: startDate, endDate
router.get('/appointments-weekly', appointmentsWeekly);

// 3. Estadística de pacientes en forma general
router.get('/patients-general', patientsGeneral);

// 4. Estadísticas de caja por día/mes para un cash register específico
// required query param: cashRegisterId
// optional: startDate, endDate, period=(day|month)
router.get('/cash', cashReport);

export default router;
