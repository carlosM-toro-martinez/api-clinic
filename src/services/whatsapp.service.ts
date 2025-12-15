// src/services/whatsapp.service.ts
import axios from 'axios';

export class WhatsAppSenderService {
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  private accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  private apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  constructor() {
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('❌ Faltan variables de WhatsApp');
    }
  }

  async sendTextMessage(to: string, text: string): Promise<any> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'text',
      text: { body: text, preview_url: false }
    };

    try {
      const response = await axios.post(url, payload, {
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        timeout: 10000
      });
      console.log(`✅ Mensaje a ${to}`);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error enviando:', error.response?.data || error.message);
      throw error;
    }
  }
}