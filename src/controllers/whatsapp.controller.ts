// src/controllers/whatsapp.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async.handler';
import { WhatsAppSenderService } from '../services/whatsapp.service';

// Interfaz para el webhook de WhatsApp
interface WhatsAppWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: { body: string };
          type: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

// Interfaz para el estado de conversación
interface UserSession {
  phone: string;
  step: 'inicio' | 'seleccion_servicio' | 'proporcionar_fecha' | 'proporcionar_hora' | 'confirmacion';
  selectedService?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  lastInteraction: Date;
}

// Almacenamiento temporal de sesiones (en producción usa Redis o DB)
const userSessions = new Map<string, UserSession>();

export class WhatsAppController {
  private static readonly VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'clinica_token_2025';
  private static readonly sender = new WhatsAppSenderService();

  /**
   * Verificación del webhook por Meta
   */
  static verifyWebhook = asyncHandler(async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔧 WhatsApp está verificando el webhook...');
    console.log(`Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);

    if (mode === 'subscribe' && token === WhatsAppController.VERIFY_TOKEN) {
      console.log('✅ Webhook verificado exitosamente');
      res.status(200).send(challenge);
    } else {
      console.log('❌ Token de verificación incorrecto');
      res.sendStatus(403);
    }
  });

  /**
   * Recepción de mensajes de WhatsApp
   */
  static receiveMessage = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as WhatsAppWebhook;

    // Responder inmediatamente a Meta (IMPORTANTE)
    res.status(200).json({ status: 'received' });

    // Procesar en segundo plano
    setTimeout(() => {
      WhatsAppController.processIncomingMessage(body);
    }, 0);
  });

  /**
   * Procesa el mensaje entrante
   */
  private static async processIncomingMessage(body: WhatsAppWebhook): Promise<void> {
    try {
      console.log('\n📥 ======= NUEVO MENSAJE WHATSAPP =======');

      // Validar estructura básica
      if (body.object !== 'whatsapp_business_account') {
        console.log('⚠️ No es un evento de WhatsApp Business');
        return;
      }

      const entry = body.entry?.[0];
      if (!entry) {
        console.log('⚠️ No hay entries en el webhook');
        return;
      }

      const changes = entry.changes?.[0];
      if (!changes || changes.field !== 'messages') {
        console.log('⚠️ No es un cambio de mensajes');
        return;
      }

      const value = changes.value;
      const message = value.messages?.[0];
      
      if (!message) {
        console.log('⚠️ No hay mensajes en el cambio');
        return;
      }

      const from = message.from; // Número del cliente
      const text = message.text?.body || '';
      const messageId = message.id;
      const timestamp = new Date(parseInt(message.timestamp) * 1000);

      console.log(`📱 De: ${from}`);
      console.log(`💬 Texto: "${text}"`);
      console.log(`🆔 ID: ${messageId}`);
      console.log(`🕐 Hora real: ${timestamp.toLocaleString('es-ES')}`);

      // ✅ PRUEBA TEMPORAL: Enviar respuesta automática "Eco"
      // Agrega esto para probar que el envío funciona
      //const testResponse = `✅ ¡Hola! Recibí tu mensaje: "${text}".\n\nEste es un eco automático de prueba.`;
      const testResponse = `Te amo mucho, jamas lo olvides, gracias por ser mi inspiración.\n\nPara: Fabiola Belén Aguirre Fernández ❤️`;
      
      try {
        await WhatsAppController.sender.sendTextMessage(from, testResponse);
        console.log(`🔄 [PRUEBA] Respuesta de eco enviada a ${from}`);
      } catch (sendError) {
        console.error(`❌ [PRUEBA] Falló el envío del eco:`, sendError);
      }
      // ✅ FIN DE LA PRUEBA TEMPORAL

      // Solo procesar mensajes de texto por ahora
      if (message.type === 'text') {
        // Comenta temporalmente la lógica de conversación mientras pruebas el envío
        // await WhatsAppController.handleUserMessage(from, text);
        
        console.log(`ℹ️ Lógica de conversación temporalmente desactivada para pruebas de envío`);
      } else {
        console.log(`ℹ️ Mensaje de tipo '${message.type}' ignorado por ahora`);
      }

      console.log('✅ ======= MENSAJE PROCESADO =======\n');

    } catch (error) {
      console.error('❌ Error procesando mensaje WhatsApp:', error);
    }
  }

  /**
   * Maneja la lógica de conversación con el usuario
   */
  private static async handleUserMessage(phone: string, userMessage: string): Promise<void> {
    try {
      // Normalizar mensaje
      const normalizedMsg = userMessage.toLowerCase().trim();
      
      // Obtener o crear sesión del usuario
      let session = userSessions.get(phone);
      if (!session || this.isSessionExpired(session)) {
        session = {
          phone,
          step: 'inicio',
          lastInteraction: new Date()
        };
        userSessions.set(phone, session);
      } else {
        session.lastInteraction = new Date();
      }

      console.log(`👤 Usuario ${phone} en paso: ${session.step}`);

      // Lógica basada en el paso actual
      switch (session.step) {
        case 'inicio':
          await this.handleInitialStep(phone, normalizedMsg, session);
          break;
        case 'seleccion_servicio':
          await this.handleServiceSelection(phone, normalizedMsg, session);
          break;
        case 'proporcionar_fecha':
          await this.handleDateSelection(phone, normalizedMsg, session);
          break;
        case 'proporcionar_hora':
          await this.handleTimeSelection(phone, normalizedMsg, session);
          break;
        case 'confirmacion':
          await this.handleConfirmation(phone, normalizedMsg, session);
          break;
      }

    } catch (error) {
      console.error(`❌ Error manejando mensaje de ${phone}:`, error);
      // Enviar mensaje de error al usuario
      try {
        await WhatsAppController.sender.sendTextMessage(phone, 
          '⚠️ Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente o contacta a recepción.'
        );
      } catch (sendError) {
        console.error('❌ Error enviando mensaje de error:', sendError);
      }
    }
  }

  /**
   * Paso 1: Saludo inicial y presentación de opciones
   */
  private static async handleInitialStep(phone: string, message: string, session: UserSession): Promise<void> {
    const welcomeMessage = `¡Hola! 👋 Bienvenido a *Clínica Salud Total*.\n\nSoy tu asistente virtual para agendar citas médicas.\n\nPor favor, selecciona una opción:\n\n*1* 🩺 - Agendar nueva cita\n*2* 📅 - Consultar horarios disponibles\n*3* 📞 - Hablar con recepción\n*4* ❌ - Cancelar una cita existente\n\n*Responde con el número de tu elección (1, 2, 3 o 4).*`;

    await WhatsAppController.sender.sendTextMessage(phone, welcomeMessage);
    session.step = 'seleccion_servicio';
  }

  /**
   * Paso 2: Selección de servicio/especialidad
   */
  private static async handleServiceSelection(phone: string, message: string, session: UserSession): Promise<void> {
    if (message === '1') {
      const servicesMessage = `Perfecto, vamos a agendar tu cita. 🗓️\n\n¿Qué tipo de consulta necesitas?\n\n*1* 🩺 - Medicina General\n*2* 👶 - Pediatría\n*3* 🦷 - Odontología\n*4* 🧠 - Psicología\n*5* 👁️ - Oftalmología\n\n*Responde con el número de la especialidad.*`;
      
      await WhatsAppController.sender.sendTextMessage(phone, servicesMessage);
      session.step = 'proporcionar_fecha';
    } 
    else if (message === '2') {
      const hoursMessage = `Nuestros horarios de atención:\n\n🏥 *Lunes a Viernes:* 8:00 AM - 8:00 PM\n🏥 *Sábados:* 9:00 AM - 2:00 PM\n🏥 *Domingos:* Cerrado (solo emergencias)\n\n¿Te gustaría agendar una cita ahora? Responde *1* para agendar o *menú* para volver al inicio.`;
      
      await WhatsAppController.sender.sendTextMessage(phone, hoursMessage);
    }
    else if (message === '3') {
      const contactMessage = `Puedes contactar a nuestra recepción:\n\n📞 Teléfono: *+52 555 123 4567*\n🕐 Horario: Lunes a Viernes 8AM-6PM\n📍 Dirección: Av. Principal #123, Ciudad\n\n¿Te gustaría agendar una cita? Responde *1* para agendar o *menú* para volver al inicio.`;
      
      await WhatsAppController.sender.sendTextMessage(phone, contactMessage);
    }
    else if (message === '4') {
      const cancelMessage = `Para cancelar una cita, necesitamos:\n1. Tu nombre completo\n2. Fecha de la cita\n3. Hora de la cita\n\nPor favor, proporciona esta información o contacta a recepción al 📞 +52 555 123 4567\n\nResponde *menú* para volver al inicio.`;
      
      await WhatsAppController.sender.sendTextMessage(phone, cancelMessage);
    }
    else if (message === 'menú') {
      session.step = 'inicio';
      await this.handleInitialStep(phone, message, session);
    }
    else {
      const errorMessage = `No entendí tu respuesta. Por favor, responde con:\n*1* - Agendar cita\n*2* - Ver horarios\n*3* - Contactar recepción\n*4* - Cancelar cita\n*menú* - Volver al inicio`;
      
      await WhatsAppController.sender.sendTextMessage(phone, errorMessage);
    }
  }

