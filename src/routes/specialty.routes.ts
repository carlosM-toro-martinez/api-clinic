import { Router } from 'express';
import {
	createSpecialty,
	listSpecialties,
	getSpecialty,
	updateSpecialty,
	deleteSpecialty,
} from '../controllers/specialty.controller';

const router = Router();

router.post('/', createSpecialty);
router.get('/', listSpecialties);
router.get('/:id', getSpecialty);
router.put('/:id', updateSpecialty);
router.delete('/:id', deleteSpecialty);

export default router;
