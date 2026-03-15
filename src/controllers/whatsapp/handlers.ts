import type { PrismaClient as TenantPrisma, Prisma } from '../../../node_modules/.prisma/tenant-client';
import { WhatsAppSenderService } from '../../services/whatsapp.service';
import { AppointmentService } from '../../services/appointment.service';
import { UserSession } from './types';
import { validarDatosCompletos } from './appointment.utils';
import { userSessions } from './session.utils';

// --------------------------------------------------------------------------
// PASO 1: INICIO
// --------------------------------------------------------------------------

export async function handleInicio(
  sender: WhatsAppSenderService,
  phone: string,
  session: UserSession
): Promise<void> {
  const mensaje = `¡Hola! 👋 Bienvenido/a a **Clínica Endovel**.\n\n` +
    `Estoy aquí para ayudarte a gestionar ` +
    `tus citas médicas de manera rápida y sencilla.\n\n` +
    `Para comenzar, por favor elige una de las siguientes opciones:\n\n` +
    `*1* – Agendar una nueva cita médica\n` +
    `*2* – Comunicarme con un operador\n` +
    `*3* – Consultar mis citas y pagos\n\n` +
    `*Escribe el número correspondiente a tu elección.*\n\n` +
    `Si en cualquier momento deseas detener el proceso, solo escribe **cancelar** ` +
    `¡Estoy aquí para asistirte! 💙`;

  await sender.sendTextMessage(phone, mensaje);
  session.step = 'menu';
}

// --------------------------------------------------------------------------
// PASO 2: MENÚ PRINCIPAL
// --------------------------------------------------------------------------

export async function handleMenu(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  if (message === '1') {
    session.step = 'especialidades';
    await handleEspecialidades(sender, prisma, phone, '1', session);
  } else if (message === '2') {
    session.step = 'operador';
    await handleOperador(sender, prisma, phone, session);
  } else if (message === '3') {
    session.step = 'consultar_citas_identificacion';
    await sender.sendTextMessage(
      phone,
      '📋 *Consulta de citas y pagos*\n\n' +
      'Por favor, escribe tu *CI* o tu *nombre completo* para verificar tus citas.\n\n' +
      'Ejemplos:\n' +
      '• *1234567*\n' +
      '• *Juan Pérez García*'
    );
  } else {
    await sender.sendTextMessage(
      phone,
      '❌ Opción no válida. Por favor escribe *1* para agendar una cita, *2* para hablar con un operador o *3* para consultar tus citas.'
    );
  }
}

// --------------------------------------------------------------------------
// PASO 2.5: OPERADOR
// --------------------------------------------------------------------------

export async function handleOperador(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  session: UserSession
): Promise<void> {
  try {
    // Verificar si el paciente existe
    let patient = await prisma.patient.findFirst({
      where: { phone: phone.replace('+', '') }
    });

    // Si no existe, crearlo con el teléfono como nombre/apellido/CI
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          firstName: phone,
          lastName: phone,
          ciNumber: phone,
          phone: phone.replace('+', '')
        }
      });
    }

    session.patientId = patient.id;
    session.isOperadorMode = true;

    // Guardar el mensaje de entrada del usuario en ChatbotInteraction
    await prisma.chatbotInteraction.create({
      data: {
        patientId: patient.id,
        patientPhone: phone,
        message: 'Usuario solicitó hablar con un operador',
        direction: 'INBOUND',
        intent: 'talk_to_operator',
        resolved: false
      }
    });

    const mensajeOperador = 
      `📞 *Comunicación con Operador*\n\n` +
      `Un operador se pondrá en contacto contigo pronto.\n` +
      `Mientras tanto, puedes describir tu consulta y te ayudaremos.\n\n` +
      `Escribe tu mensaje:`;

    await sender.sendTextMessage(phone, mensajeOperador);
  } catch (error) {
    console.error('Error en handleOperador:', error);
    await sender.sendTextMessage(
      phone,
      '❌ Error al conectar con operador. Por favor intenta más tarde.'
    );
    session.step = 'inicio';
  }
}

