import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/async.handler';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { AppError } from '../utils/app.error';
import type { PrismaClient as TenantPrisma, UserRole } from '../../node_modules/.prisma/tenant-client';

declare global {
  namespace Express {
    interface Request {
      prisma?: TenantPrisma;
      tenant?: {
        code: string;
      };
      user?: {
        sub: string;
        role?: UserRole;
        tenant?: string;
      };
    }
  }
}

function toUserRole(role: string | undefined): UserRole {
  const validRoles: UserRole[] = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'ACCOUNTANT']; 
  if (!role || !validRoles.includes(role as UserRole)) {
    return 'RECEPTIONIST';
  }
  return role as UserRole;
}

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const prisma = req.prisma;
  const tenant = req.tenant;

  if (!prisma || !tenant) {
    throw new AppError('Tenant DB not resolved. Provide X-Tenant-Id header', 400, 'TENANT_NOT_RESOLVED');
  }
console.log(req.body);

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('Invalid request data', 422, 'VALIDATION_ERROR', parsed.error.format());
  }
console.log(parsed);

  const registerData = {
    ...parsed.data,
    role: toUserRole(parsed.data.role)
  };

  const service = new AuthService(prisma, tenant.code);
  
  const created = await service.register(registerData);
  res.status(201).json({ ok: true, user: created });
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const prisma = req.prisma;
  const tenant = req.tenant;

  if (!prisma || !tenant) {
    throw new AppError('Tenant DB not resolved. Provide X-Tenant-Id header', 400, 'TENANT_NOT_RESOLVED');
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('Invalid request data', 422, 'VALIDATION_ERROR', parsed.error.format());
  }

  const service = new AuthService(prisma, tenant.code);
  const { token, user } = await service.login(parsed.data.email, parsed.data.password);

  res.status(200).json({ ok: true, token, user });
});

export const changePasswordController = asyncHandler(async (req: Request, res: Response) => {
  const prisma = req.prisma;
  const tenant = req.tenant;
  const user = req.user;

  if (!prisma || !tenant) {
    throw new AppError('Tenant DB not resolved', 400, 'TENANT_NOT_RESOLVED');
  }
  if (!user || !user.sub) {
    throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new AppError('currentPassword and newPassword are required', 422, 'VALIDATION_ERROR');
  }

  const service = new AuthService(prisma, tenant.code);
  await service.changePassword(user.sub, currentPassword, newPassword);

  res.json({ ok: true, message: 'Password changed' });
});