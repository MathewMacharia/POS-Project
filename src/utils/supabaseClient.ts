import { createClient } from "@supabase/supabase-js";
import { User, Category, Product, Sale, Supplier, StockLog, AuditLog, Expense } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://igzozjbppvxwvyeoahle.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_4V_OwnH_TbhhY8QlszTq7w_ZM8VGdA2";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing! Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Mappers ---

export function mapProfile(p: any): User {
  return {
    id: p.id,
    username: p.username,
    fullName: p.full_name,
    email: p.email || "",
    role: p.role,
    phone: p.phone || "",
    active: p.active
  };
}

export function toDbProfile(u: Partial<User> & { pin?: string }) {
  return {
    username: u.username,
    full_name: u.fullName,
    email: u.email,
    role: u.role,
    phone: u.phone,
    active: u.active,
    ...(u.pin ? { pin: u.pin } : {})
  };
}

export function mapCategory(c: any): Category {
  return {
    id: c.id,
    name: c.name,
    isCustom: c.is_custom,
    dateAdded: c.date_added
  };
}

export function mapProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    barcode: p.barcode || "",
    buyingPrice: Number(p.buying_price),
    sellingPrice: Number(p.selling_price),
    quantityInStock: p.quantity_in_stock,
    supplierName: p.supplier_name || "",
    description: p.description || "",
    imageUrl: p.image_url || undefined,
    expiryDate: p.expiry_date || undefined,
    dateAdded: p.date_added
  };
}

export function toDbProduct(p: Partial<Product>) {
  return {
    name: p.name,
    category: p.category,
    barcode: p.barcode,
    buying_price: p.buyingPrice,
    selling_price: p.sellingPrice,
    quantity_in_stock: p.quantityInStock,
    supplier_name: p.supplierName,
    description: p.description,
    image_url: p.imageUrl,
    expiry_date: p.expiryDate || null
  };
}

export function mapSale(s: any): Sale {
  return {
    id: s.id,
    receiptNumber: s.receipt_number,
    items: s.items,
    subtotal: Number(s.subtotal),
    taxAmount: Number(s.tax_amount),
    total: Number(s.total),
    discount: s.discount ? Number(s.discount) : undefined,
    paymentMethod: s.payment_method,
    paymentDetailsRef: s.payment_details_ref || undefined,
    paidAmount: Number(s.paid_amount),
    changeAmount: Number(s.change_amount),
    cashierId: s.cashier_id,
    cashierName: s.cashier_name,
    dateAdded: s.date_added
  };
}

export function toDbSale(s: Sale) {
  return {
    id: s.id.startsWith("sale_") ? undefined : s.id, // Let DB handle uuid generation if desired, or send custom
    receipt_number: s.receiptNumber,
    items: s.items,
    subtotal: s.subtotal,
    tax_amount: s.taxAmount,
    total: s.total,
    discount: s.discount || 0,
    payment_method: s.paymentMethod,
    payment_details_ref: s.paymentDetailsRef || null,
    paid_amount: s.paidAmount,
    change_amount: s.changeAmount,
    cashier_id: s.cashierId.startsWith("usr_") ? null : s.cashierId, // Keep it aligned
    cashier_name: s.cashierName,
    date_added: s.dateAdded
  };
}

export function mapExpense(e: any): Expense {
  return {
    id: e.id,
    category: e.category,
    itemName: e.item_name,
    amount: Number(e.amount),
    date: e.date,
    notes: e.notes || undefined,
    recordedBy: e.recorded_by,
    timestamp: e.timestamp
  };
}

export function toDbExpense(e: Partial<Expense>) {
  return {
    category: e.category,
    item_name: e.itemName,
    amount: e.amount,
    date: e.date,
    notes: e.notes,
    recorded_by: e.recordedBy,
    timestamp: e.timestamp
  };
}

export function mapAuditLog(a: any): AuditLog {
  return {
    id: a.id,
    userId: a.user_id || "system",
    userName: a.user_name,
    action: a.action,
    details: a.details || "",
    timestamp: a.timestamp
  };
}

export function toDbAuditLog(a: AuditLog) {
  return {
    user_id: a.userId.startsWith("usr_") || a.userId === "anonymous" || a.userId === "system" ? null : a.userId,
    user_name: a.userName,
    action: a.action,
    details: a.details,
    timestamp: a.timestamp
  };
}

export function mapSupplier(s: any): Supplier {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone || "",
    email: s.email || "",
    location: s.location || "",
    productsSupplied: s.products_supplied || []
  };
}

export function toDbSupplier(s: Partial<Supplier>) {
  return {
    name: s.name,
    phone: s.phone,
    email: s.email,
    location: s.location,
    products_supplied: s.productsSupplied
  };
}

export function mapStockLog(sl: any): StockLog {
  return {
    id: sl.id,
    productId: sl.product_id,
    productName: sl.product_name,
    changeQty: sl.change_qty,
    type: sl.type,
    timestamp: sl.timestamp,
    operatorName: sl.operator_name,
    notes: sl.notes || undefined
  };
}

export function toDbStockLog(sl: StockLog) {
  return {
    product_id: sl.productId.startsWith("prod_") ? null : sl.productId,
    product_name: sl.productName,
    change_qty: sl.changeQty,
    type: sl.type,
    timestamp: sl.timestamp,
    operator_name: sl.operatorName,
    notes: sl.notes
  };
}

