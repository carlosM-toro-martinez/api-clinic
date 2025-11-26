import type { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';

const getService = (req: Request) => {
  const prisma = (req as any).prisma;
  if (!prisma) throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
  return new PaymentService(prisma);
};

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.create(req.body);
  res.status(201).json({ ok: true, data: result });
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.list();
  res.json({ ok: true, data: result });
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.detail(id);
  res.json({ ok: true, data: result });
});

export const updatePayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.update(id, req.body);
  res.json({ ok: true, data: result });
});

export const deletePayment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') throw new AppError('ID requerido', 400);
  const service = getService(req);
  const result = await service.delete(id);
  res.json({ ok: true, data: result });
});
