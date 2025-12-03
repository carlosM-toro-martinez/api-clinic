import type { Request, Response } from 'express';
import type { AppointmentStatus } from '../../node_modules/.prisma/tenant-client';
import { AppointmentService } from '../services/appointment.service';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';

const getService = (req: Request) => {
  const prisma = (req).prisma;
  if (!prisma) throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
  return new AppointmentService(prisma);
};

export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.create(req.body);
  res.status(201).json({ ok: true, data: result });
});

export const listAppointments = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.list();
  res.json({ ok: true, data: result });
});

export const listAppointmentsByDoctor = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  
  const { doctorId, startDate, endDate, status, specialtyId, patientName } = req.query;
  const filters: { startDate?: Date; endDate?: Date; status?: AppointmentStatus } = {};

  if (startDate) filters.startDate = new Date(startDate as string);
  if (endDate) filters.endDate = new Date(endDate as string);
  if (status) filters.status = status as AppointmentStatus;

  const result = await service.findByDoctor(doctorId as string, filters);
  res.json({ ok: true, data: result });
});

export const listAppointmentsByPatient = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);

  const { patientId } = req.params;
  if (!patientId || typeof patientId !== 'string') throw new AppError('patientId requerido', 400);

  const { startDate, endDate, status } = req.query;
  const filters: { startDate?: Date; endDate?: Date; status?: AppointmentStatus } = {};
  if (startDate) filters.startDate = new Date(startDate as string);
  if (endDate) filters.endDate = new Date(endDate as string);
  if (status) filters.status = status as AppointmentStatus;

  const result = await service.findByPatient(patientId, filters);
  res.json({ ok: true, data: result });
});

export const getAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.detail(id);
  res.json({ ok: true, data: result });
});

export const updateAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.update(id, req.body);
  res.json({ ok: true, data: result });
});

export const deleteAppointment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.delete(id);
  res.json({ ok: true, data: result });
});
