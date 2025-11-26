
import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

export class PaymentService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  async create(data: any) {
    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data });
      if (data.invoiceId) {
        await tx.invoice.update({
          where: { id: data.invoiceId },
          data: { status: 'PAID' }
        });
      }
      if (data.cashRegisterId) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: data.cashRegisterId,
            userId: data.paidById,
            type: 'INCOME',
            amount: data.amount,
            description: `Pago de factura ${data.invoiceId}`,
          }
        });
        await tx.cashRegister.update({
          where: { id: data.cashRegisterId },
          data: { actualAmount: { increment: data.amount } }
        });
      }
      return payment;
    });
  }

  async list() {
    return await this.prisma.payment.findMany();
  }

  async detail(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new AppError('Pago no encontrado', 404);
    return payment;
  }

  async update(id: string, data: any) {
    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({ where: { id }, data });
      return updated;
    });
  }

  async delete(id: string) {
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.payment.delete({ where: { id } });
      return deleted;
    });
  }
}
