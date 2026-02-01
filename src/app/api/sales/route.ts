export const runtime = 'nodejs';


import { NextResponse, type NextRequest } from 'next/server';
import { addSale, getSales } from '@/lib/dataService';
import type { Sale, CartItem, ChequeInfo, BankTransferInfo } from '@/lib/types';

// GET /api/sales - Fetch sales with optional pagination or search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const cursor = searchParams.get('cursor'); // ID of last item from previous page
    const searchTerm = searchParams.get('search'); // Server-side search term

    // If search term is provided, fetch ALL matching invoices (no pagination)
    if (searchTerm && searchTerm.trim().length > 0) {
      const lowerSearch = searchTerm.trim().toLowerCase();
      const result = await getSalesWithSearch(lowerSearch);
      return NextResponse.json(result);
    }

    // Normal paginated fetch
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const result = await getSales(limit, cursor);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching sales:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch sales', details: errorMessage }, { status: 500 });
  }
}

// Server-side search function - fetches ALL matching sales without pagination
async function getSalesWithSearch(searchTerm: string): Promise<{ sales: Sale[], hasMore: boolean, nextCursor: null }> {
  const { PrismaClient } = await import('@/generated/client');
  const prisma = (await import('@/lib/prisma')).default;

  const rows = await prisma.sale.findMany({
    where: {
      OR: [
        { id: { contains: searchTerm, mode: 'insensitive' } },
        { customerName: { contains: searchTerm, mode: 'insensitive' } },
        { customerShopName: { contains: searchTerm, mode: 'insensitive' } },
        { paymentSummary: { contains: searchTerm, mode: 'insensitive' } },
      ],
    },
    include: {
      items: true,
      returns: {
        include: {
          items: true
        }
      },
      payments: true
    },
    orderBy: { saleDate: 'desc' },
  });

  // Map rows to Sale type (reusing logic from getSales in dataService)
  const sales: Sale[] = rows.map(s => {
    const returnedQuantities = new Map<string, number>();
    s.returns.forEach(returnTx => {
      returnTx.items.forEach(returnItem => {
        if (returnItem.lineType === 'returned') {
          const key = `${returnItem.productId}-${returnItem.saleType}`;
          returnedQuantities.set(key, (returnedQuantities.get(key) || 0) + returnItem.quantity);
        }
      });
    });

    const items: CartItem[] = s.items.map(item => {
      const key = `${item.productId}-${item.saleType}`;
      const returnedQty = returnedQuantities.get(key) || 0;
      return {
        id: item.productId,
        quantity: item.quantity,
        appliedPrice: Number(item.appliedPrice),
        saleType: item.saleType as 'retail' | 'wholesale',
        name: item.name,
        category: item.category as CartItem['category'],
        price: Number(item.price),
        sku: item.sku || undefined,
        imageUrl: item.imageUrl || undefined,
        isOfferItem: item.isOfferItem,
        returnedQuantity: returnedQty > 0 ? returnedQty : undefined,
      };
    });

    return {
      id: s.id,
      items,
      subTotal: Number(s.subTotal),
      discountPercentage: Number(s.discountPercentage),
      discountAmount: Number(s.discountAmount),
      totalAmount: Number(s.totalAmount),
      paidAmountCash: s.paidAmountCash ? Number(s.paidAmountCash) : undefined,
      paidAmountCheque: s.paidAmountCheque ? Number(s.paidAmountCheque) : undefined,
      chequeDetails: undefined,
      paidAmountBankTransfer: s.paidAmountBankTransfer ? Number(s.paidAmountBankTransfer) : undefined,
      bankTransferDetails: undefined,
      creditUsed: s.creditUsed ? Number(s.creditUsed) : undefined,
      additionalPayments: s.payments.map(p => ({
        amount: Number(p.amount),
        method: p.method as 'Cash' | 'Cheque' | 'BankTransfer' | 'ReturnCredit',
        date: p.date,
        staffId: p.staffId,
        notes: p.notes || undefined,
        details: p.chequeNumber ? {
          number: p.chequeNumber,
          bank: p.chequeBank || undefined,
          date: p.chequeDate || undefined,
          amount: p.chequeAmount ? Number(p.chequeAmount) : undefined,
        } : p.bankName ? {
          bankName: p.bankName,
          referenceNumber: p.referenceNumber || undefined,
          amount: p.bankAmount ? Number(p.bankAmount) : undefined,
        } : undefined,
      })),
      totalAmountPaid: Number(s.totalAmountPaid),
      outstandingBalance: Number(s.outstandingBalance),
      initialOutstandingBalance: s.initialOutstandingBalance ? Number(s.initialOutstandingBalance) : undefined,
      changeGiven: s.changeGiven ? Number(s.changeGiven) : undefined,
      paymentSummary: s.paymentSummary,
      saleDate: s.saleDate,
      staffId: s.staffId,
      staffName: s.staffName || undefined,
      customerId: s.customerId || undefined,
      customerName: s.customerName || undefined,
      customerShopName: s.customerShopName || undefined,
      offerApplied: s.offerApplied,
      vehicleId: s.vehicleId || undefined,
      createdAt: s.createdAt || undefined,
      updatedAt: s.updatedAt || undefined,
      status: s.status as 'completed' | 'pending' | 'cancelled',
      cancellationReason: s.cancellationReason || undefined,
    };
  });

  return { sales, hasMore: false, nextCursor: null };
}

