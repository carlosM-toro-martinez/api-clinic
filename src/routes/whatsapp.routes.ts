// src/routes/whatsapp.routes.ts
import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';

const router = Router();

//router.get('/webhook', WhatsAppController.verifyWebhook);
router.post('/webhook', WhatsAppController.receiveMessage);

// Endpoints para operadores
router.post('/send', WhatsAppController.sendMessageToClient);
router.get('/chat/:patientPhone', WhatsAppController.getChatHistory);
router.put('/resolve', WhatsAppController.markAsResolved);

export default router;