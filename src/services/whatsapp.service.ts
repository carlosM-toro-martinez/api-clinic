// src/services/whatsappSender.service.ts
import axios, { AxiosError } from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

export class WhatsAppSenderService {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string;
  private httpsAgent: https.Agent;

  constructor() {
    // Cargar variables de entorno (PRODUCCIÓN)
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    // Validación crítica
    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('❌ WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN no están definidos en .env');
    }

    // Configurar mTLS con el certificado
    try {
      const certPath = '/etc/ssl/whatsapp/whatsapp_certificate.pem';
      console.log(`🔍 Buscando certificado en: ${certPath}`);
      
      if (!fs.existsSync(certPath)) {
        throw new Error(`Archivo de certificado no encontrado en ${certPath}`);
      }

      const certContent = fs.readFileSync(certPath);
      console.log(`✅ Certificado cargado (${certContent.length} bytes)`);
      
      // Crear agente HTTPS con el certificado
      this.httpsAgent = new https.Agent({
        cert: certContent,
        // Meta solo requiere el certificado, NO la clave privada
        rejectUnauthorized: true // Asegurar validación SSL
      });
      
      console.log('🔐 Agente HTTPS con mTLS configurado correctamente');
      
    } catch (error: any) {
      console.error('❌ ERROR CRÍTICO configurando mTLS:', error.message);
      if (error.code === 'ENOENT') {
        console.error(`   El archivo no existe en la ruta especificada.`);
        console.error(`   Verifica que el certificado esté en: /etc/ssl/whatsapp/whatsapp_certificate.pem`);
      }
      throw error;
    }
  }

  /**
   * Envía un mensaje de texto simple
   */
  async sendTextMessage(to: string, text: string): Promise<any> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''), // Eliminar el + si existe
      type: 'text',
      text: { body: text }
    };

    console.log(`📤 Enviando mensaje a ${to}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: this.httpsAgent, // 👈 mTLS aquí
        timeout: 10000 // 10 segundos timeout
      });

      console.log(`✅ Mensaje enviado. ID: ${response.data?.messages?.[0]?.id || 'N/A'}`);
      return response.data;

    } catch (error: any) {
      const axiosError = error as AxiosError;
      console.error('❌ Error enviando mensaje:');
      
      if (axiosError.response) {
        console.error(`   Status: ${axiosError.response.status}`);
        console.error(`   Data: ${JSON.stringify(axiosError.response.data, null, 2)}`);
      } else if (axiosError.request) {
        console.error('   No se recibió respuesta del servidor (posible problema de red o mTLS)');
        console.error('   Verifica:');
        console.error('   1. Que el certificado .pem sea el CORRECTO de producción');
        console.error('   2. Que tu servidor tenga salida a Internet (no bloqueado por firewall)');
        console.error('   3. Que las credenciales (ACCESS_TOKEN, PHONE_NUMBER_ID) sean de PRODUCCIÓN');
      } else {
        console.error(`   Error: ${axiosError.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Envía mensaje con botones interactivos (para opciones)
   */
  async sendInteractiveMessage(to: string, message: string, options: string[]): Promise<any> {
    const buttons = options.map((option, index) => ({
      type: "reply" as const,
      reply: {
        id: `option_${index + 1}`,
        title: option.length > 20 ? option.substring(0, 20) + '...' : option
      }
    }));

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace('+', ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message },
        action: { buttons }
      }
    };

    console.log(`📤 Enviando mensaje interactivo a ${to} con ${options.length} opciones`);

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: this.httpsAgent,
        timeout: 10000
      });

      console.log(`✅ Mensaje interactivo enviado. ID: ${response.data?.messages?.[0]?.id || 'N/A'}`);
      return response.data;

    } catch (error: any) {
      console.error('❌ Error enviando mensaje interactivo:', error.response?.data || error.message);
      throw error;
    }
  }
}