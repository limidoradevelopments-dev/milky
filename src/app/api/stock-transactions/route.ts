
export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import { StockService } from '@/lib/stockService';

// GET /api/stock-transactions
// GET /api/stock-transactions?vehicleId=<vehicleId>
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vehicleId = searchParams.get('vehicleId');

  try {
    if (vehicleId) {
      const transactions = await StockService.getTransactionsByVehicleId(vehicleId);
      return NextResponse.json(transactions);
    } else {
      const transactions = await StockService.getAllTransactions();
      return NextResponse.json(transactions);
    }
  } catch (error) {
    console.error(`Error fetching stock transactions:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch stock transactions', details: errorMessage }, { status: 500 });
  }
}

// POST /api/stock-transactions - create a single stock transaction
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    // Basic validation
    if (!data || !data.productId || !data.type || typeof data.quantity !== 'number') {
      return NextResponse.json({ error: 'Invalid transaction payload' }, { status: 400 });
    }
    const id = await StockService.createTransaction({
      productId: data.productId,
      productName: data.productName,
      productSku: data.productSku,
      type: data.type,
      quantity: data.quantity,
      previousStock: data.previousStock,
      newStock: data.newStock,
      transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
      notes: data.notes,
      vehicleId: data.vehicleId,
      userId: data.userId,
      startMeter: data.startMeter,
      endMeter: data.endMeter,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('Error creating stock transaction:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to create stock transaction', details: errorMessage }, { status: 500 });
  }
}
