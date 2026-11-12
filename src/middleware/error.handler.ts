// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app.error';

type PrismaLikeError = { code?: string; name?: string; message?: string };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // AppError -> structured
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: err.message,
      code: err.code,
      details: err.details ?? null,
    });
  }

  const e = (err ?? {}) as PrismaLikeError;

  // Prisma known errors -> meaningful HTTP codes instead of a generic 500
  if (e.code === 'P2025') {
    return res.status(404).json({ ok: false, error: 'Registro no encontrado', code: 'NOT_FOUND', details: null });
  }
  if (e.code === 'P2002') {
    return res.status(409).json({ ok: false, error: 'Ya existe un registro con esos datos', code: 'CONFLICT', details: null });
  }
  if (e.code === 'P2003') {
    return res.status(409).json({
      ok: false,
      error: 'Referencia inválida o el registro tiene datos relacionados',
      code: 'RELATION_CONFLICT',
      details: null,
    });
  }
  // Invalid payloads (wrong types, bad dates, unknown fields, malformed ids)
  if (e.name === 'PrismaClientValidationError' || e.code === 'P2000' || e.code === 'P2006' || e.code === 'P2023') {
    return res.status(400).json({ ok: false, error: 'Datos inválidos en la solicitud', code: 'BAD_REQUEST', details: null });
  }
  // Malformed JSON body
  if ((err as { type?: string })?.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'JSON inválido', code: 'BAD_REQUEST', details: null });
  }

  console.error('Unexpected error:', err);

  return res.status(500).json({
    ok: false,
    error: 'Internal server error',
    // never leak internals (SQL, file paths) in production
    details: process.env.NODE_ENV === 'production' ? null : (e.message ?? null),
  });
}
