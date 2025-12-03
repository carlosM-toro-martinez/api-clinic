
import type { PrismaClient as TenantPrisma, Appointment, Prisma, AppointmentStatus } from '../../node_modules/.prisma/tenant-client';
import Decimal from 'decimal.js';
import { AppError } from '../utils/app.error';

export class AppointmentService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  async create(data: Prisma.AppointmentCreateInput & {
    userId?: string;
    cashRegisterId?: string;
    type?: 'INCOME' | 'EXPENSE';
    amount?: number;
    description?: string;
  }): Promise<Appointment> {
    return await this.prisma.$transaction(async (tx) => {
      const {
        userId,
        cashRegisterId,
        type,
        amount,
        description,
        ...appointmentData
      } = data;

      if (appointmentData.scheduledStart && typeof appointmentData.scheduledStart === 'string') {
        appointmentData.scheduledStart = new Date(appointmentData.scheduledStart);
      }

      const appointment = await tx.appointment.create({
        data: appointmentData as Prisma.AppointmentCreateInput
      });

      if (cashRegisterId && amount !== undefined && type && userId) {
        const cashRegister = await tx.cashRegister.findUnique({
          where: { id: cashRegisterId },
        });

        if (!cashRegister) {
          throw new AppError(`Cash register with ID ${cashRegisterId} not found`, 404);
        }

        if (cashRegister.status !== 'OPEN') {
          throw new AppError(`Cash register with ID ${cashRegisterId} is not open`, 400);
        }

        await tx.cashMovement.create({
          data: {
            cashRegisterId,
            userId,
            type,
            amount,
            description: `${description ?? ''} - Cita`,
          },
        });

        const currentAmount = new Decimal(cashRegister.actualAmount ?? 0);
        const movementAmount = new Decimal(amount);
        const newActualAmount = type === 'INCOME'
          ? currentAmount.plus(movementAmount)
          : currentAmount.minus(movementAmount);

        await tx.cashRegister.update({
          where: { id: cashRegisterId },
          data: {
            actualAmount: newActualAmount.toNumber(),
          },
        });
      }

      return appointment;
    });
  }

  async list(): Promise<Appointment[]> {
    return await this.prisma.appointment.findMany({ include: { patient: true, doctor: true, specialty: true, schedule: true } });
  }

  async findByDoctor(
    doctorId: string,
    filters?: {
      status?: AppointmentStatus;
    }
  ): Promise<Appointment[]> {

    const nowLaPaz = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/La_Paz" })
    );

    // Hoy a las 00:00
    const startOfToday = new Date(nowLaPaz);
    startOfToday.setHours(0, 0, 0, 0);

    // Una semana adelante
    const oneWeekLater = new Date(startOfToday);
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    oneWeekLater.setHours(23, 59, 59, 999);

    return await this.prisma.appointment.findMany({
      where: {
        doctorId: doctorId,

        // entre hoy y una semana adelante (zona Bolivia)
        scheduledStart: {
          gte: startOfToday,
          lte: oneWeekLater,
        },

        ...(filters?.status && {
          status: filters.status,
        }),
      },

      include: {
        patient: true,
        doctor: true,
        specialty: true,
        schedule: true,
      },

      orderBy: {
        scheduledStart: "asc",
      },
    });
  }


  async findByDoctorAll(doctorId: string, filters?: {
  startDate?: Date;
  endDate?: Date;
  status?: AppointmentStatus;
  }): Promise<Appointment[]> {
  return await this.prisma.appointment.findMany({
    where: {
      doctorId: doctorId,
      ...(filters?.startDate && {
        scheduledStart: {
          gte: filters.startDate
        }
      }),
      ...(filters?.endDate && {
        scheduledStart: {
          lte: filters.endDate
        }
      }),
      ...(filters?.status && {
        status: filters.status
      })
    },
    include: { 
      patient: true, 
      doctor: true, 
      specialty: true, 
      schedule: true 
    },
    orderBy: {
      scheduledStart: 'asc'
    }
  });
  }

  async findByPatient(
    patientId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: AppointmentStatus;
    }
  ): Promise<Appointment[]> {
    return await this.prisma.appointment.findMany({
      where: {
        patientId: patientId,
        ...(filters?.startDate && {
          scheduledStart: { gte: filters.startDate }
        }),
        ...(filters?.endDate && {
          scheduledStart: { lte: filters.endDate }
        }),
        ...(filters?.status && { status: filters.status })
      },
      include: {
        patient: true,
        doctor: true,
        specialty: true,
        schedule: true,
      },
      orderBy: { scheduledStart: 'asc' }
    });
  }

  async detail(id: string): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({ where: { id }, include: { patient: true, doctor: true, specialty: true } });
    if (!appointment) throw new AppError('Cita no encontrada', 404);
    return appointment;
  }

  async update(
    id: string,
    data: Prisma.AppointmentUpdateInput & {
      userId?: string;
      cashRegisterId?: string;
      type?: 'INCOME' | 'EXPENSE';
      amount?: number;
      description?: string;
    }
  ): Promise<Appointment> {
    
    return await this.prisma.$transaction(async (tx) => {
      const {
        userId,
        cashRegisterId,
        type,
        amount,
        description,
        ...appointmentData
      } = data as unknown as Record<string, unknown> & typeof data;
    console.log(cashRegisterId, amount, type, userId);

      if (
        (appointmentData as Prisma.AppointmentUpdateInput).scheduledStart &&
        typeof (appointmentData as any).scheduledStart === 'string'
      ) {
        (appointmentData as any).scheduledStart = new Date((appointmentData as any).scheduledStart);
      }

      const updated = await tx.appointment.update({ where: { id }, data: appointmentData as Prisma.AppointmentUpdateInput });

      if (cashRegisterId && amount !== undefined && type && userId) {
        const cashRegister = await tx.cashRegister.findUnique({ where: { id: cashRegisterId } });

        if (!cashRegister) {
          throw new AppError(`Cash register with ID ${cashRegisterId} not found`, 404);
        }

        if (cashRegister.status !== 'OPEN') {
          throw new AppError(`Cash register with ID ${cashRegisterId} is not open`, 400);
        }

        await tx.cashMovement.create({
          data: {
            cashRegisterId,
            userId,
            type,
            amount,
            description: `${description ?? ''} - Cita (actualización)`,
          },
        });

        const currentAmount = new Decimal(cashRegister.actualAmount ?? 0);
        const movementAmount = new Decimal(amount);
        const newActualAmount = type === 'INCOME' ? currentAmount.plus(movementAmount) : currentAmount.minus(movementAmount);

        await tx.cashRegister.update({
          where: { id: cashRegisterId },
          data: {
            actualAmount: newActualAmount.toNumber(),
          },
        });
      }

      return updated;
    });
  }

  async delete(id: string): Promise<Appointment> {
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.appointment.delete({ where: { id } });
      return deleted;
    });
  }
}
