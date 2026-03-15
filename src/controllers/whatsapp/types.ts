export interface WhatsAppWebhook {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messages?: {
          from: string;
          text?: { body: string };
          type: string;
        }[];
      };
    }[];
  }[];
}

export interface UserSession {
  phone: string;
  step: 'inicio' | 'menu' | 'operador' | 'especialidades' | 'fecha' | 'horarios' | 'verificacion' | 'registro' | 'confirmacion' | 'consultar_citas_identificacion' | 'final';
  selectedSpecialtyId?: string;
  selectedSpecialtyName?: string;
  appointmentDate?: string;
  appointmentDateObj?: Date;
  selectedScheduleId?: string;
  selectedDoctorId?: string;
  selectedDoctorName?: string;
  selectedTime?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  patientId?: string;
  patientCI?: string;
  patientFirstName?: string;
  patientLastName?: string;
  reservationAmount?: number;
  totalAmount?: number;
  remainingAmount?: number;

  specialties?: Array<{
    id: string;
    name: string;
    feeAmount: number;
    feeCurrency: string;
  }>;

  horarios?: Array<{
    id: string;
    doctorId: string;
    doctorName: string;
    start: string;
    end: string;
  }>;
  isOperadorMode?: boolean;
  lastInteraction: Date;
}

export type TenantPrisma = any; // Mantener el tipo según tus necesidades
