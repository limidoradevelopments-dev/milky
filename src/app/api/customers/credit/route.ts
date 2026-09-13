
export const runtime = 'nodejs';
import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

async function calculateFinancials(customerId: string): Promise<{ availableCredit: number, outstandingBalance: number }> {
  const [returnsAgg, salesAgg] = await Promise.all([
    prisma.returnTransaction.aggregate({
      _sum: { refundAmount: true },
      where: { customerId },
    }),
    prisma.sale.aggregate({
      _sum: { creditUsed: true, outstandingBalance: true },
      where: { customerId, status: { not: 'cancelled' } },
    }),
  ]);

  const totalRefundsNet = Number(returnsAgg._sum.refundAmount ?? 0);
  const totalCreditUsedOnSales = Number(salesAgg._sum.creditUsed ?? 0);
  const totalOutstandingBalance = Number(salesAgg._sum.outstandingBalance ?? 0);

  return {
    availableCredit: totalRefundsNet - totalCreditUsedOnSales,
    outstandingBalance: totalOutstandingBalance
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('id');

  if (!customerId) {
    return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
  }

  try {
    const { availableCredit, outstandingBalance } = await calculateFinancials(customerId);
    return NextResponse.json({ customerId, availableCredit, outstandingBalance });
  } catch (error) {
    console.error(`Error calculating financials for customer ${customerId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to calculate financials', details: errorMessage }, { status: 500 });
  }
}
