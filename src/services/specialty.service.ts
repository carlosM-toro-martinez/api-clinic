import type { PrismaClient as TenantPrisma, FeeType, Fee, Schedule } from '../../node_modules/.prisma/tenant-client';
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

  async addFees(
    specialtyId: string,
    fees: Array<{
      feeType: FeeType;
      amount: number | string;
      currency?: string;
      description?: string;
    }>
  ): Promise<Fee[]> {
    const specialty = await this.prisma.specialty.findUnique({ where: { id: specialtyId } });
    if (!specialty) throw new AppError('Especialidad no encontrada', 404);

    return await this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        fees.map(fee =>
          tx.fee.create({
            data: {
              specialtyId: specialtyId,
              feeType: fee.feeType,
              amount: typeof fee.amount === 'string' ? parseFloat(fee.amount) : fee.amount,
              currency: fee.currency || 'BOB',
              description: fee.description,
            },
          })
        )
      );
      return created;
    });
  }

  async addSchedules(
    specialtyId: string,
    schedules: Array<{
      doctorId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive?: boolean;
    }>
  ): Promise<Schedule[]> {
    const specialty = await this.prisma.specialty.findUnique({ where: { id: specialtyId } });
    if (!specialty) throw new AppError('Especialidad no encontrada', 404);

    return await this.prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        schedules.map(sch =>
          tx.schedule.create({
            data: {
              doctorId: sch.doctorId,
              specialtyId: specialtyId,
              dayOfWeek: sch.dayOfWeek,
              startTime: sch.startTime,
              endTime: sch.endTime,
              isActive: sch.isActive !== undefined ? sch.isActive : true,
            },
          })
        )
      );
      return created;
    });
  }

  async updateFee(
    specialtyId: string,
    feeId: string,
    data: {
      feeType?: FeeType;
      amount?: number | string;
      currency?: string;
      description?: string;
    }
  ): Promise<Fee> {
    const fee = await this.prisma.fee.findUnique({ where: { id: feeId } });
    if (!fee || fee.specialtyId !== specialtyId) throw new AppError('Fee no encontrado', 404);

    const updateData: any = {};
    if (data.feeType !== undefined) updateData.feeType = data.feeType;
    if (data.amount !== undefined) updateData.amount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.description !== undefined) updateData.description = data.description;

    if (Object.keys(updateData).length === 0) throw new AppError('No hay campos para actualizar', 400);

    return await this.prisma.fee.update({ where: { id: feeId }, data: updateData });
  }

  async deleteFee(specialtyId: string, feeId: string): Promise<Fee> {
    const fee = await this.prisma.fee.findUnique({ where: { id: feeId } });
    if (!fee || fee.specialtyId !== specialtyId) throw new AppError('Fee no encontrado', 404);
    return await this.prisma.fee.delete({ where: { id: feeId } });
  }

  async updateSchedule(
    specialtyId: string,
    scheduleId: string,
    data: {
      doctorId?: string;
      dayOfWeek?: number;
      startTime?: string;
      endTime?: string;
      isActive?: boolean;
    }
  ): Promise<Schedule> {
    const schedule = await this.prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule || schedule.specialtyId !== specialtyId) throw new AppError('Horario no encontrado', 404);

    const updateData: any = {};
    if (data.doctorId !== undefined) updateData.doctorId = data.doctorId;
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (Object.keys(updateData).length === 0) throw new AppError('No hay campos para actualizar', 400);

    return await this.prisma.schedule.update({ where: { id: scheduleId }, data: updateData });
  }

  async deleteSchedule(specialtyId: string, scheduleId: string): Promise<Schedule> {
    const schedule = await this.prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!schedule || schedule.specialtyId !== specialtyId) throw new AppError('Horario no encontrado', 404);
    return await this.prisma.schedule.delete({ where: { id: scheduleId } });
  }

  async deleteSchedulesBulk(specialtyId: string, scheduleIds: string[]): Promise<{ count: number }> {
    const validIds = scheduleIds.filter(id => typeof id === 'string' && id.trim().length > 0);
    if (validIds.length === 0) throw new AppError('Se requiere un arreglo de scheduleIds', 400);

    const result = await this.prisma.schedule.deleteMany({
      where: {
        specialtyId,
        id: { in: validIds },
      },
    });
    return { count: result.count };
  }

  async delete(id: string): Promise<import('../../node_modules/.prisma/tenant-client').Specialty> {
    return await this.prisma.specialty.delete({ where: { id } });
  }
}
