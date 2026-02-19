
import type { PrismaClient as TenantPrisma, UserRole } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

interface CreateUserData {
  firstName: string;
  lastName: string;
  ciNumber?: string | null;
  email: string;
  phone?: string | null;
  passwordHash: string;
  role: UserRole;
  specialties?: string[];
}

export class UserService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

async create(data: CreateUserData): Promise<import('../../node_modules/.prisma/tenant-client').User> {
  return await this.prisma.$transaction(async (tx) => {
    const { specialties, ...userData } = data;
    const user = await tx.user.create({ 
      data: userData 
    });
    if (user.role === 'DOCTOR' && specialties && Array.isArray(specialties)) {
      const doctorSpecialtyData = specialties.map((specialtyId: string) => ({
        doctorId: user.id,
        specialtyId: specialtyId,
      }));

      await tx.doctorSpecialty.createMany({
        data: doctorSpecialtyData,
        skipDuplicates: true,
      });
    }
    return user;
  });
}

  async list(includeInactive: boolean = false): Promise<import('../../node_modules/.prisma/tenant-client').User[]> {
    const where = includeInactive
      ? {}
      : { isActive: true, deletedAt: null };

    return await this.prisma.user.findMany({
      where,
      include: {
        specialties: {
          include: {
            specialty: true
          }
        }
      },
    });
  }

  async listDoctors(): Promise<import('../../node_modules/.prisma/tenant-client').User[]> {
    return await this.prisma.user.findMany({
      where: { 
        role: 'DOCTOR',
        isActive: true,
        deletedAt: null
      },
      include: {
        specialties: {
          include: {
            specialty: true
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });
  }

  async detail(id: string): Promise<import('../../node_modules/.prisma/tenant-client').User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('Usuario no encontrado', 404);
    return user;
  }

async update(id: string, data: any): Promise<import('../../node_modules/.prisma/tenant-client').User> {
  return await this.prisma.$transaction(async (tx) => {
    const { specialties, ...userData } = data;
    const updated = await tx.user.update({ 
      where: { id }, 
      data: userData 
    });

    if (updated.role === 'DOCTOR') {
      if (specialties && Array.isArray(specialties)) {
        await tx.doctorSpecialty.deleteMany({
          where: { doctorId: updated.id }
        });

        if (specialties.length > 0) {
          const doctorSpecialtyData = specialties.map((specialtyId: string) => ({
            doctorId: updated.id,
            specialtyId: specialtyId,
          }));

          await tx.doctorSpecialty.createMany({
            data: doctorSpecialtyData,
            skipDuplicates: true,
          });
        }
      }
    } else {
      await tx.doctorSpecialty.deleteMany({
        where: { doctorId: updated.id }
      });
    }

    return updated;
  });
}

  async delete(id: string): Promise<import('../../node_modules/.prisma/tenant-client').User> {
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.user.delete({ where: { id } });
      return deleted;
    });
  }

  async deactivate(id: string): Promise<import('../../node_modules/.prisma/tenant-client').User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date()
      }
    });
  }
}
