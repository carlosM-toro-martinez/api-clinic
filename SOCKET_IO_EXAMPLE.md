// ============================================================================
// EJEMPLO DE USO - Socket.IO Chat Operadores (Frontend)
// ============================================================================

/**
 * PARA OPERADORES
 * ============================================================================
 */

import { io } from 'socket.io-client';

// Conectar al namespace de operadores
const operatorSocket = io('http://localhost:3000/operators', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// --- Conectar operador ---
operatorSocket.on('connect', () => {
  console.log('Conectado al servidor');

  // Registrar operador
  operatorSocket.emit('register_operator', {
    operatorId: 'op-123',  // ID del operador en la BD
    operatorName: 'Juan Pérez'
  }, (response) => {
    console.log('Registro:', response);
  });
});

// --- Obtener lista de chats pendientes ---
function getPendingChats() {
  operatorSocket.emit('get_pending_chats', (response) => {
    if (response.ok) {
      console.log('Chats activos:', response.data.activeChats);
    }
  });
}

// --- Abrir chat con cliente ---
function openChat(patientPhone) {
  operatorSocket.emit('open_chat', { patientPhone }, (response) => {
    console.log('Chat abierto:', response);
  });
}

// --- Enviar mensaje a cliente ---
function sendMessageToClient(patientPhone, message) {
  operatorSocket.emit('send_message', {
    patientPhone,
    message
  }, (response) => {
    console.log('Mensaje enviado:', response);
  });
}

// --- Cerrar chat con cliente ---
function closeChat(patientPhone) {
  operatorSocket.emit('close_chat', { patientPhone }, (response) => {
    console.log('Chat cerrado:', response);
  });
}

// --- Escuchar evento cuando hay un nuevo cliente ---
operatorSocket.on('new_client', (data) => {
  console.log('Nuevo cliente:', data.patientPhone);
  // Aquí puedes mostrar una notificación en la UI
});

// --- Escuchar mensajes de clientes ---
operatorSocket.on('client_message', (data) => {
  console.log(`Mensaje de ${data.patientPhone}:`, data.message);
  // Actualizar la UI con el nuevo mensaje
});

// --- Escuchar cuando un cliente se desconecta ---
operatorSocket.on('client_disconnected', (data) => {
  console.log('Cliente desconectado:', data.patientPhone);
});

// --- Escuchar lista de operadores ---
operatorSocket.on('operator_list', (operators) => {
  console.log('Operadores activos:', operators);
});

operatorSocket.on('disconnect', () => {
  console.log('Desconectado del servidor');
});

/**
 * PARA CLIENTES (WhatsApp que entra por la app)
 * ============================================================================
 */

// Conectar al namespace de clientes
const clientSocket = io('http://localhost:3000/clients', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

// --- Conectar cliente ---
clientSocket.on('connect', () => {
  console.log('Cliente conectado al servidor');

  // Registrar cliente con su número de teléfono
  clientSocket.emit('register_client', {
    patientPhone: '+591234567890'
  }, (response) => {
    console.log('Cliente registrado:', response);
  });
});

// --- Enviar mensaje a operadores ---
function sendClientMessage(message) {
  clientSocket.emit('send_message', {
    patientPhone: '+591234567890',
    message
  }, (response) => {
    console.log('Mensaje enviado a operadores:', response);
  });
}

// --- Escuchar mensajes de operadores ---
clientSocket.on('new_message', (data) => {
  console.log(`Operador ${data.operatorName}:`, data.message);
  // Mostrar mensaje en la UI
});

// --- Escuchar cuando se cierra el chat ---
clientSocket.on('chat_closed', (data) => {
  console.log('Chat cerrado por:', data.operatorName);
  console.log('Mensaje:', data.message);
});

clientSocket.on('disconnect', () => {
  console.log('Cliente desconectado');
});

/**
 * EJEMPLO DE FLUJO EN UNA APP REACT
 * ============================================================================
 */

/*

// Componente para Panel de Operadores
import React, { useEffect, useState } from 'react';

export const OperatorDashboard = () => {
  const [pendingChats, setPendingChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    // Escuchar nuevos clientes
    operatorSocket.on('new_client', (data) => {
      console.log('Nuevo cliente:', data);
      setPendingChats(prev => [...prev, data.patientPhone]);
    });

    // Escuchar mensajes de clientes
    operatorSocket.on('client_message', (data) => {
      if (data.patientPhone === activeChat) {
        setMessages(prev => [...prev, {
          from: 'client',
          text: data.message,
          timestamp: data.timestamp
        }]);
      }
    });

    return () => {
      operatorSocket.off('new_client');
      operatorSocket.off('client_message');
    };
  }, [activeChat]);

  const handleOpenChat = (patientPhone) => {
    setActiveChat(patientPhone);
    openChat(patientPhone);
    setMessages([]);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    sendMessageToClient(activeChat, messageInput);
    setMessages(prev => [...prev, {
      from: 'operator',
      text: messageInput,
      timestamp: new Date()
    }]);
    setMessageInput('');
  };

  return (
    <div className="operator-dashboard">
      <h1>Panel de Operadores</h1>
      
      <div className="chats-list">
        <h2>Clientes Esperando</h2>
        {pendingChats.map(phone => (
          <div key={phone} className="chat-item" onClick={() => handleOpenChat(phone)}>
            {phone}
          </div>
        ))}
      </div>

      {activeChat && (
        <div className="chat-window">
          <h2>Chat con {activeChat}</h2>
          <div className="messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.from}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className="message-input">
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe tu respuesta..."
            />
            <button onClick={handleSendMessage}>Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
};

*/
