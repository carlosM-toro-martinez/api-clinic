import type { Request, Response } from 'express';
import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';
import { asyncHandler } from '../utils/async.handler';
import { WhatsAppSenderService } from '../services/whatsapp.service';
import { AppointmentService } from '../services/appointment.service';

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

interface WhatsAppWebhook {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messages?: {
          from: string;
          text?: { body: string };
          type: string;
        }[];
      };
    }[];
  }[];
}

interface UserSession {
  phone: string;
  step:
    | 'inicio'
    | 'seleccion_servicio'
    | 'seleccion_especialidad'
    | 'proporcionar_fecha'
    | 'seleccion_horario'
    | 'verificacion_paciente'
    | 'registro_paciente'
    | 'confirmacion';

  selectedSpecialtyId?: string;
  selectedSpecialtyName?: string;
  appointmentDate?: string;

  selectedScheduleId?: string;
  selectedDoctorId?: string;
  selectedTime?: string;
  scheduledStart?: string;
  scheduledEnd?: string;

  patientId?: string;
  patientCI?: string;

  reservationAmount?: number;
  totalAmount?: number;
  remainingAmount?: number;

  lastInteraction: Date;
}

interface SpecialtyItem {
  id: string;
  name: string;
}

interface TimeSlot {
  scheduleId: string;
  doctorId: string;
  doctorName: string;
  startTime: string;
  endTime: string;
}

type CreateAppointmentPayload =
  Parameters<AppointmentService['create']>[0];

/* -------------------------------------------------------------------------- */

const userSessions = new Map<string, UserSession>();

const getPrismaClient = (req: Request): TenantPrisma => {
  const prisma = (req as any).prisma;
  if (!prisma) throw new Error('Prisma client not available');
  return prisma as TenantPrisma;
};

/* -------------------------------------------------------------------------- */
/*                               CONTROLLER                                   */
/* -------------------------------------------------------------------------- */

export class WhatsAppController {
  private static readonly sender = new WhatsAppSenderService();

  static receiveMessage = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as WhatsAppWebhook;
    res.status(200).json({ ok: true });

