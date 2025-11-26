import { Router } from 'express';
import {
	createHistoryEntry,
	listHistoryEntries,
	getHistoryEntry,
	updateHistoryEntry,
	deleteHistoryEntry,
	getPatientMedicalHistory,
	getPatientRecentHistoryEntries,
	getPatientMedicalHistoryBySpecialty,
} from '../controllers/historyEntry.controller';

const router = Router();

router.post('/', createHistoryEntry);
router.get('/', listHistoryEntries);
router.get('/:id', getHistoryEntry);
router.put('/:id', updateHistoryEntry);
router.delete('/:id', deleteHistoryEntry);
router.get('/patient/:patientId/history', getPatientMedicalHistory);
router.get('/patient/:patientId/history/specialty/:specialtyId', getPatientMedicalHistoryBySpecialty);
router.get('/patient/:patientId/history/recent', getPatientRecentHistoryEntries);

export default router;
