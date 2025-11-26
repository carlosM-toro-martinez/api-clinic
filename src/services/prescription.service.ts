
import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export class PrescriptionService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  async create(data: any): Promise<import('../../node_modules/.prisma/tenant-client').Prescription> {
    return await this.prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: {
          ...data,
          medications: {
            create: data.medications || []
          }
        },
        include: { medications: true }
      });
      return prescription;
    });
  }

  async list(): Promise<import('../../node_modules/.prisma/tenant-client').Prescription[]> {
    return await this.prisma.prescription.findMany({ include: { medications: true, doctor: true, patient: true } });
  }

  async detail(id: string): Promise<import('../../node_modules/.prisma/tenant-client').Prescription> {
    const prescription = await this.prisma.prescription.findUnique({ where: { id }, include: { medications: true, doctor: true, patient: true } });
    if (!prescription) throw new AppError('Receta no encontrada', 404);
    return prescription;
  }

  async update(id: string, data: any): Promise<import('../../node_modules/.prisma/tenant-client').Prescription> {
    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.prescription.update({ where: { id }, data });
      return updated;
    });
  }

  async delete(id: string): Promise<import('../../node_modules/.prisma/tenant-client').Prescription> {
    // Hard delete: remove the record
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.prescription.delete({ where: { id } });
      return deleted;
    });
  }
}