  /**
   * Paso 3: Selección de fecha
   */
  private static async handleDateSelection(phone: string, message: string, session: UserSession): Promise<void> {
    // Mapear selección de servicio
    const serviceMap: {[key: string]: string} = {
      '1': 'Medicina General',
      '2': 'Pediatría',
      '3': 'Odontología',
      '4': 'Psicología',
      '5': 'Oftalmología'
    };

    const selectedService = serviceMap[message];
    
    if (selectedService) {
      session.selectedService = selectedService;
      
      const dateMessage = `✅ Has seleccionado: *${selectedService}*\n\nAhora, ¿para qué fecha quieres la cita?\n\nPor favor, escribe la fecha en formato *DD/MM/AAAA*\nEjemplo: *15/12/2024*\n\nO responde *menú* para volver al inicio.`;
      
      await WhatsAppController.sender.sendTextMessage(phone, dateMessage);
      session.step = 'proporcionar_hora';
    }
    else if (message === 'menú') {
      session.step = 'inicio';
      await this.handleInitialStep(phone, message, session);
    }
    else {
      const errorMessage = `Opción no válida. Por favor, selecciona:\n*1* - Medicina General\n*2* - Pediatría\n*3* - Odontología\n*4* - Psicología\n*5* - Oftalmología\n*menú* - Volver al inicio`;
      
      await WhatsAppController.sender.sendTextMessage(phone, errorMessage);
    }
  }

