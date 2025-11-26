import type { Request, Response } from 'express';
import { HistoryEntryService } from '../services/historyEntry.service';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';

const getService = (req: Request) => {
  const prisma = (req).prisma;
  if (!prisma) throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
  return new HistoryEntryService(prisma);
};

export const createHistoryEntry = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.create(req.body);
  res.status(201).json({ ok: true, data: result });
});

export const listHistoryEntries = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.list();
  res.json({ ok: true, data: result });
});

export const getHistoryEntry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.detail(id);
  res.json({ ok: true, data: result });
});

// Obtener todo el historial médico de un paciente
export const getPatientMedicalHistory = asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.params;
  
  if (!patientId || typeof patientId !== 'string') {
    throw new AppError('Patient ID requerido', 400);
  }

  const service = getService(req);
  const result = await service.getPatientMedicalHistory(patientId);
  
  res.json({ 
    ok: true, 
    data: result,
    count: result.length 
  });
});

// Obtener historial médico de un paciente por especialidad
export const getPatientMedicalHistoryBySpecialty = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, specialtyId } = req.params;
  
  if (!patientId || typeof patientId !== 'string') {
    throw new AppError('Patient ID requerido', 400);
  }

  if (!specialtyId || typeof specialtyId !== 'string') {
    throw new AppError('Specialty ID requerido', 400);
  }

  const service = getService(req);
  const result = await service.getPatientMedicalHistoryBySpecialty(patientId, specialtyId);
  
  if (!result) {
    throw new AppError('Historial médico no encontrado para este paciente y especialidad', 404);
  }

  res.json({ 
    ok: true, 
    data: result 
  });
});

// Obtener entradas recientes del historial de un paciente
export const getPatientRecentHistoryEntries = asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const { limit } = req.query;
  
  if (!patientId || typeof patientId !== 'string') {
    throw new AppError('Patient ID requerido', 400);
  }

  const service = getService(req);
  const result = await service.getPatientRecentHistoryEntries(
    patientId, 
    limit ? parseInt(limit as string) : 10
  );
  
  res.json({ 
    ok: true, 
    data: result,
    count: result.length 
  });
});


export const updateHistoryEntry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.update(id, req.body);
  res.json({ ok: true, data: result });
});

export const deleteHistoryEntry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.delete(id);
  res.json({ ok: true, data: result });
});