// Manejar mensajes en modo operador
export async function handleOperadorMessages(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  try {
    if (!session.patientId) {
      await sender.sendTextMessage(phone, '❌ Error: no se puede identificar al paciente.');
      return;
    }

    // Guardar el mensaje del usuario en ChatbotInteraction
    await prisma.chatbotInteraction.create({
      data: {
        patientId: session.patientId,
        patientPhone: phone,
        message: message,
        direction: 'INBOUND',
        intent: 'customer_message',
        resolved: false
      }
    });

  } catch (error) {
    console.error('Error guardando mensaje de operador:', error);
    await sender.sendTextMessage(
      phone,
      '❌ Error al guardar tu mensaje. Por favor intenta nuevamente.'
    );
  }
}

// --------------------------------------------------------------------------
// PASO 2.6: CONSULTA DE CITAS Y PAGOS
// --------------------------------------------------------------------------

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function esCI(texto: string): boolean {
  return /^[0-9]{4,12}$/.test(texto.trim());
}

function formatMoney(value: any): string {
  const num = toNumber(value);
  if (Number.isNaN(num)) return '0.00';
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function toNumber(value: any): number {
  if (typeof value?.toNumber === 'function') return value.toNumber();
  const num = Number(value ?? 0);
  return Number.isNaN(num) ? 0 : num;
}

export async function handleConsultaCitas(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  const input = normalizarTexto(message);

  let patient = null;

  if (esCI(input)) {
    patient = await prisma.patient.findFirst({
      where: { ciNumber: input }
    });
  } else {
    const parts = input.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');

      const matches = await prisma.patient.findMany({
        where: {
          AND: [
            { firstName: { contains: firstName, mode: 'insensitive' } },
            { lastName: { contains: lastName, mode: 'insensitive' } }
          ]
        },
        take: 2
      });

      if (matches.length > 1) {
        await sender.sendTextMessage(
          phone,
          '⚠️ Encontramos varios pacientes con ese nombre.\n\n' +
          'Por favor, responde con tu *CI* para continuar.'
        );
        return;
      }

      patient = matches[0] ?? null;
    } else {
      const matches = await prisma.patient.findMany({
        where: {
          OR: [
            { firstName: { contains: input, mode: 'insensitive' } },
            { lastName: { contains: input, mode: 'insensitive' } }
          ]
        },
        take: 2
      });

      if (matches.length > 1) {
        await sender.sendTextMessage(
          phone,
          '⚠️ Encontramos varios pacientes con ese nombre.\n\n' +
          'Por favor, responde con tu *CI* para continuar.'
        );
        return;
      }

      patient = matches[0] ?? null;
    }
  }

  if (!patient) {
    await sender.sendTextMessage(
      phone,
      '❌ No encontramos un paciente con esos datos.\n\n' +
      'Por favor intenta nuevamente con tu *CI* o *nombre completo*.'
    );
    return;
  }

  session.patientId = patient.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      patientId: patient.id,
      scheduledStart: { gte: today },
      status: { in: ['PENDING', 'CONFIRMED'] }
    },
    include: {
      doctor: { select: { firstName: true, lastName: true } },
      specialty: { select: { name: true } }
    },
    orderBy: { scheduledStart: 'asc' }
  });

  if (appointments.length === 0) {
    await sender.sendTextMessage(
      phone,
      '✅ No encontramos citas próximas registradas a tu nombre.\n\n' +
      'Si necesitas agendar una nueva cita, escribe *1* en el menú principal.'
    );
    session.step = 'menu';
    return;
  }

  let mensaje = '📆 *Tus citas próximas*\n\n';

  appointments.forEach((appt, index) => {
    const fecha = appt.scheduledStart.toLocaleDateString('es-BO');
    const hora = appt.scheduledStart.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    const doctor = `Dr(a). ${appt.doctor.firstName} ${appt.doctor.lastName}`;
    const especialidad = appt.specialty.name;

    const adelanto = toNumber(appt.reservationAmount);
    const total = toNumber(appt.totalAmount);
    const saldo = toNumber(appt.remainingAmount);

    mensaje += `*${index + 1}* ${especialidad}\n`;
    mensaje += `• Fecha: ${fecha} ${hora}\n`;
    mensaje += `• Médico: ${doctor}\n`;
    mensaje += `• Adelanto: ${formatMoney(adelanto)} BOB\n`;
    mensaje += `• Total: ${formatMoney(total)} BOB\n`;
    if (saldo > 0) {
      mensaje += `• Saldo pendiente: ${formatMoney(saldo)} BOB\n`;
      mensaje += `• Estado: *Pendiente de pago*\n`;
      mensaje += `• Nota: Para terminar de cancelar la reserva, puedes pagar el saldo pendiente en recepción.\n\n`;
    } else {
      mensaje += `• Saldo pendiente: 0.00 BOB\n`;
      mensaje += `• Estado: *Sin saldo pendiente*\n\n`;
    }
  });

  mensaje += 'Si deseas cancelar o reprogramar, por favor contacta a recepción.\n\n';
  mensaje += 'Para volver al menú, escribe *1*, *2* o *3*.';

  await sender.sendTextMessage(phone, mensaje);
  session.step = 'menu';
}

