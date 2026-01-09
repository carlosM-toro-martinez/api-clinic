import type { TenantPrisma } from '../../../types';
import { WhatsAppSenderService } from '../../../services/whatsapp.service';
import { UserSession } from '../types';

export abstract class BaseHandler {
  protected sender: WhatsAppSenderService;

  constructor(sender: WhatsAppSenderService) {
    this.sender = sender;
  }

  abstract handle(
    prisma: TenantPrisma,
    phone: string,
    message: string,
    session: UserSession
  ): Promise<void>;
}