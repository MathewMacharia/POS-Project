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
    id: u.id,
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
    id: p.id,
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
    id: s.id,
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
    cashier_id: s.cashierId,
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
    id: e.id,
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
    id: a.id || undefined,
    user_id: a.userId === "anonymous" || a.userId === "system" ? null : a.userId,
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
    id: s.id,
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
    id: sl.id || undefined,
    product_id: sl.productId,
    product_name: sl.productName,
    change_qty: sl.changeQty,
    type: sl.type,
    timestamp: sl.timestamp,
    operator_name: sl.operatorName,
    notes: sl.notes
  };
}

// --- Offline & Sync System ---

const CACHE_KEYS: Record<string, string> = {
  profiles: 'dufuka_offline_profiles',
  categories: 'dufuka_offline_categories',
  products: 'dufuka_offline_products',
  sales: 'dufuka_offline_sales',
  expenses: 'dufuka_offline_expenses',
  audit_logs: 'dufuka_offline_audit_logs',
  suppliers: 'dufuka_offline_suppliers',
  stock_logs: 'dufuka_offline_stock_logs'
};

interface QueueItem {
  id: string; // sync item action id
  action: 'insert' | 'update' | 'delete';
  table: string;
  payload: any;
  targetId?: string;
}

export function getLocalCache(table: string, fallback: any[] = []): any[] {
  try {
    const key = CACHE_KEYS[table] || `dufuka_offline_${table}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

export function setLocalCache(table: string, data: any[]) {
  try {
    const key = CACHE_KEYS[table] || `dufuka_offline_${table}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("LocalCache save failed:", err);
  }
}

function getSyncQueue(): QueueItem[] {
  try {
    const q = localStorage.getItem('dufuka_sync_queue');
    return q ? JSON.parse(q) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue: QueueItem[]) {
  localStorage.setItem('dufuka_sync_queue', JSON.stringify(queue));
}

export function queueAction(action: 'insert' | 'update' | 'delete', table: string, payload: any, targetId?: string) {
  const queue = getSyncQueue();
  queue.push({
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    action,
    table,
    payload,
    targetId
  });
  saveSyncQueue(queue);
  triggerSync();
}

let isSyncing = false;

export async function triggerSync(onSyncSuccess?: () => void) {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  const queue = getSyncQueue();
  if (queue.length === 0) {
    isSyncing = false;
    return;
  }

  console.log(`[Offline Sync] Starting sync of ${queue.length} pending actions.`);

  const remainingQueue: QueueItem[] = [];
  let hasNetworkError = false;

  for (const item of queue) {
    if (hasNetworkError) {
      remainingQueue.push(item);
      continue;
    }

    try {
      if (item.action === 'insert') {
        const { error } = await supabase.from(item.table).insert([item.payload]);
        if (error) {
          console.error(`[Offline Sync] Insert error for ${item.table}:`, error);
        }
      } else if (item.action === 'update') {
        const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.targetId);
        if (error) {
          console.error(`[Offline Sync] Update error for ${item.table}:`, error);
        }
      } else if (item.action === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.targetId);
        if (error) {
          console.error(`[Offline Sync] Delete error for ${item.table}:`, error);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('network'))) {
        console.warn("[Offline Sync] Network connectivity lost. Halting sync queue.");
        hasNetworkError = true;
        remainingQueue.push(item);
      } else {
        console.error(`[Offline Sync] Error processing queue item:`, err);
      }
    }
  }

  saveSyncQueue(remainingQueue);
  isSyncing = false;

  if (!hasNetworkError && remainingQueue.length === 0 && onSyncSuccess) {
    onSyncSuccess();
  }
}


