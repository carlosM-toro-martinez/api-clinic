import type { Request, Response } from 'express';
import { SpecialtyService } from '../services/specialty.service';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';

const getService = (req: Request) => {
  const prisma = (req as any).prisma;
  if (!prisma) throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
  return new SpecialtyService(prisma);
};

export const createSpecialty = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.create(req.body);
  res.status(201).json({ ok: true, data: result });
});

export const listSpecialties = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.list();
  res.json({ ok: true, data: result });
});

export const getSpecialty = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.detail(id);
  res.json({ ok: true, data: result });
});

export const updateSpecialty = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.update(id, req.body);
  res.json({ ok: true, data: result });
});

export const deleteSpecialty = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.delete(id);
  res.json({ ok: true, data: result });
});

export const addSpecialtyFees = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId } = req.params;
  if (!specialtyId || typeof specialtyId !== 'string') throw new AppError('specialtyId requerido', 400);
  const service = getService(req);

  const fees = req.body;
  if (!Array.isArray(fees) || fees.length === 0) throw new AppError('Se requiere un arreglo de fees', 400);

  const result = await service.addFees(specialtyId, fees);
  res.status(201).json({ ok: true, data: result });
});

export const addSpecialtySchedules = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId } = req.params;
  if (!specialtyId || typeof specialtyId !== 'string') throw new AppError('specialtyId requerido', 400);
  const service = getService(req);

  const schedules = req.body;
  if (!Array.isArray(schedules) || schedules.length === 0) throw new AppError('Se requiere un arreglo de schedules', 400);

  const result = await service.addSchedules(specialtyId, schedules);
  res.status(201).json({ ok: true, data: result });
});

export const updateSpecialtyFee = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId, feeId } = req.params;
  if (!specialtyId || typeof specialtyId !== 'string') throw new AppError('specialtyId requerido', 400);
  if (!feeId || typeof feeId !== 'string') throw new AppError('feeId requerido', 400);
  const service = getService(req);

  const result = await service.updateFee(specialtyId, feeId, req.body);
  res.json({ ok: true, data: result });
});

export const deleteSpecialtyFee = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId, feeId } = req.params;
  if (!specialtyId || typeof specialtyId !== 'string') throw new AppError('specialtyId requerido', 400);
  if (!feeId || typeof feeId !== 'string') throw new AppError('feeId requerido', 400);
  const service = getService(req);

  const result = await service.deleteFee(specialtyId, feeId);
  res.json({ ok: true, data: result });
});

export const updateSpecialtySchedule = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId, scheduleId } = req.params;
  if (!specialtyId || typeof specialtyId !== 'string') throw new AppError('specialtyId requerido', 400);
  if (!scheduleId || typeof scheduleId !== 'string') throw new AppError('scheduleId requerido', 400);
  const service = getService(req);

  const result = await service.updateSchedule(specialtyId, scheduleId, req.body);
  res.json({ ok: true, data: result });
});

export const deleteSpecialtySchedule = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId, scheduleId } = req.params;
  if (!specialtyId || typeof specialtyId !== 'string') throw new AppError('specialtyId requerido', 400);
  if (!scheduleId || typeof scheduleId !== 'string') throw new AppError('scheduleId requerido', 400);
  const service = getService(req);

  const result = await service.deleteSchedule(specialtyId, scheduleId);
  res.json({ ok: true, data: result });
});

export const deleteSpecialtySchedulesBulk = asyncHandler(async (req: Request, res: Response) => {
  const { specialtyId } = req.params;
  if (!specialtyId || typeof specialtyId !== 'string') throw new AppError('specialtyId requerido', 400);
  const service = getService(req);

  const scheduleIds = req.body;
  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    throw new AppError('Se requiere un arreglo de scheduleIds', 400);
  }

  const result = await service.deleteSchedulesBulk(specialtyId, scheduleIds);
  res.json({ ok: true, data: result });
});
