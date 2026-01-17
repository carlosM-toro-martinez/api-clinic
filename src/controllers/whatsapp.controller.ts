import type { Request, Response } from 'express';
import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';
import { asyncHandler } from '../utils/async.handler';
import { WhatsAppSenderService } from '../services/whatsapp.service';

// Importar módulos divididos
import { WhatsAppWebhook, UserSession } from './whatsapp/types';
import { userSessions, isSessionExpired } from './whatsapp/session.utils';
import { handleInicio, handleEspecialidades, handleFecha, handleHorarios, handleVerificacion, handleRegistro, handleConfirmacion } from './whatsapp/handlers';

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
}