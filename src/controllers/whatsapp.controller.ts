import type { Request, Response } from 'express';
import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';
import { asyncHandler } from '../utils/async.handler';
import { AppError } from '../utils/app.error';
import { WhatsAppSenderService } from '../services/whatsapp.service';
import type { Server as SocketIOServer } from 'socket.io';

// Importar módulos divididos
import { WhatsAppWebhook, UserSession } from './whatsapp/types';
import { userSessions, isSessionExpired } from './whatsapp/session.utils';
import { handleInicio, handleMenu, handleEspecialidades, handleFecha, handleHorarios, handleVerificacion, handleRegistro, handleConfirmacion, handleOperador, handleOperadorMessages } from './whatsapp/handlers';

let io: SocketIOServer | null = null;

export function setSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
}

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

    if (!session || isSessionExpired(session)) {
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
          await handleInicio(this.sender, phone, session);
          break;
        case 'menu':
          await handleMenu(this.sender, prisma, phone, message, session);
          break;
        case 'operador':
          await handleOperadorMessages(this.sender, prisma, phone, message, session);
          
          // Emitir evento a operadores de nuevo mensaje de cliente
          if (io && session.isOperadorMode) {
            io.of('/operators').emit('client_message', {
              patientPhone: phone,
              message: message,
              timestamp: new Date()
            });
          }
          break;
        case 'especialidades':
          await handleEspecialidades(this.sender, prisma, phone, message, session);
          break;
        case 'fecha':
          await handleFecha(this.sender, prisma, phone, message, session);
          break;
        case 'horarios':
          await handleHorarios(this.sender, prisma, phone, message, session);
          break;
        case 'verificacion':
          await handleVerificacion(this.sender, prisma, phone, message, session);
          break;
        case 'registro':
          await handleRegistro(this.sender, prisma, phone, message, session);
          break;
        case 'confirmacion':
          await handleConfirmacion(this.sender, prisma, phone, message, session);
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

  static sendMessageToClient = asyncHandler(async (req: Request, res: Response) => {
    const { patientPhone, message } = req.body;
    const prisma = (req as any).prisma;

    if (!prisma) {
      throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
    }

    if (!patientPhone || typeof patientPhone !== 'string') {
      throw new AppError('patientPhone es requerido', 400);
    }

    if (!message || typeof message !== 'string') {
      throw new AppError('message es requerido', 400);
    }

    try {
      // Enviar mensaje por WhatsApp
      await this.sender.sendTextMessage(patientPhone, message);

      // Buscar el paciente por teléfono
      const patient = await prisma.patient.findFirst({
        where: { phone: patientPhone.replace('+', '') }
      });

      // Guardar el mensaje en ChatbotInteraction
      const chatbotInteraction = await prisma.chatbotInteraction.create({
        data: {
          patientId: patient?.id || null,
          patientPhone: patientPhone,
          message: message,
          direction: 'OUTBOUND',
          intent: 'operator_response',
          resolved: false
        }
      });

      // Emitir evento a través de Socket.IO
      if (io) {
        io.of('/clients').to(patientPhone).emit('new_message', {
          from: 'operator',
          message: message,
          timestamp: chatbotInteraction.createdAt
        });
      }

      res.status(201).json({
        ok: true,
        data: {
          id: chatbotInteraction.id,
          message: 'Mensaje enviado exitosamente',
          sentAt: chatbotInteraction.createdAt
        }
      });
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      throw new AppError(
        'Error al enviar el mensaje. Por favor intenta nuevamente.',
        500,
        'SEND_MESSAGE_ERROR'
      );
    }
  });

  static getChatHistory = asyncHandler(async (req: Request, res: Response) => {
    const { patientPhone } = req.params;
    const prisma = (req as any).prisma;

    if (!prisma) {
      throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
    }

    if (!patientPhone || typeof patientPhone !== 'string') {
      throw new AppError('patientPhone es requerido', 400);
    }

    try {
      const history = await prisma.chatbotInteraction.findMany({
        where: {
          patientPhone: patientPhone
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ciNumber: true,
              phone: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      res.json({
        ok: true,
        data: history,
        count: history.length
      });
    } catch (error) {
      console.error('Error obteniendo historial de chat:', error);
      throw new AppError(
        'Error al obtener el historial. Por favor intenta nuevamente.',
        500,
        'GET_HISTORY_ERROR'
      );
    }
  });

  static markAsResolved = asyncHandler(async (req: Request, res: Response) => {
    const { patientPhone } = req.body;
    const prisma = (req as any).prisma;

    if (!prisma) {
      throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
    }

    if (!patientPhone || typeof patientPhone !== 'string') {
      throw new AppError('patientPhone es requerido', 400);
    }

    try {
      // Marcar todas las interacciones del cliente como resueltas
      const updated = await prisma.chatbotInteraction.updateMany({
        where: {
          patientPhone: patientPhone,
          resolved: false
        },
        data: {
          resolved: true
        }
      });

      res.json({
        ok: true,
        data: {
          message: 'Conversación marcada como resuelta',
          updatedCount: updated.count
        }
      });
    } catch (error) {
      console.error('Error marcando como resuelto:', error);
      throw new AppError(
        'Error al actualizar el estado. Por favor intenta nuevamente.',
        500,
        'UPDATE_RESOLVED_ERROR'
      );
    }
  });

  static getPendingChats = asyncHandler(async (req: Request, res: Response) => {
    const prisma = (req as any).prisma;

    if (!prisma) {
      throw new AppError('Database client not available', 500, 'DB_NOT_AVAILABLE');
    }

    try {
      // Obtener todos los mensajes INBOUND sin resolver, agrupados por patientPhone
      const pendingInteractions = await prisma.chatbotInteraction.findMany({
        where: {
          direction: 'INBOUND',
          resolved: false
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ciNumber: true,
              phone: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      // Agrupar por patientPhone
      const chatsByPhone = new Map<string, typeof pendingInteractions>();
      
      for (const interaction of pendingInteractions) {
        const phone = interaction.patientPhone;
        if (!chatsByPhone.has(phone)) {
          chatsByPhone.set(phone, []);
        }
        chatsByPhone.get(phone)!.push(interaction);
      }

      // Transformar a array con información agrupada
      const pendingChats = Array.from(chatsByPhone.entries()).map(([phone, interactions]) => {
        const lastMessage = interactions[interactions.length - 1];
        const firstMessage = interactions[0];

        return {
          patientPhone: phone,
          patientId: lastMessage.patientId,
          patientInfo: lastMessage.patient,
          messageCount: interactions.length,
          lastMessage: {
            text: lastMessage.message,
            timestamp: lastMessage.createdAt,
            intent: lastMessage.intent
          },
          firstMessage: {
            text: firstMessage.message,
            timestamp: firstMessage.createdAt
          },
          allMessages: interactions
        };
      });

      res.json({
        ok: true,
        data: pendingChats,
        totalChats: pendingChats.length,
        totalPendingMessages: pendingInteractions.length
      });
    } catch (error) {
      console.error('Error obteniendo chats pendientes:', error);
      throw new AppError(
        'Error al obtener chats pendientes. Por favor intenta nuevamente.',
        500,
        'GET_PENDING_CHATS_ERROR'
      );
    }
  });
}