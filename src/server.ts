import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
dotenv.config();

import { tenantResolver } from './middleware/tenantResolver';
import router from './routes/index';
import routerWpp from './routes/wpp';
import { errorHandler } from './middleware/error.handler';
import { disconnectAllClients } from './lib/prismaManager';
import { tenantResolverForChatbot } from './middleware/tenantResolverForChatbot';
import { initializeSocket } from './lib/socket';
import { setSocketIO } from './controllers/whatsapp.controller';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Crear servidor HTTP para Socket.IO
const httpServer = http.createServer(app);

// Inicializar Socket.IO
const io = initializeSocket(httpServer);

// Pasar Socket.IO al controller
setSocketIO(io);

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));
app.use(tenantResolverForChatbot);

app.use('/api/v1', routerWpp);


app.use(tenantResolver);

app.use('/api/v1', router);

app.get('/', (_req, res) => res.json({ ok: true, message: 'API running' }));

app.use(errorHandler);

// graceful shutdown
process.on('SIGINT', async () => {
  console.log('SIGINT received - disconnecting prisma clients');
  await disconnectAllClients();
  process.exit(0);
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
