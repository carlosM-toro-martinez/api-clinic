// src/types/express.d.ts
import type { PrismaClient } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      prisma?: PrismaClient;
      tenant?: { id: string; code: string; name?: string; dbName?: string } | null;
      user?: {
        sub: string;
        role?: string | undefined;
        tenant?: string | undefined;
      } | null;
    }
  }
}

export {};
