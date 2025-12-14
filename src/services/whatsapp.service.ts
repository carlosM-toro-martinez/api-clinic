// src/services/whatsappSender.service.ts (VERSIÓN CORREGIDA)
import axios, { AxiosError } from 'axios';

export class WhatsAppSenderService {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0'; // Asegúrate de usar v21.0

    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('❌ WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN no están definidos en .env');
    }
    console.log('✅ Servicio de envío configurado. Phone Number ID:', this.phoneNumberId);
  }

  /**
   * Envía un mensaje de texto simple (CORREGIDO)
   */
  async sendTextMessage(to: string, text: string): Promise<any> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''), // Asegura formato sin +
      type: 'text',
      text: { 
        preview_url: false, // Opcional: desactiva vista previa de enlaces
        body: text 
      }
    };

    console.log(`📤 [ENVÍO] A: ${to} | Texto: "${text.substring(0, 30)}..."`);

    try {
      // ✅ SOLO se necesita el token en el header. NO se usa httpsAgent.
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      console.log(`✅ [ENVÍO EXITOSO] Message ID: ${response.data?.messages?.[0]?.id}`);
      return response.data;

    } catch (error: any) {
      const axiosError = error as AxiosError;
      console.error('❌ [ERROR EN ENVÍO]:', axiosError.message);
      
      if (axiosError.response) {
        console.error('   Detalles:', JSON.stringify(axiosError.response.data, null, 2));
      }
      
      // Relanza el error para que el controlador lo maneje
      throw new Error(`Fallo en envío de WhatsApp: ${axiosError.message}`);
    }
  }
}