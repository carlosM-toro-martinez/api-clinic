
import type { PrismaClient as TenantPrisma, CashMovement, Prisma } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export class CashMovementService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  async create(data: Prisma.CashMovementCreateInput): Promise<CashMovement> {
    return await this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({ data });
      await tx.cashRegister.update({
        where: { id: (data as any).cashRegisterId },
        data: { actualAmount: { increment: (data).type === 'INCOME' ? (data).amount : -(data).amount } }
      });
      if ((data as any).invoiceId) {
        await tx.invoice.update({
          where: { id: (data as any).invoiceId },
          data: { cashMovementId: movement.id }
        });
      }
      return movement;
    });
  }

  async list(): Promise<CashMovement[]> {
    return await this.prisma.cashMovement.findMany({ include: { cashRegister: true, user: true } });
  }

  async detail(id: string): Promise<CashMovement> {
    const movement = await this.prisma.cashMovement.findUnique({ where: { id }, include: { cashRegister: true, user: true } });
    if (!movement) throw new AppError('Movimiento no encontrado', 404);
    return movement;
  }

  async update(id: string, data: Prisma.CashMovementUpdateInput): Promise<CashMovement> {
    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.cashMovement.update({ where: { id }, data });
      return updated;
    });
  }

  async delete(id: string): Promise<CashMovement> {
    // Hard delete: remove the record
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.cashMovement.delete({ where: { id } });
      return deleted;
    });
  }
}
