// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app.error';

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

  // Prisma known errors (optional: more mapping)
  // e.g. check err.code === 'P2002' for unique constraint
  // but keep generic for now:
  console.error('Unexpected error:', err);

  return res.status(500).json({
    ok: false,
    error: 'Internal server error',
    details: (err as any)?.message ?? null,
  });
}
