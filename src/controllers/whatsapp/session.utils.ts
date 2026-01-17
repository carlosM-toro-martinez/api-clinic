import { UserSession } from './types';

export const userSessions = new Map<string, UserSession>();

export function isSessionExpired(session: UserSession): boolean {
  const ahora = new Date();
  const minutos = (ahora.getTime() - session.lastInteraction.getTime()) / (1000 * 60);
  return minutos > 10; // 10 minutos de inactividad
}