import type { PrismaClient as TenantPrisma, FeeType } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export class SpecialtyService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  async create(data: {
    name: string;
    code?: string;
    description?: string;
    fees: Array<{
      feeType: FeeType;
      amount: number | string;
      currency?: string;
      description?: string;
    }>;
    schedules: Array<{
      doctorId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive?: boolean;
    }>;
  }): Promise<import('../../node_modules/.prisma/tenant-client').Specialty> {
    return await this.prisma.$transaction(async (tx) => {
      const specialty = await tx.specialty.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
        },
      });
      if (data.fees && data.fees.length > 0) {
        await tx.fee.createMany({
          data: data.fees.map(fee => ({
            specialtyId: specialty.id,
            feeType: fee.feeType,
            amount: fee.amount,
            currency: fee.currency || 'BOB',
            description: fee.description,
          })),
        });
      }
      if (data.schedules && data.schedules.length > 0) {
        await Promise.all(
          data.schedules.map(schedule => 
            tx.schedule.create({
              data: {
                doctorId: schedule.doctorId,
                specialtyId: specialty.id,
                dayOfWeek: schedule.dayOfWeek,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                isActive: schedule.isActive !== undefined ? schedule.isActive : true,
              },
            })
          )
        );
      }

      return specialty;
    });
  }

  async list(): Promise<import('../../node_modules/.prisma/tenant-client').Specialty[]> {
    return await this.prisma.specialty.findMany({
      include: {
        schedules: {
          include: {
            doctor: true,
          }
        },
        fees: true,
      }
    });
  }

  async detail(id: string): Promise<import('../../node_modules/.prisma/tenant-client').Specialty> {
    const specialty = await this.prisma.specialty.findUnique({ where: { id } });
    if (!specialty) throw new AppError('Especialidad no encontrada', 404);
    return specialty;
  }

  async update(id: string, data: any): Promise<import('../../node_modules/.prisma/tenant-client').Specialty> {
    return await this.prisma.specialty.update({ where: { id }, data });
  }

  async delete(id: string): Promise<import('../../node_modules/.prisma/tenant-client').Specialty> {
    return await this.prisma.specialty.delete({ where: { id } });
  }
}