import type { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';

const getService = (req: Request) => {
  const prisma = (req as any).prisma;
  if (!prisma) throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
  return new ReportService(prisma);
};

const normalize = (input: any): any => {
  if (Array.isArray(input)) return input.map(normalize);
  if (input && typeof input === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(input)) {
      if (typeof v === 'bigint') {
        // Convert to Number when safe, otherwise to string
        try { out[k] = Number(v); } catch { out[k] = v.toString(); }
      } else if (v instanceof Date) {
        out[k] = v.toISOString();
      } else if (Array.isArray(v) || (v && typeof v === 'object')) {
        out[k] = normalize(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return input;
};

export const patientsByDiagnosis = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.patientsByDiagnosis();
  res.json({ ok: true, data: normalize(result) });
});

export const appointmentsWeekly = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as Record<string, string | undefined>;
  const service = getService(req);
  const parsedStart = startDate ? new Date(startDate) : undefined;
  const parsedEnd = endDate ? new Date(endDate) : undefined;
  const result = await service.weeklyAppointmentsBySpecialty(parsedStart, parsedEnd);
  res.json({ ok: true, data: normalize(result) });
});

export const patientsGeneral = asyncHandler(async (req: Request, res: Response) => {
  const service = getService(req);
  const result = await service.patientsGeneralStats();
  res.json({ ok: true, data: normalize(result) });
});

export const cashReport = asyncHandler(async (req: Request, res: Response) => {
  const { cashRegisterId, startDate, endDate, period } = req.query as Record<string, string | undefined>;
  if (!cashRegisterId) throw new AppError('cashRegisterId query param requerido', 400);

  const parsedStart = startDate ? new Date(startDate) : undefined;
  const parsedEnd = endDate ? new Date(endDate) : undefined;
  const grp: 'day' | 'month' = period === 'month' ? 'month' : 'day';

  const service = getService(req);
  const result = await service.cashStats({ cashRegisterId, startDate: parsedStart, endDate: parsedEnd, period: grp });
  res.json({ ok: true, data: normalize(result) });
});