    setTimeout(() => {
      this.processIncomingMessage(req, body).catch(console.error);
    }, 0);
  });

  private static async processIncomingMessage(
    req: Request,
    body: WhatsAppWebhook
  ): Promise<void> {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== 'text') return;

    const phone = message.from;
    const text = message.text?.body ?? '';

    await this.handleUserMessage(req, phone, text.toLowerCase().trim());
  }

  private static async handleUserMessage(
    req: Request,
    phone: string,
    message: string
  ): Promise<void> {
    let session = userSessions.get(phone);

    if (!session || this.isSessionExpired(session)) {
      session = {
        phone,
        step: 'inicio',
        lastInteraction: new Date(),
      };
      userSessions.set(phone, session);
    } else {
      session.lastInteraction = new Date();
    }

    const prisma = getPrismaClient(req);

    switch (session.step) {
      case 'inicio':
        await this.sender.sendTextMessage(
          phone,
          '👋 Bienvenido\n\n*1* Agendar cita'
        );
        session.step = 'seleccion_servicio';
        break;

      case 'seleccion_servicio':
        session.step = 'seleccion_especialidad';
        await this.sender.sendTextMessage(phone, 'Cargando especialidades...');
        break;

      case 'seleccion_especialidad':
        await this.handleSpecialtySelection(prisma, phone, message, session);
        break;

      case 'proporcionar_fecha':
        await this.handleDateSelection(prisma, phone, message, session);
        break;

      case 'seleccion_horario':
        await this.handleTimeSlotSelection(prisma, phone, message, session);
        break;

      case 'verificacion_paciente':
        await this.handlePatientVerification(prisma, phone, message, session);
        break;

      case 'registro_paciente':
        await this.handlePatientRegistration(prisma, phone, message, session);
        break;

      case 'confirmacion':
        await this.handleConfirmation(prisma, phone, message, session);
        break;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                           SELECCIÓN ESPECIALIDAD                           */
  /* -------------------------------------------------------------------------- */

  private static async handleSpecialtySelection(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    const specialties: SpecialtyItem[] =
      await prisma.specialty.findMany({
        select: { id: true, name: true },
      });

    const index = Number(message) - 1;
    const selected = specialties[index];

    if (!selected) {
      const msg =
        'Especialidades:\n' +
        specialties.map((s, i) => `*${i + 1}* ${s.name}`).join('\n');
      await this.sender.sendTextMessage(phone, msg);
      return;
    }

    session.selectedSpecialtyId = selected.id;
    session.selectedSpecialtyName = selected.name;
    session.step = 'proporcionar_fecha';

    await this.sender.sendTextMessage(
      phone,
      `✅ ${selected.name}\n\nIngresa fecha DD/MM/AAAA`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                                 FECHA                                      */
  /* -------------------------------------------------------------------------- */

  private static async handleDateSelection(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    const [day, month, year] = message.split('/');
    if (!day || !month || !year || !session.selectedSpecialtyId) return;

    session.appointmentDate = message;

    const date = new Date(`${year}-${month}-${day}`);

    const slots = await this.getAvailableTimeSlots(
      prisma,
      session.selectedSpecialtyId,
      date
    );

    if (!slots.length) {
      await this.sender.sendTextMessage(phone, '❌ No hay horarios disponibles');
      return;
    }

    const msg =
      'Horarios disponibles:\n' +
      slots
        .map(
          (s, i) =>
            `*${i + 1}* ${s.startTime} - ${s.endTime} Dr. ${s.doctorName}`
        )
        .join('\n');

    session.step = 'seleccion_horario';
    await this.sender.sendTextMessage(phone, msg);
  }

  /* -------------------------------------------------------------------------- */
  /*                               HORARIOS                                     */
  /* -------------------------------------------------------------------------- */

  private static async getAvailableTimeSlots(
    prisma: TenantPrisma,
    specialtyId: string,
    date: Date
  ): Promise<TimeSlot[]> {
    const schedules = await prisma.schedule.findMany({
      where: { specialtyId, isActive: true },
      include: { doctor: true },
    });

    return schedules.map((s: typeof schedules[number]) => ({
      scheduleId: s.id,
      doctorId: s.doctorId,
      doctorName: `${s.doctor.firstName} ${s.doctor.lastName}`,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }

  /* -------------------------------------------------------------------------- */
  /*                          SELECCIÓN HORARIO                                 */
  /* -------------------------------------------------------------------------- */

  private static async handleTimeSlotSelection(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    if (!session.selectedSpecialtyId || !session.appointmentDate) return;

    const date = new Date(
      session.appointmentDate.split('/').reverse().join('-')
    );

    const slots = await this.getAvailableTimeSlots(
      prisma,
      session.selectedSpecialtyId,
      date
    );

    const slot = slots[Number(message) - 1];
    if (!slot) return;

    session.selectedScheduleId = slot.scheduleId;
    session.selectedDoctorId = slot.doctorId;
    session.selectedTime = `${slot.startTime}-${slot.endTime}`;

    session.scheduledStart = `${date.toISOString().split('T')[0]}T${slot.startTime}`;
    session.scheduledEnd = `${date.toISOString().split('T')[0]}T${slot.endTime}`;

    session.step = 'verificacion_paciente';

    await this.sender.sendTextMessage(
      phone,
      'Ingrese su número de CI para verificar paciente'
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                        VERIFICACIÓN PACIENTE                               */
  /* -------------------------------------------------------------------------- */

  private static async handlePatientVerification(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    const ci = message.trim();

    const patient = await prisma.patient.findFirst({
      where: { ciNumber: ci },
    });

    if (patient) {
      session.patientId = patient.id;
      session.step = 'confirmacion';

      await this.sender.sendTextMessage(
        phone,
        `👤 Paciente encontrado:\n${patient.firstName} ${patient.lastName}\n\n¿Confirmar cita? (SI / NO)`
      );
      return;
    }

    session.patientCI = ci;
    session.step = 'registro_paciente';

    await this.sender.sendTextMessage(
      phone,
      'Paciente no encontrado.\nIngrese: Nombres Apellidos'
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                         REGISTRO PACIENTE                                  */
  /* -------------------------------------------------------------------------- */

  private static async handlePatientRegistration(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    if (!session.patientCI) return;

    const [firstName, ...rest] = message.split(' ');
    const lastName = rest.join(' ');

    if (!firstName || !lastName) {
      await this.sender.sendTextMessage(
        phone,
        '❌ Formato inválido. Ej: Juan Pérez'
      );
      return;
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        ciNumber: session.patientCI,
      },
    });

    session.patientId = patient.id;
    session.step = 'confirmacion';

    await this.sender.sendTextMessage(
      phone,
      '✅ Paciente registrado\n\n¿Confirmar cita? (SI / NO)'
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                              CONFIRMACIÓN                                  */
  /* -------------------------------------------------------------------------- */

  private static async handleConfirmation(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    if (message !== 'si') {
      await this.sender.sendTextMessage(phone, '❌ Cita cancelada');
      userSessions.delete(phone);
      return;
    }

    if (
      !session.patientId ||
      !session.selectedDoctorId ||
      !session.selectedSpecialtyId ||
      !session.selectedScheduleId ||
      !session.scheduledStart ||
      !session.scheduledEnd
    ) {
      await this.sender.sendTextMessage(
        phone,
        '❌ Error interno al crear la cita'
      );
      userSessions.delete(phone);
      return;
    }

    const appointmentService = new AppointmentService(prisma);

    const payload: CreateAppointmentPayload = {
      patient: {
        connect: { id: session.patientId },
      },
      doctor: {
        connect: { id: session.selectedDoctorId },
      },
      specialty: {
        connect: { id: session.selectedSpecialtyId },
      },
      schedule: {
        connect: { id: session.selectedScheduleId },
      },

      scheduledStart: new Date(session.scheduledStart),
      scheduledEnd: new Date(session.scheduledEnd),

      source: 'whatsapp',
      status: 'PENDING',

      amount: session.reservationAmount,
      description: `Consulta ${session.selectedSpecialtyName ?? ''}`,
    };


    await appointmentService.create(payload);

    await this.sender.sendTextMessage(
      phone,
      '✅ Cita creada correctamente\n\nGracias por contactarnos 🙌'
    );

    userSessions.delete(phone);
  }

  /* -------------------------------------------------------------------------- */
  /*                               UTILIDAD                                     */
  /* -------------------------------------------------------------------------- */

  private static isSessionExpired(session: UserSession): boolean {
    return Date.now() - session.lastInteraction.getTime() > 10 * 60 * 1000;
  }
}
