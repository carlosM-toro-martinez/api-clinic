import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';
import { PatientService } from '../services/patient.service';

const patientBaseSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ciNumber: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  insuranceInfo: z.any().optional().nullable(),
}).strict();

// Función para preprocesar el body
const preprocessBody = (body: any) => {
  const processed = { ...body };
  
  // Convertir cadenas vacías a null
  Object.keys(processed).forEach(key => {
    if (processed[key] === '') {
      processed[key] = null;
    }
  });
  
  // También procesar insuranceInfo si existe
  if (processed.insuranceInfo && typeof processed.insuranceInfo === 'object') {
    Object.keys(processed.insuranceInfo).forEach(key => {
      if (processed.insuranceInfo[key] === '') {
        processed.insuranceInfo[key] = null;
      }
    });
  }
  
  return processed;
};

type PaginationQuery = {
  page?: string | number;
  limit?: string | number;
}

const getService = (req: Request): PatientService => {
  if (!req.prisma) throw new AppError('Database client not available', 500);
  return new PatientService(req.prisma);
};

const getPagination = (query: PaginationQuery) => ({
  page: Math.max(1, Number(query.page ?? 1)),
  limit: Math.max(1, Math.min(100, Number(query.limit ?? 20))),
});

export const listPatients = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = getPagination(req.query);
  const includeDeleted = String(req.query.includeDeleted ?? 'false').toLowerCase() === 'true';
  const service = getService(req);
  const result = await service.list(page, limit, includeDeleted);

  res.json({ 
    ok: true, 
    data: result.items, 
    meta: result.meta 
  });
});

export const createPatient = asyncHandler(async (req: Request, res: Response) => {
  const processedBody = preprocessBody(req.body);
  const validation = patientBaseSchema.safeParse(processedBody);
  
  if (!validation.success) {
    console.log('Validation error:', validation.error.format());
    throw new AppError('Invalid request data', 422, 'VALIDATION_ERROR', validation.error.format());
  }

  const service = getService(req);
  const patient = await service.create(validation.data);

  res.status(201).json({ ok: true, data: patient });
});

export const getPatient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) throw new AppError('Patient ID is required', 400);

  const service = getService(req);
  const patient = await service.detail(id);

  res.json({ ok: true, data: patient });
});

export const updatePatient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) throw new AppError('Patient ID is required', 400);

  const processedBody = preprocessBody(req.body);
  const validation = patientBaseSchema.partial().safeParse(processedBody);
  
  if (!validation.success) {
    console.log('Validation error:', validation.error.format());
    throw new AppError('Invalid request data', 422, 'VALIDATION_ERROR', validation.error.format());
  }

  const service = getService(req);
  const patient = await service.update(id, validation.data);

  res.json({ ok: true, data: patient });
});

export const deletePatient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) throw new AppError('Patient ID is required', 400);

  const service = getService(req);
  await service.delete(id);

  res.json({ ok: true, message: 'Patient deleted successfully' });
});

export const deactivatePatient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id) throw new AppError('Patient ID is required', 400);

  const service = getService(req);
  const patient = await service.deactivate(id);

  res.json({ ok: true, data: patient });
});
