// src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PrismaClient as TenantPrisma, UserRole } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export type AuthPayload = {
  sub: string;
  role?: UserRole;
  tenant?: string;
  iat?: number;
  exp?: number;
};

type RegisterPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  role?: UserRole;
  specialties?: string[]
};

type UserResponse = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
};

export class AuthService {
  private prisma: TenantPrisma;
  private tenantCode: string
  private jwtSecret: string;

  constructor(prisma: TenantPrisma, tenantCode?: string) {
    this.prisma = prisma;
    this.tenantCode = tenantCode ?? '';
    this.jwtSecret = process.env.JWT_SECRET ?? '';
    
    if (!this.jwtSecret) {
      throw new AppError('JWT_SECRET is not configured in environment', 500, 'CONFIG_ERROR');
    }
  }

async register(payload: RegisterPayload): Promise<UserResponse> {
  const { firstName, lastName, phone, email, password, role = 'RECEPTIONIST' as UserRole, specialties } = payload;
console.log(payload);

  const existing = await this.prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('User already exists with that email', 409, 'USER_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return await this.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName,
        lastName,
        phone,
        email,
        passwordHash,
        role,
      },
    });

    if (role === 'DOCTOR' && specialties && specialties.length > 0) {
      const doctorSpecialtyData = specialties.map((specialtyId: string) => ({
        doctorId: user.id,
        specialtyId: specialtyId,
      }));

      await tx.doctorSpecialty.createMany({
        data: doctorSpecialtyData,
        skipDuplicates: true,
      });
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    };
  });
}

  async login(email: string, password: string): Promise<{ token: string; user: UserResponse }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    // Asegurar que tenant siempre sea string
    const tokenPayload: AuthPayload = { 
      sub: user.id, 
      role: user.role, 
      tenant: this.tenantCode || '' 
    };
    
    const token = this.generateToken(tokenPayload, '8h');

    return {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  }

generateToken(payload: AuthPayload, expiresIn: jwt.SignOptions['expiresIn'] = '8h'): string {
  return jwt.sign(payload, this.jwtSecret, { expiresIn });
}


  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new AppError('Current password incorrect', 400, 'INVALID_PASSWORD');

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ 
      where: { id: userId }, 
      data: { passwordHash: newHash } 
    });

    return { ok: true };
  }
}