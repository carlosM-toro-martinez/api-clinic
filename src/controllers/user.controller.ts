import type { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';

const getService = (req: Request) => {
  const prisma = (req as any).prisma;
  if (!prisma) throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
  return new UserService(prisma);
};

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.create(req.body);
  res.status(201).json({ ok: true, data: result });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const includeInactive = String(req.query.includeInactive ?? 'false').toLowerCase() === 'true';
  const result = await service.list(includeInactive);
  res.json({ ok: true, data: result });
});

export const listDoctors = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.listDoctors();
  res.json({ ok: true, data: result });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.detail(id);
  res.json({ ok: true, data: result });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.update(id, req.body);
  res.json({ ok: true, data: result });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.delete(id);
  res.json({ ok: true, data: result });
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.deactivate(id);
  res.json({ ok: true, data: result });
});
