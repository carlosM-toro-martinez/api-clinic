import type { PrismaClient as TenantPrisma, Patient, Prisma } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export type PatientInput = {
  firstName: string;
  lastName: string;
  ciNumber?: string | null;
  birthDate?: string | Date | null;
  gender?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  insuranceInfo?: Prisma.InputJsonValue | undefined;
};

export class PatientService {
  constructor(private prisma: TenantPrisma) {}

  private includeRelations = {
    medicalHistories: true,
    appointments: true,
    prescriptions: true,
  };

  async create(data: PatientInput): Promise<Patient> {
    const payload: Prisma.PatientCreateInput = {
      firstName: data.firstName,
      lastName: data.lastName,
      ciNumber: data.ciNumber ?? null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      gender: data.gender ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      insuranceInfo: data.insuranceInfo ?? undefined
    };

    try {
      return await this.prisma.patient.create({
        data: payload,
        include: this.includeRelations,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new AppError('Patient with this CI number or email already exists', 409);
      }
      throw new AppError('Failed to create patient', 500);
    }
  }

  async list(page: number = 1, limit: number = 20): Promise<{
    items: Patient[];
    meta: { total: number; page: number; limit: number };
  }> {
    const skip = (page - 1) * limit;
    const take = Math.min(100, Math.max(1, limit));

    const [total, items] = await Promise.all([
      this.prisma.patient.count(),
      this.prisma.patient.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: this.includeRelations,
      }),
    ]);

    return { items, meta: { total, page, limit: take } };
  }

  async detail(id: string): Promise<Patient> {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: this.includeRelations,
    });

    if (!patient) throw new AppError('Patient not found', 404);
    return patient;
  }

  async update(id: string, data: Partial<PatientInput>): Promise<Patient> {
    await this.detail(id);

    const payload: Prisma.PatientUpdateInput = {
      ...data,
      birthDate: data.birthDate
        ? data.birthDate instanceof Date
          ? data.birthDate
          : new Date(data.birthDate)
        : undefined,
      insuranceInfo: data.insuranceInfo ?? undefined,
    };

    try {
      return await this.prisma.patient.update({
        where: { id },
        data: payload,
        include: this.includeRelations,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new AppError('Patient with this CI number or email already exists', 409);
      }
      throw new AppError('Failed to update patient', 500);
    }
  }

  async delete(id: string): Promise<void> {
    await this.detail(id);
    await this.prisma.patient.delete({ where: { id } });
  }
}
