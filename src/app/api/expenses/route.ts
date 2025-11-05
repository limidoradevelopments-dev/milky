export const runtime = 'nodejs';

import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { type Expense } from '@/lib/types';

// GET /api/expenses - Fetch all expenses
export async function GET(request: NextRequest) {
  try {
    const rows = await prisma.expense.findMany({ orderBy: { expenseDate: 'desc' } });
    const expenses: Expense[] = rows.map(e => ({
      id: e.id,
      category: e.category,
      description: e.description || undefined,
      amount: Number(e.amount),
      expenseDate: e.expenseDate,
      staffId: e.staffId || undefined,
      vehicleId: e.vehicleId || undefined,
      createdAt: e.createdAt || undefined,
    }));
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch expenses', details: errorMessage }, { status: 500 });
  }
}

// POST /api/expenses - Add a new expense
export async function POST(request: NextRequest) {
  try {
    const expenseData = (await request.json()) as Omit<Expense, 'id' | 'createdAt'>;
    
    if (!expenseData || !expenseData.category || !expenseData.amount || expenseData.amount <= 0 || !expenseData.staffId) {
      return NextResponse.json({ error: 'Missing required fields (category, amount, staffId)' }, { status: 400 });
    }
    
    // Ensure date is handled correctly and include optional vehicleId
    const finalExpenseData = {
        ...expenseData,
        expenseDate: expenseData.expenseDate ? new Date(expenseData.expenseDate) : new Date(),
        vehicleId: expenseData.vehicleId || undefined,
    };

    const created = await prisma.expense.create({
      data: {
        category: finalExpenseData.category,
        description: finalExpenseData.description ?? null,
        amount: finalExpenseData.amount,
        expenseDate: finalExpenseData.expenseDate,
        staffId: finalExpenseData.staffId ?? null,
        vehicleId: finalExpenseData.vehicleId ?? null,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: created.id, ...finalExpenseData }, { status: 201 });
  } catch (error) {
    console.error('Error adding expense:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to add expense', details: errorMessage }, { status: 500 });
  }
}

// DELETE /api/expenses?id=<expenseId> - Delete an expense
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const expenseId = searchParams.get('id');

    if (!expenseId) {
        return NextResponse.json({ error: 'Expense ID is required for deletion' }, { status: 400 });
    }

    try {
        await prisma.expense.delete({ where: { id: expenseId } });
        return NextResponse.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to delete expense', details: errorMessage }, { status: 500 });
    }
}
