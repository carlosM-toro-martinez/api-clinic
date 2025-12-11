export class WhatsAppService {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
  }

  async sendTextMessage(to: string, message: string) {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: message }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`WhatsApp API Error: ${JSON.stringify(data)}`);
      }

      return data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async sendAppointmentConfirmation(to: string, appointmentDetails: any) {
    const message = this.formatAppointmentConfirmation(appointmentDetails);
    return this.sendTextMessage(to, message);
  }

  private formatAppointmentConfirmation(details: any): string {
    const { patientName, doctorName, specialty, date, time, notes } = details;
    
    return `✅ *CITA CONFIRMADA*\n\n` +
           `👤 Paciente: ${patientName}\n` +
           `👨‍⚕️ Doctor: ${doctorName}\n` +
           `🏥 Especialidad: ${specialty}\n` +
           `📅 Fecha: ${date}\n` +
           `🕐 Hora: ${time}\n` +
           `📝 Notas: ${notes || 'Ninguna'}\n\n` +
           `Por favor, llega 15 minutos antes.\n` +
           `Para cancelar o modificar, contacta a recepción.`;
  }

  async sendQuickReply(to: string, message: string, options: string[]) {
    // WhatsApp Quick Replies (botones)
    const buttons = options.map((option, index) => ({
      type: "reply",
      reply: {
        id: `option_${index + 1}`,
        title: option
      }
    }));

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: message },
          action: { buttons }
        }
      })
    });

    return await response.json();
  }
}