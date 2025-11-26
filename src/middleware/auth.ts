import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../node_modules/.prisma/tenant-client';

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export interface JwtPayloadCustom {
  sub: string;
  role?: string;
  tenant?: string;
  iat?: number;
  exp?: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ ok: false, error: 'Authorization header missing' });

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token)
    return res.status(401).json({ ok: false, error: 'Invalid Authorization header format' });

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not defined in environment');
    return res.status(500).json({ ok: false, error: 'Server misconfiguration' });
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayloadCustom;
    const role =
      payload.role && Object.values(UserRole).includes(payload.role as UserRole)
        ? (payload.role as UserRole)
        : undefined;

    req.user = {
      sub: payload.sub,
      role,
      tenant: payload.tenant ?? undefined,
    };

    if (payload.tenant && !req.headers['x-tenant-id']) {
      req.headers['x-tenant-id'] = payload.tenant as any;
    }

    return next();
  } catch (err) {
    console.error('JWT verify error:', err);
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}