  /**
   * Paso 4: Selección de hora
   */
  private static async handleTimeSelection(phone: string, message: string, session: UserSession): Promise<void> {
    // Validar formato de fecha (simple)
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = message.match(dateRegex);

    if (match && session.selectedService) {
      const [_, day, month, year] = match;
      session.appointmentDate = `${day}/${month}/${year}`;
      
      const timeMessage = `📅 Fecha registrada: *${session.appointmentDate}*\n\nAhora selecciona un horario:\n\n*1* ⏰ - 9:00 AM\n*2* ⏰ - 11:00 AM\n*3* ⏰ - 2:00 PM\n*4* ⏰ - 4:00 PM\n*5* ⏰ - 6:00 PM\n\n*Responde con el número del horario.*`;
      
      await WhatsAppController.sender.sendTextMessage(phone, timeMessage);
      session.step = 'confirmacion';
    }
    else if (message === 'menú') {
      session.step = 'inicio';
      await this.handleInitialStep(phone, message, session);
    }
    else {
      const errorMessage = `Formato de fecha incorrecto. Por favor, usa *DD/MM/AAAA*\nEjemplo: *15/12/2024*\n\nO responde *menú* para volver al inicio.`;
      
      await WhatsAppController.sender.sendTextMessage(phone, errorMessage);
    }
  }

  /**
   * Paso 5: Confirmación final
   */
  private static async handleConfirmation(phone: string, message: string, session: UserSession): Promise<void> {
    // Mapear selección de hora
    const timeMap: {[key: string]: string} = {
      '1': '9:00 AM',
      '2': '11:00 AM',
      '3': '2:00 PM',
      '4': '4:00 PM',
      '5': '6:00 PM'
    };

    const selectedTime = timeMap[message];
    
    if (selectedTime && session.selectedService && session.appointmentDate) {
      session.appointmentTime = selectedTime;
      
      // AQUÍ DEBERÍAS LLAMAR A TU API DE CITAS EXISTENTE
      // const appointmentData = {
      //   patientPhone: phone,
      //   service: session.selectedService,
      //   date: session.appointmentDate,
      //   time: session.appointmentTime,
      //   status: 'pending'
      // };
      // await tuAppointmentService.create(appointmentData);

      const confirmationMessage = `🎉 *¡CITA AGENDADA CON ÉXITO!*\n\n📋 *Resumen:*\n• Servicio: ${session.selectedService}\n• Fecha: ${session.appointmentDate}\n• Hora: ${session.appointmentTime}\n• Teléfono: ${phone}\n\nTe enviaremos un recordatorio 24 horas antes.\n\n¿Necesitas algo más?\n*1* - Sí, modificar esta cita\n*2* - No, gracias\n*menú* - Volver al inicio`;
      
      await WhatsAppController.sender.sendTextMessage(phone, confirmationMessage);
      
      // Limpiar sesión después de 5 minutos
      setTimeout(() => {
        userSessions.delete(phone);
        console.log(`🧹 Sesión limpiada para ${phone}`);
      }, 5 * 60 * 1000);
      
    }
    else if (message === 'menú') {
      session.step = 'inicio';
      await this.handleInitialStep(phone, message, session);
    }
    else {
      const errorMessage = `Opción no válida. Por favor, selecciona:\n*1* - 9:00 AM\n*2* - 11:00 AM\n*3* - 2:00 PM\n*4* - 4:00 PM\n*5* - 6:00 PM\n*menú* - Volver al inicio`;
      
      await WhatsAppController.sender.sendTextMessage(phone, errorMessage);
    }
  }

  /**
   * Verifica si la sesión expiró (10 minutos sin interacción)
   */
  private static isSessionExpired(session: UserSession): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - session.lastInteraction.getTime()) / (1000 * 60);
    return diffMinutes > 10; // 10 minutos de inactividad
  }
}