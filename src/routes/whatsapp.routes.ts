// src/routes/whatsapp.routes.ts
import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';

const router = Router();

// GET: Para verificación del webhook por WhatsApp
router.get('/webhook', WhatsAppController.verifyWebhook);

// POST: Para recibir mensajes de WhatsApp
router.post('/webhook', WhatsAppController.receiveMessage);

export default router;