// --------------------------------------------------------------------------
// PASO 3: ESPECIALIDADES
// --------------------------------------------------------------------------

export async function handleEspecialidades(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  if (message !== '1') {
    await sender.sendTextMessage(phone, '❌ Opción no válida. Por favor escribe *1* para agendar una cita.');
    return;
  }

  const specialties = await prisma.specialty.findMany({
    select: {
      id: true,
      name: true,
      fees: {
        where: { feeType: 'INITIAL' },
        select: { amount: true, currency: true, description: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log('Especialidades encontradas:', specialties.length);

  if (specialties.length === 0) {
    await sender.sendTextMessage(phone,
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
  mensaje += 'O escribe **cancelar** para detener el proceso.';

  const specialtiesForSession = specialties.map((spec) => ({
    id: spec.id,
    name: spec.name,
    feeAmount: spec.fees[0]?.amount?.toNumber() ?? 0,
    feeCurrency: spec.fees[0]?.currency ?? 'BOB',
  }));

  (session as any).specialties = specialtiesForSession;
  session.step = 'fecha';
  await sender.sendTextMessage(phone, mensaje);
}

// --------------------------------------------------------------------------
// PASO 3: FECHA
// --------------------------------------------------------------------------

async function cargarYMostrarHorarios(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  session: UserSession
): Promise<void> {
  if (!session.selectedSpecialtyId || !session.appointmentDateObj) {
    await sender.sendTextMessage(phone, '❌ Error interno. Faltan datos.');
    session.step = 'inicio';
    return;
  }

  const date = session.appointmentDateObj;
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

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
  const disponibles = schedules.filter(s => !ocupados.has(s.id));

  if (disponibles.length === 0) {
    await sender.sendTextMessage(
      phone,
      `❌ No hay horarios disponibles para *${session.selectedSpecialtyName}* el *${session.appointmentDate}*.\n\n` +
      `Por favor, escribe una nueva fecha en formato *DD/MM/AAAA* o escribe *cancelar* para salir.`
    );
    session.step = 'fecha';
    return;
  }

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

  await sender.sendTextMessage(phone, mensaje);
}

export async function handleFecha(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  if (!session.selectedSpecialtyId || !session.selectedSpecialtyName) {
    const specialties: Array<{ id: string; name: string; feeAmount: number; feeCurrency: string }> | undefined = (session as any).specialties;
    
    if (!specialties || !Array.isArray(specialties)) {
      await sender.sendTextMessage(phone, '❌ Error: No se encontraron especialidades. Por favor, comienza de nuevo.');
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
      await sender.sendTextMessage(phone, mensaje);
      return;
    }
    
    const selected = specialties[index];
    if (!selected) {
      await sender.sendTextMessage(phone, '❌ Selección inválida.');
      return;
    }

    session.selectedSpecialtyId = selected.id;
    session.selectedSpecialtyName = selected.name;
    // El monto de consulta es el total. No se cobra adelanto en este paso.
    session.totalAmount = selected.feeAmount;
    session.reservationAmount = 0;
    session.remainingAmount = selected.feeAmount;
    delete (session as any).specialties;
    
    await sender.sendTextMessage(
      phone,
      `✅ Especialidad: *${selected.name}*\n\n` +
      `Ahora ingresa la fecha para tu cita en formato *DD/MM/AAAA*\n\n` +
      `Ejemplo: *05/09/2024*`
    );
    return;
  }
  
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = message.match(dateRegex);
  
  if (!match) {
    await sender.sendTextMessage(
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
  
  if (isNaN(date.getTime())) {
    await sender.sendTextMessage(phone, '❌ Fecha inválida. Intenta nuevamente.');
    return;
  }
  
  if (date < today) {
    await sender.sendTextMessage(phone, '❌ No puedes agendar citas en fechas pasadas.');
    return;
  }
  
  if (date.getDay() === 0) {
    await sender.sendTextMessage(phone, '❌ No atendemos los domingos. Por favor elige otro día.');
    return;
  }
  
  session.appointmentDate = `${day}/${month}/${year}`;
  session.appointmentDateObj = date;
  session.step = 'horarios';
  
  await cargarYMostrarHorarios(sender, prisma, phone, session);
}

// --------------------------------------------------------------------------
// PASO 4: HORARIOS
// --------------------------------------------------------------------------

export async function handleHorarios(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  if (message.toLowerCase() === 'reiniciar') {
    session.step = 'fecha';
    await sender.sendTextMessage(
      phone,
      `Reiniciando selección de fecha.\n\n` +
      `Por favor, ingresa una nueva fecha en formato *DD/MM/AAAA*\n\n` +
      `Ejemplo: *15/12/2024*`
    );
    return;
  }

  const horarios: Array<any> = (session as any).horarios || [];
  
  if (horarios.length === 0) {
    await cargarYMostrarHorarios(sender, prisma, phone, session);
    return;
  }

  const index = parseInt(message) - 1;

  if (isNaN(index) || index < 0 || index >= horarios.length) {
    let mensaje = '❌ Número inválido. Horarios disponibles:\n\n';
    horarios.forEach((h, i) => {
      mensaje += `*${i + 1}* - ${h.start} a ${h.end} (Dr. ${h.doctorName})\n`;
    });
    mensaje += '\n*Escribe el número del horario que prefieres.*';
    await sender.sendTextMessage(phone, mensaje);
    return;
  }

  const seleccionado = horarios[index];
  session.selectedScheduleId = seleccionado.id;
  session.selectedDoctorId = seleccionado.doctorId;
  session.selectedDoctorName = seleccionado.doctorName;
  session.selectedTime = `${seleccionado.start} - ${seleccionado.end}`;

  const fecha = session.appointmentDateObj!;
  const [horaInicio, minutoInicio] = seleccionado.start.split(':').map(Number);
  const [horaFin, minutoFin] = seleccionado.end.split(':').map(Number);

  const inicio = new Date(fecha);
  inicio.setHours(horaInicio, minutoInicio, 0, 0);
  
  const fin = new Date(fecha);
  fin.setHours(horaFin, minutoFin, 0, 0);

  session.scheduledStart = inicio;
  session.scheduledEnd = fin;

  (session as any).horarios = undefined;
  session.step = 'verificacion';

  await sender.sendTextMessage(
    phone,
    `✅ Horario seleccionado: *${session.selectedTime}*\n\n` +
    `Ahora necesitamos verificar tus datos.\n\n` +
    `Por favor, ingresa tu *número de carnet (CI)*:\n\n` +
    `Ejemplo: *1234567*`
  );
}

// --------------------------------------------------------------------------
// PASO 5: VERIFICACIÓN
// --------------------------------------------------------------------------

export async function handleVerificacion(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  const ci = message.trim().toUpperCase();

  const paciente = await prisma.patient.findFirst({
    where: { ciNumber: ci }
  });

  if (paciente) {
    session.patientId = paciente.id;
    session.patientCI = paciente.ciNumber || undefined;
    session.patientFirstName = paciente.firstName;
    session.patientLastName = paciente.lastName;
    session.step = 'confirmacion';

    await mostrarResumen(sender, phone, session);
    return;
  }

  session.patientCI = ci;
  session.step = 'registro';

  await sender.sendTextMessage(
    phone,
    '📝 *Registro de nuevo paciente*\n\n' +
    'No encontramos tu CI en nuestro sistema.\n\n' +
    'Por favor, ingresa tu *nombre completo* (nombre y apellido):\n\n' +
    'Ejemplo: *Juan Pérez García*'
  );
}

// --------------------------------------------------------------------------
// PASO 6: REGISTRO
// --------------------------------------------------------------------------

export async function handleRegistro(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  const nombreCompleto = message.trim();
  const partes = nombreCompleto.split(' ');

  if (partes.length < 2) {
    await sender.sendTextMessage(
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

    await mostrarResumen(sender, phone, session);
  } catch (error) {
    console.error('Error al crear paciente:', error);
    await sender.sendTextMessage(
      phone,
      '❌ Error al registrar. Intenta nuevamente o contacta recepción.'
    );
    session.step = 'inicio';
  }
}

// --------------------------------------------------------------------------
// PASO 7: CONFIRMACIÓN
// --------------------------------------------------------------------------

async function mostrarResumen(
  sender: WhatsAppSenderService,
  phone: string,
  session: UserSession
): Promise<void> {
  // Si el monto ya fue seteado en la selección de especialidad, mantenerlo.
  session.reservationAmount = session.reservationAmount ?? 0;
  session.totalAmount = session.totalAmount ?? session.reservationAmount ?? 0;
  session.remainingAmount = session.remainingAmount ?? 0;

  const amountToPay = session.totalAmount ?? session.reservationAmount ?? 0;
  const resumen = 
    `📋 *RESUMEN DE LA CITA*\n\n` +
    `• *Especialidad:* ${session.selectedSpecialtyName}\n` +
    `• *Fecha:* ${session.appointmentDate}\n` +
    `• *Horario:* ${session.selectedTime}\n` +
    `• *Doctor:* ${session.selectedDoctorName}\n` +
    `• *Paciente:* ${session.patientFirstName} ${session.patientLastName}\n` +
    `• *CI:* ${session.patientCI}\n` +
    `• *Monto a pagar:* ${formatMoney(amountToPay)} BOB\n\n` +
    `¿Confirmas la reserva de esta cita?\n\n` +
    `Responde *SI* para confirmar o *NO* para cancelar.`;

  await sender.sendTextMessage(phone, resumen);
}

export async function handleConfirmacion(
  sender: WhatsAppSenderService,
  prisma: TenantPrisma,
  phone: string,
  message: string,
  session: UserSession
): Promise<void> {
  const respuesta = message.toLowerCase();

  if (respuesta !== 'si') {
    await sender.sendTextMessage(phone, '❌ Cita cancelada. ¡Hasta luego!');
    userSessions.delete(phone);
    return;
  }

  if (!validarDatosCompletos(session)) {
    await sender.sendTextMessage(phone, '❌ Error interno. Faltan datos.');
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

      type: 'INCOME',
      amount: session.reservationAmount!,
      description: `Consulta ${session.selectedSpecialtyName}`,
    };

    const cita = await appointmentService.create(payload);

    const mensajeFinal = 
      `🎉 *¡CITA AGENDADA CON ÉXITO!*\n\n` +
      `¡Gracias por confiar en nosotros! 👨‍⚕️👩‍⚕️`;

    await sender.sendTextMessage(phone, mensajeFinal);
    session.step = 'final';
    
  } catch (error) {
    console.error('Error al crear cita:', error);
    await sender.sendTextMessage(
      phone,
      '❌ Error al crear la cita. Por favor contacta a recepción.'
    );
    userSessions.delete(phone);
  }
}
