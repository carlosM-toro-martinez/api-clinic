import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';

export interface OperatorSession {
  socketId: string;
  operatorId: string;
  operatorName: string;
  activeChats: Set<string>; // números de teléfono de clientes
  connectedAt: Date;
}

export interface ClientSession {
  socketId: string;
  patientPhone: string;
  assignedOperator?: string; // operatorId
  connectedAt: Date;
}

// Almacenar sesiones en memoria
export const operatorSessions = new Map<string, OperatorSession>();
export const clientSessions = new Map<string, ClientSession>();

export function initializeSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Namespace para operadores
  const operatorNamespace = io.of('/operators');

  operatorNamespace.on('connection', (socket) => {
    console.log(`🔌 Operador conectado: ${socket.id}`);

    // Evento: Operador se registra
    socket.on('register_operator', (data: { operatorId: string; operatorName: string }, callback) => {
      const { operatorId, operatorName } = data;

      operatorSessions.set(socket.id, {
        socketId: socket.id,
        operatorId,
        operatorName,
        activeChats: new Set(),
        connectedAt: new Date(),
      });

      console.log(`✅ Operador registrado: ${operatorName} (${operatorId})`);

      callback({
        ok: true,
        message: 'Operador registrado exitosamente',
        socketId: socket.id,
      });

      // Notificar a todos los operadores que hay un nuevo operador
      operatorNamespace.emit('operator_list', getOperatorsList());
    });

    // Evento: Operador solicita lista de chats pendientes
    socket.on('get_pending_chats', async (callback) => {
      try {
        const session = operatorSessions.get(socket.id);
        if (!session) {
          callback({ ok: false, error: 'No operador session found' });
          return;
        }

        // Aquí puedes obtener chats pendientes de la base de datos
        callback({
          ok: true,
          data: {
            activeChats: Array.from(session.activeChats),
          },
        });
      } catch (error) {
        callback({ ok: false, error: 'Error getting pending chats' });
      }
    });

    // Evento: Operador abre un chat con cliente
    socket.on('open_chat', (data: { patientPhone: string }, callback) => {
      const { patientPhone } = data;
      const session = operatorSessions.get(socket.id);

      if (!session) {
        callback({ ok: false, error: 'No operator session found' });
        return;
      }

      session.activeChats.add(patientPhone);

      console.log(
        `📞 Operador ${session.operatorName} abrió chat con ${patientPhone}`
      );

      callback({
        ok: true,
        message: 'Chat abierto exitosamente',
      });

      // Notificar a otros operadores
      operatorNamespace.emit('chat_opened', {
        operatorId: session.operatorId,
        operatorName: session.operatorName,
        patientPhone,
      });
    });

    // Evento: Operador envía mensaje al cliente
    socket.on('send_message', (data: { patientPhone: string; message: string }, callback) => {
      const { patientPhone, message } = data;
      const session = operatorSessions.get(socket.id);

      if (!session) {
        callback({ ok: false, error: 'No operator session found' });
        return;
      }

      console.log(
        `📨 Mensaje de ${session.operatorName} a ${patientPhone}: ${message}`
      );

      // Emitir a clientes conectados
      io.of('/clients').to(patientPhone).emit('new_message', {
        from: 'operator',
        operatorName: session.operatorName,
        message,
        timestamp: new Date(),
      });

      callback({
        ok: true,
        message: 'Mensaje enviado exitosamente',
      });
    });

    // Evento: Operador cierra chat con cliente
    socket.on('close_chat', (data: { patientPhone: string }, callback) => {
      const { patientPhone } = data;
      const session = operatorSessions.get(socket.id);

      if (!session) {
        callback({ ok: false, error: 'No operator session found' });
        return;
      }

      session.activeChats.delete(patientPhone);

      console.log(`❌ Chat cerrado con ${patientPhone}`);

      // Notificar al cliente
      io.of('/clients').to(patientPhone).emit('chat_closed', {
        operatorName: session.operatorName,
        message: 'El operador ha cerrado la conversación',
      });

      callback({
        ok: true,
        message: 'Chat cerrado exitosamente',
      });
    });

    socket.on('disconnect', () => {
      const session = operatorSessions.get(socket.id);
      if (session) {
        console.log(`🔴 Operador desconectado: ${session.operatorName}`);
        operatorSessions.delete(socket.id);
        operatorNamespace.emit('operator_list', getOperatorsList());
      }
    });
  });

  // Namespace para clientes
  const clientNamespace = io.of('/clients');

  clientNamespace.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Evento: Cliente se registra (proporciona su número de teléfono)
    socket.on('register_client', (data: { patientPhone: string }, callback) => {
      const { patientPhone } = data;

      // Join a room con el número de teléfono
      socket.join(patientPhone);

      clientSessions.set(socket.id, {
        socketId: socket.id,
        patientPhone,
        connectedAt: new Date(),
      });

      console.log(`✅ Cliente registrado: ${patientPhone}`);

      callback({
        ok: true,
        message: 'Cliente registrado exitosamente',
        socketId: socket.id,
      });

      // Notificar a operadores que hay un nuevo cliente
      operatorNamespace.emit('new_client', {
        patientPhone,
        timestamp: new Date(),
      });
    });

    // Evento: Cliente envía mensaje
    socket.on('send_message', async (data: { patientPhone: string; message: string }, callback) => {
      const { patientPhone, message } = data;

      console.log(`💬 Mensaje de cliente ${patientPhone}: ${message}`);

      // Emitir a todos los operadores
      operatorNamespace.emit('client_message', {
        patientPhone,
        message,
        timestamp: new Date(),
      });

      callback({
        ok: true,
        message: 'Mensaje enviado a operadores',
      });
    });

    socket.on('disconnect', () => {
      const session = clientSessions.get(socket.id);
      if (session) {
        console.log(`🔴 Cliente desconectado: ${session.patientPhone}`);
        clientSessions.delete(socket.id);

        // Notificar a operadores
        operatorNamespace.emit('client_disconnected', {
          patientPhone: session.patientPhone,
          timestamp: new Date(),
        });
      }
    });
  });

  return io;
}

function getOperatorsList() {
  return Array.from(operatorSessions.values()).map((session) => ({
    operatorId: session.operatorId,
    operatorName: session.operatorName,
    activeChatsCount: session.activeChats.size,
    connectedAt: session.connectedAt,
  }));
}

export { getOperatorsList };
