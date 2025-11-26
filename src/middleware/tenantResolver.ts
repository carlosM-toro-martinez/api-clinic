import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient as PrismaMasterClient } from '../../node_modules/.prisma/master-client';
import { getPrismaClientForDatabase } from '../lib/prismaManager';

const MASTER_DB_URL = process.env.MASTER_DATABASE_URL;
if (!MASTER_DB_URL) {
  throw new Error('MASTER_DATABASE_URL is not defined in .env');
}

// Prisma para la DB master
const masterPrisma = new PrismaMasterClient({
  datasources: { dbMaster: { url: MASTER_DB_URL } },
});

export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  try {
    // 1️⃣ Obtener tenant desde header o subdominio
    const headerTenant = req.headers['x-tenant-id'] as string | undefined;
    let tenantCode = headerTenant;

    if (!tenantCode) {
      const hostHeader = req.headers.host ?? '';
      const parts = hostHeader.split('.');
      if (parts.length > 2 && parts[0]) tenantCode = parts[0];
    }

    if (!tenantCode) {
      return res.status(400).json({
        ok: false,
        error: 'Tenant not specified (set X-Tenant-Id header or use subdomain).',
      });
    }

    // 2️⃣ Buscar tenant en master DB
    const tenant = await masterPrisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      return res.status(404).json({ ok: false, error: 'Tenant not found' });
    }

    // 3️⃣ Construir URL de conexión del tenant
    const stored = (tenant).dbName as string | undefined;
    if (!stored) {
      return res.status(500).json({ ok: false, error: 'Tenant record missing dbName' });
    }

    const tenantDbUrl = stored.startsWith('postgresql://')
      ? stored
      : `postgresql://${process.env.POSTGRES_USER ?? 'postgres'}:${process.env.POSTGRES_PASSWORD ?? 'postgres'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5438'}/${stored}?schema=public`;

    const prisma = getPrismaClientForDatabase(tenantDbUrl);

    (req).prisma = prisma;
    (req as any).tenant = {
      id: tenant.id,
      code: tenant.code,
      name: tenant.name,
      dbName: tenant.dbName,
    };

    return next();
  } catch (error) {
    console.error('tenantResolver error', error);
    return next(error as Error);
  }
}
