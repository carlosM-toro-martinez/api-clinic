// src/controllers/whatsapp.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async.handler';

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

export class WhatsAppController {

  private static readonly VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mi_token_secreto_2025';
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

  static receiveMessage = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as WhatsAppWebhook;

    res.status(200).json({ status: 'received' });

    setTimeout(() => {
      WhatsAppController.processMessage(body);
    }, 0);
  });


  private static processMessage(body: WhatsAppWebhook): void {
    try {
      console.log('\n📥 ======= NUEVO MENSAJE WHATSAPP =======');
      console.log('📦 Body completo:', JSON.stringify(body, null, 2));

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

      // Extraer información del mensaje
      const from = message.from; // Número del cliente (ej: "5215512345678")
      const messageId = message.id;
      const timestamp = new Date(parseInt(message.timestamp) * 1000);
      
      // Diferentes tipos de mensaje
      if (message.type === 'text') {
        const text = message.text?.body || '';
        console.log(`📱 MENSAJE DE TEXTO:`);
        console.log(`   👤 De: ${from}`);
        console.log(`   💬 Texto: "${text}"`);
        console.log(`   🆔 ID: ${messageId}`);
        console.log(`   🕐 Fecha: ${timestamp.toISOString()}`);
        
        // Aquí puedes guardar en tu base de datos si quieres
        // Ejemplo: await saveMessageToDB(from, text, 'incoming');
        
      } else if (message.type === 'image') {
        console.log(`📸 MENSAJE DE IMAGEN:`);
        console.log(`   👤 De: ${from}`);
        console.log(`   🖼️ Tipo: Imagen`);
        // if (message.image?.caption) {
        //   console.log(`   📝 Pie de foto: "${message.image?.caption}"`);
        // }
        
      } else if (message.type === 'audio') {
        console.log(`🎧 MENSAJE DE AUDIO:`);
        console.log(`   👤 De: ${from}`);
        
      } else {
        console.log(`📨 MENSAJE DE TIPO: ${message.type}`);
        console.log(`   👤 De: ${from}`);
        console.log(`   📦 Datos:`, JSON.stringify(message, null, 2));
      }

      // Información de contacto si está disponible
      if (value.contacts?.[0]) {
        const contact = value.contacts[0];
        console.log(`   📇 Contacto: ${contact.profile.name}`);
        console.log(`   🔗 WA ID: ${contact.wa_id}`);
      }

      console.log('✅ ======= MENSAJE PROCESADO =======\n');
      
    } catch (error) {
      console.error('❌ Error procesando mensaje WhatsApp:', error);
    }
  }

  /**
   * Función opcional: Guardar mensaje en tu base de datos
   * (Solo si tienes una tabla para logs)
   */
  private static async saveMessageToDB(phone: string, message: string, direction: 'incoming' | 'outgoing') {
    // Ejemplo de cómo guardarías en tu base de datos existente
    // Si tienes una tabla para logs de mensajes:
    /*
    await prisma.messageLog.create({
      data: {
        phone,
        message,
        direction,
        source: 'whatsapp',
        createdAt: new Date()
      }
    });
    */
    
    // Por ahora solo logueamos
    console.log(`💾 [SIMULACIÓN BD] Guardado: ${direction} - ${phone}: ${message.substring(0, 50)}...`);
  }
}