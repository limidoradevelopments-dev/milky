
// location src/lib/types.ts
// Core application types for the POS system

export interface Product {
  id: string;
  name: string;
  category: "Yogurt" | "Drink" | "Ice Cream" | "Dessert" | "Curd" | "Other";
  price: number;
  wholesalePrice?: number;
  stock: number;
  imageUrl?: string;
  description?: string;
  sku?: string;
  reorderLevel?: number;
  aiHint?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Customer {
  id: string;
  avatar?: string;
  name: string;
  phone: string;
  address?: string;
  shopName?: string;
  status?: 'active' | 'pending';
  createdAt?: Date;
  updatedAt?: Date;
  name_lowercase?: string;
  shopName_lowercase?: string;
}

export interface CartItem {
  id: string; // Product ID
  quantity: number;
  appliedPrice: number; // Price after any sale-specific adjustments (usually same as original or wholesale)
  saleType: 'retail' | 'wholesale';

  // Denormalized product details at the time of sale
  name: string;
  category: Product["category"];
  price: number; // Original retail price of the product at time of sale
  sku?: string; // Original SKU
  imageUrl?: string; // Original Image URL

  isOfferItem?: boolean; // Added for "Buy 12 Get 1 Free"
  returnedQuantity?: number;
}

export interface ChequeInfo {
  number?: string;
  bank?: string;
  date?: Date;
  amount?: number;
}

export interface BankTransferInfo {
  bankName?: string;
  referenceNumber?: string;
  amount?: number;
}

export interface Payment {
  amount: number;
  method: 'Cash' | 'Cheque' | 'BankTransfer' | 'ReturnCredit';
  date: Date;
  notes?: string;
  details?: ChequeInfo | BankTransferInfo;
  staffId: string;
}

export interface Sale {
  id: string;
  customerId?: string;
  customerName?: string;
  customerShopName?: string;
  items: CartItem[];
  subTotal: number;
  discountPercentage: number;
  discountAmount: number;
  totalAmount: number; // Total amount due for the sale

  paidAmountCash?: number;
  paidAmountCheque?: number;
  chequeDetails?: ChequeInfo;
  paidAmountBankTransfer?: number;
  bankTransferDetails?: BankTransferInfo;
  creditUsed?: number;

  additionalPayments?: Payment[];

  totalAmountPaid: number; // Sum of all payments made
  outstandingBalance: number; // totalAmount - totalAmountPaid (if positive, amount due)
  initialOutstandingBalance?: number;
  changeGiven?: number; // If cash_tendered > totalAmount and paid fully by cash (considering cash was the only or last part of payment)

  paymentSummary: string; // e.g., "Cash", "Cheque (123)", "Partial (Cash + Cheque)", "Full Credit"

  saleDate: Date;
  staffId: string;
  staffName?: string;
  offerApplied?: boolean;
  vehicleId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: 'completed' | 'pending' | 'cancelled';
  cancellationReason?: string;
}

export type StockTransactionType =
  | "ADD_STOCK_INVENTORY"
  | "LOAD_TO_VEHICLE"
  | "UNLOAD_FROM_VEHICLE"
  | "REMOVE_STOCK_WASTAGE"
  | "STOCK_ADJUSTMENT_MANUAL"
  | "ISSUE_SAMPLE";

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  productSku?: string;
  type: StockTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  transactionDate: Date;
  notes?: string;
  vehicleId?: string;
  userId?: string;
  startMeter?: number;
  endMeter?: number;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  driverName?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReturnTransaction {
  id: string;
  originalSaleId: string;
  returnDate: Date;
  staffId: string;
  customerId?: string;
  customerName?: string;
  customerShopName?: string;
  returnedItems: CartItem[];
  exchangedItems: CartItem[];
  notes?: string;
  amountPaid?: number;
  paymentSummary?: string;
  chequeDetails?: ChequeInfo;
  bankTransferDetails?: BankTransferInfo;
  changeGiven?: number;
  settleOutstandingAmount?: number;
  refundAmount?: number; // Credit added to customer account
  cashPaidOut?: number; // Cash given back to customer
  createdAt?: Date;
}

export interface Expense {
  id: string;
  category: string;
  description?: string;
  amount: number;
  expenseDate: Date;
  staffId?: string;
  staffName?: string;
  vehicleId?: string;
  createdAt?: Date;
}

export interface StatsData {
  totalSales: number;
  totalCustomers: number;
  lowStockItems: number;
  revenueToday: number;
}

export interface SalesChartData {
  name: string;
  sales: number;
}

export type UserRole = "admin" | "cashier";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  password_hashed_or_plain?: string;
}

export interface NavItemConfig {
  href?: string;
  label: string;
  icon: React.ElementType;
  allowedRoles: UserRole[];
  children?: NavItemConfig[];
  id: string;
}

export interface FullReportEntry {
  transactionId: string;
  transactionType: 'Sale' | 'Return' | 'Sample';
  transactionDate: string;
  transactionTime: string;
  relatedId?: string;
  invoiceCloseDate?: string;
  customerName: string;
  productName: string;
  productCategory: Product["category"];
  quantity: number;
  appliedPrice: number;
  discountOnItem?: number;
  lineTotal: number;
  saleType?: 'retail' | 'wholesale';
  paymentSummary?: Sale["paymentSummary"];
  paymentDetails?: {
    date: Date;
    summary: string;
  }[];
  staffId: string;
}


export interface ActivityItem {
  id: string;
  type: "sale" | "new_product" | "new_customer";
  title: string;
  description: string;
  timestamp: Date;
  icon: React.ElementType;
  avatarUrl?: string;
  avatarFallback?: string;
  aiHint?: string;
}

export interface DayEndReportSummary {
  reportDate: Date;
  totalTransactions: number;
  grossSalesValue: number;
  totalDiscountsToday: number;
  valueOfReturnsToday: number;
  netSalesValue: number;

  cashFromSales: number;
  cashFromCreditPayments: number;
  chequeFromCreditPayments: number;
  bankFromCreditPayments: number;

  totalCashIn: number;
  totalChequeIn: number;
  totalBankTransferIn: number;

  totalRefundsPaidToday: number;
  totalExpensesToday: number;
  netCashInHand: number;

  newCreditIssued: number;
  creditSettledByReturns: number;
  paidAgainstNewCredit: number;
  netOutstandingFromToday: number;

  chequeNumbers: string[];
  bankTransferRefs: string[];
  creditSalesCount: number;
  samplesIssuedCount: number;
  sampleTransactionsCount: number;
  totalFreeItemsCount?: number;
  totalFreeItemsValue?: number;

  // Returns breakdown
  totalReturnsCount: number;
  returnsByExchange: number;
  returnsByRefund: number;
  returnsByCashPaidOut: number;
  returnsByCreditSettled: number;
  totalReturnValue: number;
}


export interface ManagedUser extends Omit<User, 'id'> {
  id: string;
  password?: string;
}

export interface VehicleReportItem {
  productId: string;
  productName: string;
  productSku?: string;
  totalLoaded: number;
  totalUnloaded: number;
  netChange: number;
}
