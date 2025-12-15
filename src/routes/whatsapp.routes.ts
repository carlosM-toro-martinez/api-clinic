// src/routes/whatsapp.routes.ts
import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';

const router = Router();

//router.get('/webhook', WhatsAppController.verifyWebhook);
router.post('/webhook', WhatsAppController.receiveMessage);

export default router;