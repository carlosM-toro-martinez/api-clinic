import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';

export class ReportService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  // 1. Pacientes por diagnóstico de cada especialidad
  async patientsByDiagnosis() {
    // Usamos Prisma para traer EntryDiagnosis con relaciones y luego agregamos en JS
    const entries = await this.prisma.entryDiagnosis.findMany({
      include: {
        historyEntry: {
          include: {
            history: {
              include: {
                specialty: true,
              },
            },
          },
        },
        diagnosis: true,
      },
    });

    const map = new Map<string, { specialtyId: string; specialtyName: string | null; diagnosisId: string; diagnosisName: string | null; patients: Set<string> }>();

    for (const e of entries) {
      const history = e.historyEntry?.history;
      const specialtyId = history?.specialtyId;
      const specialtyName = history?.specialty?.name ?? null;
      const diagnosisId = e.diagnosisId;
      const diagnosisName = e.diagnosis?.name ?? null;
      const patientId = history?.patientId;

      if (!specialtyId || !diagnosisId || !patientId) continue;

      const key = `${specialtyId}|${diagnosisId}`;
      if (!map.has(key)) {
        map.set(key, { specialtyId, specialtyName, diagnosisId, diagnosisName, patients: new Set() });
      }
      map.get(key)!.patients.add(patientId);
    }

    const result = Array.from(map.values()).map((r) => ({
      specialtyId: r.specialtyId,
      specialtyName: r.specialtyName,
      diagnosisId: r.diagnosisId,
      diagnosisName: r.diagnosisName,
      patientCount: r.patients.size,
    }));

    // Ordenamos por specialtyName, diagnosisName
    result.sort((a, b) => {
      const s = (a.specialtyName ?? '').localeCompare(b.specialtyName ?? '');
      if (s !== 0) return s;
      return (a.diagnosisName ?? '').localeCompare(b.diagnosisName ?? '');
    });

    return result;
  }

  // 2. Cantidad de citas semanales por especialidad
  async weeklyAppointmentsBySpecialty(startDate?: Date, endDate?: Date) {
    const now = new Date();
    const defaultEnd = endDate ?? now;
    const defaultStart = startDate ?? new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7 * 4); // últimas 4 semanas

    const appts = await this.prisma.appointment.findMany({
      where: {
        scheduledStart: {
          gte: defaultStart,
          lte: defaultEnd,
        },
      },
      include: { specialty: true },
      orderBy: { scheduledStart: 'asc' },
    });

    const weekStartOfDate = (d: Date) => {
      const date = new Date(d);
      // Obtener inicio de semana (lunes) en UTC para imitar date_trunc('week', ...)
      const day = date.getUTCDay(); // 0 = Sunday
      const daysToMonday = (day + 6) % 7; // 0->6, 1->0, 2->1, ..., 6->5
      date.setUTCDate(date.getUTCDate() - daysToMonday);
      date.setUTCHours(0, 0, 0, 0);
      return date.toISOString().substring(0, 10);
    };

    const map = new Map<string, { specialtyId: string; specialtyName: string | null; weekStart: string; count: number }>();

    for (const a of appts) {
      const specialtyId = a.specialtyId;
      const specialtyName = a.specialty?.name ?? null;
      const weekStart = weekStartOfDate(a.scheduledStart);
      const key = `${specialtyId}|${weekStart}`;
      if (!map.has(key)) map.set(key, { specialtyId, specialtyName, weekStart, count: 0 });
      map.get(key)!.count += 1;
    }

    const result = Array.from(map.values());
    result.sort((a, b) => {
      const s = (a.specialtyName ?? '').localeCompare(b.specialtyName ?? '');
      if (s !== 0) return s;
      return a.weekStart.localeCompare(b.weekStart);
    });

    return result;
  }

  // 3. Estadísticas generales de pacientes
  async patientsGeneralStats() {
    const now = new Date();

    // Total
    const total = await this.prisma.patient.count({ where: { deletedAt: null } });

    // Por género (groupBy)
    const genders = await this.prisma.patient.groupBy({
      by: ['gender'],
      _count: { _all: true },
      where: { deletedAt: null },
    });
    const byGender = genders.map((g) => ({ gender: g.gender ?? 'unknown', count: g._count._all }));

    // Nuevos en última semana / mes
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newLastWeek = await this.prisma.patient.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } });
    const newLastMonth = await this.prisma.patient.count({ where: { deletedAt: null, createdAt: { gte: monthAgo } } });

    // Por rangos de edad calculando fechas límite
    const date18 = new Date(now); date18.setFullYear(now.getFullYear() - 18);
    const date35 = new Date(now); date35.setFullYear(now.getFullYear() - 35);
    const date50 = new Date(now); date50.setFullYear(now.getFullYear() - 50);

    const countUnder18 = await this.prisma.patient.count({ where: { deletedAt: null, birthDate: { gt: date18 } } });
    const count18_35 = await this.prisma.patient.count({ where: { deletedAt: null, birthDate: { lte: date18, gte: date35 } } });
    const count36_50 = await this.prisma.patient.count({ where: { deletedAt: null, birthDate: { lte: date35, gte: date50 } } });
    const count50plus = await this.prisma.patient.count({ where: { deletedAt: null, birthDate: { lte: date50 } } });
    const unknownBirth = await this.prisma.patient.count({ where: { deletedAt: null, birthDate: null } });

    const byAgeGroup = [
      { ageGroup: '<18', count: countUnder18 },
      { ageGroup: '18-35', count: count18_35 },
      { ageGroup: '36-50', count: count36_50 },
      { ageGroup: '50+', count: count50plus },
      { ageGroup: 'unknown', count: unknownBirth },
    ];

    return {
      total,
      byGender,
      newLastWeek,
      newLastMonth,
      byAgeGroup,
    };
  }

  // 4. Estadísticas de caja por día o por mes para un cashRegister específico
  async cashStats(options: { cashRegisterId: string; startDate?: Date; endDate?: Date; period?: 'day' | 'month' }) {
    const { cashRegisterId, startDate, endDate, period = 'day' } = options;
    const now = new Date();
    const defaultEnd = endDate ?? now;
    const defaultStart = startDate ?? new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7); // última semana por defecto

    if (!cashRegisterId) throw new Error('cashRegisterId requerido');

    const trunc = period === 'month' ? "date_trunc('month', \"CashMovement\".\"createdAt\")::date" : "date_trunc('day', \"CashMovement\".\"createdAt\")::date";

    const sql = `
      SELECT
        ${trunc} AS "period",
        SUM(CASE WHEN "CashMovement"."type" = 'INCOME' THEN "CashMovement"."amount" ELSE 0 END) AS "income",
        SUM(CASE WHEN "CashMovement"."type" = 'EXPENSE' THEN "CashMovement"."amount" ELSE 0 END) AS "expense",
        SUM(CASE WHEN "CashMovement"."type" = 'INCOME' THEN "CashMovement"."amount" ELSE -"CashMovement"."amount" END) AS "net"
      FROM "CashMovement"
      WHERE "CashMovement"."cashRegisterId" = $1
        AND "CashMovement"."createdAt" BETWEEN $2 AND $3
      GROUP BY "period"
      ORDER BY "period";
    `;

    const rows = await this.prisma.$queryRawUnsafe(sql, cashRegisterId, defaultStart, defaultEnd) as any;

    return rows;
  }
}
