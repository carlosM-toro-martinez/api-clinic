import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient as PrismaMasterClient } from '.prisma/master-client';
import { getPrismaClientForDatabase } from '../lib/prismaManager';

const MASTER_DB_URL = process.env.MASTER_DATABASE_URL;
if (!MASTER_DB_URL) {
  throw new Error('MASTER_DATABASE_URL is not defined in .env');
}

const masterPrisma = new PrismaMasterClient({
  datasources: { dbMaster: { url: MASTER_DB_URL } },
});

export async function tenantResolverForChatbot(req: Request, res: Response, next: NextFunction) {
  try {
    console.log(req.body?.entry);
    const tenantCode = 'velasco';
    const tenant = await masterPrisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      return res.status(404).json({ ok: false, error: 'Tenant not found' });
    }
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
