import type { Request, Response } from 'express';
import type { PrismaClient as TenantPrisma, Prisma } from '../../node_modules/.prisma/tenant-client';
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
  step: 'inicio' | 'especialidades' | 'fecha' | 'horarios' | 'verificacion' | 'registro' | 'confirmacion' | 'final';
  selectedSpecialtyId?: string;
  selectedSpecialtyName?: string;
  appointmentDate?: string;
  appointmentDateObj?: Date;
  selectedScheduleId?: string;
  selectedDoctorId?: string;
  selectedDoctorName?: string;
  selectedTime?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  patientId?: string;
  patientCI?: string;
  patientFirstName?: string;
  patientLastName?: string;
  reservationAmount?: number;
  totalAmount?: number;
  remainingAmount?: number;
  lastInteraction: Date;
}

const userSessions = new Map<string, UserSession>();

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

    await this.handleUserMessage(req, phone, text.trim());
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
    }

    session.lastInteraction = new Date();

    const prisma = (req as any).prisma;
    if (!prisma) throw new Error('Prisma client not available');

    if (message.toLowerCase() === 'cancelar') {
      userSessions.delete(phone);
      await this.sender.sendTextMessage(phone, '✅ Proceso cancelado. ¡Hasta luego!');
      return;
    }

    try {
      switch (session.step) {
        case 'inicio':
          await this.handleInicio(phone, session);
          break;
        case 'especialidades':
          await this.handleEspecialidades(prisma, phone, message, session);
          break;
        case 'fecha':
          await this.handleFecha(prisma, phone, message, session);
          break;
        case 'horarios':
          await this.handleHorarios(prisma, phone, message, session);
          break;
        case 'verificacion':
          await this.handleVerificacion(prisma, phone, message, session);
          break;
        case 'registro':
          await this.handleRegistro(prisma, phone, message, session);
          break;
        case 'confirmacion':
          await this.handleConfirmacion(prisma, phone, message, session);
          break;
        case 'final':
          userSessions.delete(phone);
          break;
      }
    } catch (error) {
      console.error(`Error en paso ${session.step}:`, error);
      await this.sender.sendTextMessage(phone, '❌ Ocurrió un error. Por favor, intenta nuevamente.');
      userSessions.delete(phone);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                 PASO 1: INICIO                             */
  /* -------------------------------------------------------------------------- */

  private static async handleInicio(
    phone: string,
    session: UserSession
  ): Promise<void> {
    const mensaje = `¡Hola! 👋 Bienvenido/a a **Clínica Endovel**.\n\n` +
      `Estoy aquí para ayudarte a gestionar` +
      `tus citas médicas de manera rápida y sencilla.\n\n` +
      `Para comenzar, por favor elige una de las siguientes opciones:\n\n` +
      `*1* – Agendar una nueva cita médica\n\n` +
      `*Escribe el número correspondiente a tu elección.*\n\n` +
      `Si en cualquier momento deseas detener el proceso, solo escribe **"cancelar"** ` +
      `¡Estoy aquí para asistirte! 💙`;

    await this.sender.sendTextMessage(phone, mensaje);
    session.step = 'especialidades';
  }

  /* -------------------------------------------------------------------------- */
  /*                         PASO 2: ESPECIALIDADES                            */
  /* -------------------------------------------------------------------------- */

  private static async handleEspecialidades(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    // Solo procesar si el mensaje es "1" (agendar cita)
    if (message !== '1') {
      await this.sender.sendTextMessage(phone, '❌ Opción no válida. Por favor escribe *1* para agendar una cita.');
      return;
    }

    const specialties = await prisma.specialty.findMany({
      select: {
        id: true,
        name: true,
        fees: {
          where: {
            feeType: 'INITIAL'
          },
          select: {
            amount: true,
            currency: true,
            description: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });


    if (specialties.length === 0) {
      await this.sender.sendTextMessage(phone, 
        '❌ Actualmente no hay especialidades disponibles para agendar citas.\n\n' +
        'Por favor, intenta más tarde o contacta directamente con nuestra recepción.\n\n' +
        '📞 Teléfono: (123) 456-7890\n' +
        '✉️ Email: citas@endovel.com\n\n' +
        '**Escribe "cancelar" para finalizar.**'
      );
      userSessions.delete(phone);
      return;
    }

    let mensaje = '🏥 *Especialidades Médicas Disponibles*\n\n';
    mensaje += 'A continuación, selecciona la especialidad que necesitas consultar:\n\n';
    specialties.forEach((spec, index) => {
      const fee = spec.fees[0];
      let priceInfo = '';
      
      if (fee) {
        const amountNumber = fee.amount.toNumber();
        const formattedPrice = new Intl.NumberFormat('es-BO', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amountNumber);
        
        priceInfo = ` - *${formattedPrice} ${fee.currency}*`;
      } else {
        priceInfo = ' - *Consultar precio*';
      }
      
      mensaje += `*${index + 1}* - ${spec.name}${priceInfo}\n`;
    });

    mensaje += '\n---\n';
    mensaje += '*¿Cómo proceder?*\n\n';
    mensaje += '*Escribe el número de la especialidad de tu interés.*\n';
    mensaje += 'O escribe **"cancelar"** para detener el proceso.';

    // Guardar especialidades en la sesión temporalmente
    (session as any).specialties = specialties;
    session.step = 'fecha';
    await this.sender.sendTextMessage(phone, mensaje);
  }
  /* -------------------------------------------------------------------------- */
  /*                          PASO 3: FECHA                                    */
  /* -------------------------------------------------------------------------- */

  private static async handleFecha(
    prisma: TenantPrisma,  // Añadimos prisma como parámetro
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    // Primero, verificar si ya tenemos una especialidad seleccionada
    if (!session.selectedSpecialtyId || !session.selectedSpecialtyName) {
      // Si no hay especialidad seleccionada, el mensaje debería ser la selección de especialidad
      const specialties: Array<{ id: string; name: string }> | undefined = (session as any).specialties;
      
      if (!specialties || !Array.isArray(specialties)) {
        await this.sender.sendTextMessage(phone, '❌ Error: No se encontraron especialidades. Por favor, comienza de nuevo.');
        session.step = 'inicio';
        return;
      }
      
      const index = parseInt(message) - 1;
      
      if (isNaN(index) || index < 0 || index >= specialties.length) {
        let mensaje = '❌ Número inválido. Especialidades disponibles:\n\n';
        specialties.forEach((spec, i) => {
          mensaje += `*${i + 1}* - ${spec.name}\n`;
        });
        mensaje += '\n*Escribe el número de la especialidad que deseas.*';
        await this.sender.sendTextMessage(phone, mensaje);
        return;
      }
      
      const selected = specialties[index];
      if (!selected) {
        await this.sender.sendTextMessage(phone, '❌ Selección inválida.');
        return;
      }

      session.selectedSpecialtyId = selected.id;
      session.selectedSpecialtyName = selected.name;
      
      // Limpiar datos temporales
      delete (session as any).specialties;
      
      await this.sender.sendTextMessage(
        phone,
        `✅ Especialidad: *${selected.name}*\n\n` +
        `Ahora ingresa la fecha para tu cita en formato *DD/MM/AAAA*\n\n` +
        `Ejemplo: *05/09/2024*`
      );
      return;
    }
    
    // Si ya tenemos especialidad seleccionada, entonces el mensaje debe ser la fecha
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = message.match(dateRegex);
    
    if (!match) {
      await this.sender.sendTextMessage(
        phone,
        '❌ Formato de fecha incorrecto.\n\n' +
        'Por favor ingresa la fecha en formato *DD/MM/AAAA*\n' +
        'Ejemplo: *15/12/2024*'
      );
      return;
    }
    
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month}-${day}`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Validaciones
    if (isNaN(date.getTime())) {
      await this.sender.sendTextMessage(phone, '❌ Fecha inválida. Intenta nuevamente.');
      return;
    }
    
    if (date < today) {
      await this.sender.sendTextMessage(phone, '❌ No puedes agendar citas en fechas pasadas.');
      return;
    }
    
    // Verificar que no sea domingo (0 es domingo, 6 es sábado)
    if (date.getDay() === 0) {
      await this.sender.sendTextMessage(phone, '❌ No atendemos los domingos. Por favor elige otro día.');
      return;
    }
    
    session.appointmentDate = `${day}/${month}/${year}`;
    session.appointmentDateObj = date;
    session.step = 'horarios';
    
    // Llamar directamente a handleHorarios para cargar y mostrar horarios
    await this.cargarYMostrarHorarios(prisma, phone, session);
  }

  /* -------------------------------------------------------------------------- */
  /*                         PASO 4: HORARIOS (Carga inicial)                   */
  /* -------------------------------------------------------------------------- */

  private static async cargarYMostrarHorarios(
    prisma: TenantPrisma,
    phone: string,
    session: UserSession
  ): Promise<void> {
    if (!session.selectedSpecialtyId || !session.appointmentDateObj) {
      await this.sender.sendTextMessage(phone, '❌ Error interno. Faltan datos.');
      session.step = 'inicio';
      return;
    }

    const date = session.appointmentDateObj;
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Domingo = 7

    // Obtener schedules activos
    const schedules = await prisma.schedule.findMany({
      where: {
        specialtyId: session.selectedSpecialtyId,
        dayOfWeek,
        isActive: true,
      },
      include: {
        doctor: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Obtener citas ya agendadas para esa fecha y especialidad
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        specialtyId: session.selectedSpecialtyId,
        scheduledStart: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      },
      select: { scheduleId: true }
    });

    const ocupados = new Set(appointments.map(a => a.scheduleId));

    // Filtrar horarios disponibles
    const disponibles = schedules.filter(s => !ocupados.has(s.id));

    if (disponibles.length === 0) {
      await this.sender.sendTextMessage(
        phone,
        `❌ No hay horarios disponibles para *${session.selectedSpecialtyName}* el *${session.appointmentDate}*.\n\n` +
        `Por favor, escribe una nueva fecha en formato *DD/MM/AAAA* o escribe *cancelar* para salir.`
      );
      // Cambiar al paso de fecha para permitir nueva fecha
      session.step = 'fecha';
      return;
    }

    // Guardar horarios en sesión
    (session as any).horarios = disponibles.map(s => ({
      id: s.id,
      doctorId: s.doctorId,
      doctorName: `${s.doctor.firstName} ${s.doctor.lastName}`,
      start: s.startTime,
      end: s.endTime,
    }));

    let mensaje = `⏰ *Horarios disponibles para ${session.appointmentDate}:*\n\n`;
    (session as any).horarios.forEach((h: any, i: number) => {
      mensaje += `*${i + 1}* - ${h.start} a ${h.end} (Dr. ${h.doctorName})\n`;
    });
    mensaje += '\n*Escribe el número del horario que prefieres.*';

    await this.sender.sendTextMessage(phone, mensaje);
  }

  /* -------------------------------------------------------------------------- */
  /*                         PASO 4: HORARIOS (Selección)                       */
  /* -------------------------------------------------------------------------- */

  private static async handleHorarios(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    // Manejar el caso de 'reiniciar' para volver a seleccionar fecha
    if (message.toLowerCase() === 'reiniciar') {
      session.step = 'fecha';
      await this.sender.sendTextMessage(
        phone,
        `Reiniciando selección de fecha.\n\n` +
        `Por favor, ingresa una nueva fecha en formato *DD/MM/AAAA*\n\n` +
        `Ejemplo: *15/12/2024*`
      );
      return;
    }

    const horarios: Array<any> = (session as any).horarios || [];
    
    // Si no hay horarios cargados, cargarlos
    if (horarios.length === 0) {
      await this.cargarYMostrarHorarios(prisma, phone, session);
      return;
    }

    const index = parseInt(message) - 1;

    if (isNaN(index) || index < 0 || index >= horarios.length) {
      let mensaje = '❌ Número inválido. Horarios disponibles:\n\n';
      horarios.forEach((h, i) => {
        mensaje += `*${i + 1}* - ${h.start} a ${h.end} (Dr. ${h.doctorName})\n`;
      });
      mensaje += '\n*Escribe el número del horario que prefieres.*';
      await this.sender.sendTextMessage(phone, mensaje);
      return;
    }

    const seleccionado = horarios[index];
    session.selectedScheduleId = seleccionado.id;
    session.selectedDoctorId = seleccionado.doctorId;
    session.selectedDoctorName = seleccionado.doctorName;
    session.selectedTime = `${seleccionado.start} - ${seleccionado.end}`;

    // Calcular fechas completas
    const fecha = session.appointmentDateObj!;
    const [horaInicio, minutoInicio] = seleccionado.start.split(':').map(Number);
    const [horaFin, minutoFin] = seleccionado.end.split(':').map(Number);

    const inicio = new Date(fecha);
    inicio.setHours(horaInicio, minutoInicio, 0, 0);
    
    const fin = new Date(fecha);
    fin.setHours(horaFin, minutoFin, 0, 0);

    session.scheduledStart = inicio;
    session.scheduledEnd = fin;

    // Limpiar datos temporales
    (session as any).horarios = undefined;
    session.step = 'verificacion';

    await this.sender.sendTextMessage(
      phone,
      `✅ Horario seleccionado: *${session.selectedTime}*\n\n` +
      `Ahora necesitamos verificar tus datos.\n\n` +
      `Por favor, ingresa tu *número de carnet (CI)*:\n\n` +
      `Ejemplo: *1234567*`
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                     PASO 5: VERIFICACIÓN PACIENTE                         */
  /* -------------------------------------------------------------------------- */

  private static async handleVerificacion(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    const ci = message.trim().toUpperCase();

    // Buscar paciente por CI
    const paciente = await prisma.patient.findFirst({
      where: { ciNumber: ci }
    });

    if (paciente) {
      // Paciente encontrado
      session.patientId = paciente.id;
      session.patientCI = paciente.ciNumber || undefined;
      session.patientFirstName = paciente.firstName;
      session.patientLastName = paciente.lastName;
      session.step = 'confirmacion';

      await this.mostrarResumen(phone, session);
      return;
    }

    // Paciente no encontrado
    session.patientCI = ci;
    session.step = 'registro';

    await this.sender.sendTextMessage(
      phone,
      '📝 *Registro de nuevo paciente*\n\n' +
      'No encontramos tu CI en nuestro sistema.\n\n' +
      'Por favor, ingresa tu *nombre completo* (nombre y apellido):\n\n' +
      'Ejemplo: *Juan Pérez García*'
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                      PASO 6: REGISTRO PACIENTE                            */
  /* -------------------------------------------------------------------------- */

  private static async handleRegistro(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    const nombreCompleto = message.trim();
    const partes = nombreCompleto.split(' ');

    if (partes.length < 2) {
      await this.sender.sendTextMessage(
        phone,
        '❌ Formato incorrecto.\n\n' +
        'Por favor ingresa tu nombre completo con al menos un nombre y un apellido.\n\n' +
        'Ejemplo: *Juan Pérez García*'
      );
      return;
    }

    const nombre = partes[0];
    const apellido = partes.slice(1).join(' ');

    try {
      if (!nombre || !apellido || !session?.patientCI) {
        throw new Error('Datos del paciente incompletos');
      }

      const paciente = await prisma.patient.create({
        data: {
          firstName: nombre,
          lastName: apellido,
          ciNumber: session.patientCI,
          phone: phone.replace('+', ''),
        }
      });

      session.patientId = paciente.id;
      session.patientFirstName = paciente.firstName;
      session.patientLastName = paciente.lastName;
      session.step = 'confirmacion';

      await this.mostrarResumen(phone, session);
    } catch (error) {
      console.error('Error al crear paciente:', error);
      await this.sender.sendTextMessage(
        phone,
        '❌ Error al registrar. Intenta nuevamente o contacta recepción.'
      );
      session.step = 'inicio';
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                    PASO 7: CONFIRMACIÓN FINAL                             */
  /* -------------------------------------------------------------------------- */

  private static async mostrarResumen(
    phone: string,
    session: UserSession
  ): Promise<void> {
    session.reservationAmount = 150;
    session.totalAmount = 150;
    session.remainingAmount = 0;

    const resumen = 
      `📋 *RESUMEN DE LA CITA*\n\n` +
      `• *Especialidad:* ${session.selectedSpecialtyName}\n` +
      `• *Fecha:* ${session.appointmentDate}\n` +
      `• *Horario:* ${session.selectedTime}\n` +
      `• *Doctor:* ${session.selectedDoctorName}\n` +
      `• *Paciente:* ${session.patientFirstName} ${session.patientLastName}\n` +
      `• *CI:* ${session.patientCI}\n` +
      `• *Monto a pagar:* ${session.reservationAmount} BOB\n\n` +
      `¿Confirmas la reserva de esta cita?\n\n` +
      `Responde *SI* para confirmar o *NO* para cancelar.`;

    await this.sender.sendTextMessage(phone, resumen);
  }

  private static async handleConfirmacion(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void> {
    const respuesta = message.toLowerCase();

    if (respuesta !== 'si') {
      await this.sender.sendTextMessage(phone, '❌ Cita cancelada. ¡Hasta luego!');
      userSessions.delete(phone);
      return;
    }

    // Validar que todos los datos estén completos
    if (!this.validarDatosCompletos(session)) {
      await this.sender.sendTextMessage(phone, '❌ Error interno. Faltan datos.');
      userSessions.delete(phone);
      return;
    }

    try {
      const appointmentService = new AppointmentService(prisma);

      const payload: Prisma.AppointmentCreateInput & {
        type?: 'INCOME' | 'EXPENSE';
        amount?: number;
        description?: string;
      } = {
        patient: { connect: { id: session.patientId! } },
        doctor: { connect: { id: session.selectedDoctorId! } },
        specialty: { connect: { id: session.selectedSpecialtyId! } },
        schedule: { connect: { id: session.selectedScheduleId! } },

        scheduledStart: session.scheduledStart!,
        scheduledEnd: session.scheduledEnd!,
        reservationAmount: session.reservationAmount!,
        totalAmount: session.totalAmount!,
        remainingAmount: session.remainingAmount!,
        notes: `Cita agendada vía WhatsApp. Paciente: ${session.patientFirstName} ${session.patientLastName}`,
        status: 'PENDING',
        source: 'whatsapp_bot',

        // Campos extra para tu lógica
        type: 'INCOME',
        amount: session.reservationAmount!,
        description: `Consulta ${session.selectedSpecialtyName}`,
      };

      const cita = await appointmentService.create(payload);


      const mensajeFinal = 
        `🎉 *¡CITA AGENDADA CON ÉXITO!*\n\n` +
        // `Tu cita ha sido registrada con el código:\n` +
        // `*${cita.id.slice(0, 8).toUpperCase()}*\n\n` +
        // `Te contactaremos 24 horas antes de tu cita.\n\n` +
        `¡Gracias por confiar en nosotros! 👨‍⚕️👩‍⚕️`;

      await this.sender.sendTextMessage(phone, mensajeFinal);
      session.step = 'final';
      
      // Limpiar sesión después de 1 minuto
      setTimeout(() => {
        userSessions.delete(phone);
      }, 60000);

    } catch (error) {
      console.error('Error al crear cita:', error);
      await this.sender.sendTextMessage(
        phone,
        '❌ Error al crear la cita. Por favor contacta a recepción.'
      );
      userSessions.delete(phone);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               UTILIDADES                                   */
  /* -------------------------------------------------------------------------- */

  private static validarDatosCompletos(session: UserSession): boolean {
    return !!(
      session.patientId &&
      session.selectedDoctorId &&
      session.selectedSpecialtyId &&
      session.selectedScheduleId &&
      session.scheduledStart &&
      session.scheduledEnd &&
      session.reservationAmount !== undefined
    );
  }

  private static isSessionExpired(session: UserSession): boolean {
    const ahora = new Date();
    const minutos = (ahora.getTime() - session.lastInteraction.getTime()) / (1000 * 60);
    return minutos > 10; // 10 minutos de inactividad
  }
}