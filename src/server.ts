import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

import { tenantResolver } from './middleware/tenantResolver';
import router from './routes/index';
import { errorHandler } from './middleware/error.handler';
import { disconnectAllClients } from './lib/prismaManager';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
