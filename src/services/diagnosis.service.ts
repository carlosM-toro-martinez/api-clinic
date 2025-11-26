
import type { PrismaClient as TenantPrisma, Diagnosis, Prisma } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export class DiagnosisService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

async createMany(diagnosesData: Prisma.DiagnosisCreateInput[]): Promise<Prisma.BatchPayload> {
  return await this.prisma.diagnosis.createMany({
    data: diagnosesData,
    skipDuplicates: true
  });
}

  async list(): Promise<Diagnosis[]> {
    return await this.prisma.diagnosis.findMany();
  }

  async detail(id: string): Promise<Diagnosis> {
    const diagnosis = await this.prisma.diagnosis.findUnique({ where: { id } });
    if (!diagnosis) throw new AppError('Diagnóstico no encontrado', 404);
    return diagnosis;
  }

  async update(id: string, data: Prisma.DiagnosisUpdateInput): Promise<Diagnosis> {
    return await this.prisma.diagnosis.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Diagnosis> {
    // Hard delete: remove the record
    return await this.prisma.diagnosis.delete({ where: { id } });
  }
}
