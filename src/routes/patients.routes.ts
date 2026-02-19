import { Router } from 'express';
import {
  listPatients,
  createPatient,
  getPatient,
  updatePatient,
  deletePatient,
  deactivatePatient,
} from '../controllers/patients.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', listPatients);
router.post('/', requireAuth, createPatient);
router.get('/:id', getPatient);
router.put('/:id', requireAuth, updatePatient);
router.patch('/:id/deactivate', requireAuth, deactivatePatient);
router.delete('/:id', requireAuth, deletePatient);

export default router;
