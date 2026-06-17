export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'cashier';
  phone: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  isCustom?: boolean;
  dateAdded: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  barcode: string;
  buyingPrice: number;
  sellingPrice: number;
  quantityInStock: number;
  supplierName: string;
  description: string;
  imageUrl?: string;
  expiryDate?: string; // ISO Date String YYYY-MM-DD
  dateAdded: string;
}

export interface SaleItem {
  id: string; // matches product id
  name: string;
  quantity: number;
  sellingPrice: number;
  buyingPrice: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  items: SaleItem[];
  subtotal: number;
  taxAmount: number; // e.g., 16% VAT in Kenya
  total: number;
  discount?: number;
  paymentMethod: 'Cash' | 'M-Pesa' | 'Bank';
  paymentDetailsRef?: string; // Till / Paybill transaction code or cash change
  paidAmount: number;
  changeAmount: number;
  cashierId: string;
  cashierName: string;
  dateAdded: string; // ISO Date String
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  productsSupplied: string[];
}

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  changeQty: number; // positive for restock, negative for sale/discard
  type: 'restock' | 'sale' | 'discard_expired' | 'adjustment' | 'initial';
  timestamp: string;
  operatorName: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  restorePayload?: string;
}

export interface ShopSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  tillNumber: string;
  paybillNumber: string;
  taxRegistrationNumber: string; // PIN
  receiptHeader: string;
  receiptFooter: string;
}

export interface Expense {
  id: string;
  category: string; // e.g. 'Internet', 'Delivery', 'Utilities', 'Rent', 'Item Purchase', 'Other'
  itemName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  recordedBy: string;
  timestamp: string;
}

