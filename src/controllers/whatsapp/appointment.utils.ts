import { UserSession } from './types';

export function validarDatosCompletos(session: UserSession): boolean {
  return !!(
    session.patientId &&
    session.selectedDoctorId &&
    session.selectedSpecialtyId &&
    session.selectedScheduleId &&
    session.scheduledStart &&
    session.scheduledEnd &&
    session.reservationAmount !== undefined
  );
}