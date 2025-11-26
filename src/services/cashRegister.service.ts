
import type { PrismaClient as TenantPrisma, CashRegister, Prisma } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export class CashRegisterService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  async create(data: Prisma.CashRegisterCreateInput): Promise<CashRegister> {
    return await this.prisma.$transaction(async (tx) => {
      const cashRegister = await tx.cashRegister.create({ data });
      return cashRegister;
    });
  }

  async list(): Promise<CashRegister | null> {
    return await this.prisma.cashRegister.findFirst({
      include: { movements: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async detail(id: string): Promise<CashRegister> {
    const cashRegister = await this.prisma.cashRegister.findUnique({ where: { id }, include: { movements: true } });
    if (!cashRegister) throw new AppError('Caja no encontrada', 404);
    return cashRegister;
  }

  async update(id: string, data: Prisma.CashRegisterUpdateInput): Promise<CashRegister> {
    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashRegister.update({ where: { id }, data });
      return updated;
    });
  }

  async delete(id: string): Promise<CashRegister> {
    // Hard delete: remove the record
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.cashRegister.delete({ where: { id } });
      return deleted;
    });
  }
}
