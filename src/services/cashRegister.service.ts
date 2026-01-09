
import type { PrismaClient as TenantPrisma, CashRegister, Prisma } from '../../node_modules/.prisma/tenant-client';
import { Decimal } from '@prisma/client/runtime/library';
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
    const cashRegister = await this.prisma.cashRegister.findFirst({
      include: { movements: true },
      orderBy: { openedAt: 'desc' },
    });
    if (!cashRegister) {
      throw new AppError('No hay registros de cajas', 404);
    }
    if (cashRegister.status === 'CLOSED') {
      throw new AppError('No existen cajas abiertas', 400);
    }

    return cashRegister;
  }

  async listAll(): Promise<CashRegister[] | null> {
    const cashRegister = await this.prisma.cashRegister.findMany({
      include: { movements: true },
      orderBy: { openedAt: 'desc' },
    });
    if (!cashRegister) {
      throw new AppError('No hay registros de cajas', 404);
    }
    return cashRegister;
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
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.cashRegister.delete({ where: { id } });
      return deleted;
    });
  }

  async close(id: string, closingData?: { 
    closingAmount?: number | string | Decimal;
    notes?: string;
    countedAmount?: number | string | Decimal;
  }): Promise<CashRegister> {
    console.log(closingData);
    
    return await this.prisma.$transaction(async (tx) => {
      const cashRegister = await tx.cashRegister.findUnique({
        where: { id },
        include: { movements: true }
      });

      if (!cashRegister) {
        throw new AppError('Caja no encontrada', 404);
      }

      if (cashRegister.status !== 'OPEN') {
        throw new AppError('La caja ya está cerrada', 400);
      }

      const openingAmount = new Decimal(cashRegister.openingAmount);
      const actualAmount = new Decimal(cashRegister.actualAmount || 0);
      
      let closingAmount: Decimal;
      if (closingData?.closingAmount) {
        closingAmount = new Decimal(closingData.closingAmount);
      } else if (closingData?.countedAmount) {
        closingAmount = new Decimal(closingData.countedAmount);
      } else {
        closingAmount = actualAmount;
      }

      const difference = closingAmount.minus(actualAmount);

      const closingNotes = closingData?.notes || this.generateClosingNotes(
        cashRegister.notes,
        openingAmount,
        closingAmount,
        difference
      );

      const updatedCashRegister = await tx.cashRegister.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closingAmount,
          actualAmount: closingAmount,
          difference,
          closedAt: new Date(),
          notes: closingNotes,
        }
      });

      await tx.cashMovement.create({
        data: {
          cashRegisterId: id,
          userId: cashRegister.userId,
          type: 'INCOME',
          amount: closingAmount.minus(openingAmount),
          description: `CIERRE DE CAJA - Diferencia: ${difference} BOB`,
          createdAt: new Date()
        }
      });

      return {
        ...updatedCashRegister,
        movements: cashRegister.movements
      };
    });
  }

   private generateClosingNotes(
    openingNotes: string | null,
    openingAmount: Decimal,
    closingAmount: Decimal,
    difference: Decimal
  ): string {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let notes = `--- CIERRE DE CAJA ---\n`;
    notes += `Fecha: ${formattedDate}\n`;
    notes += `Monto de apertura: ${openingAmount} BOB\n`;
    notes += `Monto de cierre: ${closingAmount} BOB\n`;
    notes += `Diferencia: ${difference} BOB\n`;
    
    if (difference.greaterThan(0)) {
      notes += `✅ SOBRANTE\n`;
    } else if (difference.lessThan(0)) {
      notes += `❌ FALTANTE\n`;
    } else {
      notes += `✅ CUADRADO PERFECTO\n`;
    }

    if (openingNotes) {
      notes += `\nNotas de apertura: ${openingNotes}`;
    }

    return notes;
  }

}