// POST /api/sales - Add a new sale and update stock
export async function POST(request: NextRequest) {
  try {
    const saleDataFromClient = await request.json();

    // --- Start Aggressive Validation ---
    if (!saleDataFromClient || !Array.isArray(saleDataFromClient.items) || saleDataFromClient.items.length === 0) {
      return NextResponse.json({ error: 'Invalid sale data: Items are missing or empty.' }, { status: 400 });
    }

    const requiredNumericFields = ['subTotal', 'discountAmount', 'totalAmount', 'totalAmountPaid', 'outstandingBalance'];
    for (const field of requiredNumericFields) {
      if (typeof saleDataFromClient[field] !== 'number') {
        return NextResponse.json({ error: `Invalid sale data: Field '${field}' is missing or not a number.` }, { status: 400 });
      }
    }

    if (typeof saleDataFromClient.paymentSummary !== 'string') {
      return NextResponse.json({ error: 'Invalid sale data: Missing payment summary string.' }, { status: 400 });
    }
    // --- End Validation ---

    const saleDate = saleDataFromClient.saleDate ? new Date(saleDataFromClient.saleDate) : new Date();

    // --- Start Definitive Defensive Payload Construction ---
    const payload: Omit<Sale, 'id'> = {
      // These are now guaranteed to be present and of the correct type by validation above
      items: saleDataFromClient.items,
      subTotal: saleDataFromClient.subTotal,
      discountAmount: saleDataFromClient.discountAmount,
      totalAmount: saleDataFromClient.totalAmount,
      totalAmountPaid: saleDataFromClient.totalAmountPaid,
      outstandingBalance: saleDataFromClient.outstandingBalance,
      paymentSummary: saleDataFromClient.paymentSummary,

      // These have safe defaults
      saleDate: saleDate,
      staffId: saleDataFromClient.staffId || "staff001",
      offerApplied: saleDataFromClient.offerApplied || false,
      discountPercentage: saleDataFromClient.discountPercentage || 0,

      // Handle optional fields safely to prevent 'undefined'
      customerId: saleDataFromClient.customerId || undefined,
      customerName: saleDataFromClient.customerName || undefined,
      customerShopName: saleDataFromClient.customerShopName || undefined,
      staffName: saleDataFromClient.staffName || undefined,
      vehicleId: saleDataFromClient.vehicleId || undefined,
      paidAmountCash: saleDataFromClient.paidAmountCash || undefined,
      paidAmountCheque: saleDataFromClient.paidAmountCheque || undefined,
      paidAmountBankTransfer: saleDataFromClient.paidAmountBankTransfer || undefined,
      creditUsed: saleDataFromClient.creditUsed || undefined,
      changeGiven: saleDataFromClient.changeGiven || undefined,
    };

    if (payload.outstandingBalance > 0) {
      payload.initialOutstandingBalance = payload.outstandingBalance;
    }

    if (saleDataFromClient.chequeDetails) {
      const details: ChequeInfo = {};
      if (saleDataFromClient.chequeDetails.number) details.number = saleDataFromClient.chequeDetails.number;
      if (saleDataFromClient.chequeDetails.bank) details.bank = saleDataFromClient.chequeDetails.bank;
      if (saleDataFromClient.chequeDetails.date) details.date = new Date(saleDataFromClient.chequeDetails.date);
      if (saleDataFromClient.chequeDetails.amount !== undefined) details.amount = saleDataFromClient.chequeDetails.amount;
      if (Object.keys(details).length > 0) payload.chequeDetails = details;
    }

    if (saleDataFromClient.bankTransferDetails) {
      const details: BankTransferInfo = {};
      if (saleDataFromClient.bankTransferDetails.bankName) details.bankName = saleDataFromClient.bankTransferDetails.bankName;
      if (saleDataFromClient.bankTransferDetails.referenceNumber) details.referenceNumber = saleDataFromClient.bankTransferDetails.referenceNumber;
      if (saleDataFromClient.bankTransferDetails.amount !== undefined) details.amount = saleDataFromClient.bankTransferDetails.amount;
      if (Object.keys(details).length > 0) payload.bankTransferDetails = details;
    }
    // --- End Defensive Payload Construction ---

    const saleId = await addSale(payload);

    return NextResponse.json({ id: saleId, ...payload, saleDate: saleDate.toISOString() }, { status: 201 });

  } catch (error) {
    console.error('Error processing sale:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    if (errorMessage.includes("not found for stock update")) {
      return NextResponse.json({ error: 'Failed to process sale: Product not found for stock update.', details: errorMessage }, { status: 404 });
    }
    if (errorMessage.includes("Insufficient stock")) {
      return NextResponse.json({ error: 'Failed to process sale: Insufficient stock for one or more items.', details: errorMessage }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to process sale', details: errorMessage }, { status: 500 });
  }
}
