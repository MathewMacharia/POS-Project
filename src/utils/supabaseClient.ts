import { createClient } from "@supabase/supabase-js";
import { User, Category, Product, Sale, Supplier, StockLog, AuditLog, Expense } from "../types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://igzozjbppvxwvyeoahle.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_4V_OwnH_TbhhY8QlszTq7w_ZM8VGdA2";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing! Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getLocalISOString(date: Date): string {
  const tzOffset = -date.getTimezoneOffset();
  const diff = tzOffset >= 0 ? '+' : '-';
  const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    diff + pad(tzOffset / 60) +
    ':' + pad(tzOffset % 60);
}

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
  let details = a.details || "";
  let restorePayload: string | undefined;
  if (details.includes(" |__RESTORE_PAYLOAD__| ")) {
    const parts = details.split(" |__RESTORE_PAYLOAD__| ");
    details = parts[0];
    restorePayload = parts[1];
  }
  return {
    id: a.id,
    userId: a.user_id || "system",
    userName: a.user_name,
    action: a.action,
    details: details,
    timestamp: a.timestamp,
    restorePayload: restorePayload
  };
}

export function toDbAuditLog(a: AuditLog) {
  let finalDetails = a.details;
  if (a.restorePayload) {
    finalDetails = `${a.details} |__RESTORE_PAYLOAD__| ${a.restorePayload}`;
  }
  return {
    id: a.id || undefined,
    user_id: a.userId === "anonymous" || a.userId === "system" ? null : a.userId,
    user_name: a.userName,
    action: a.action,
    details: finalDetails,
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
import Dexie, { type Table } from 'dexie';

class DufukaDatabase extends Dexie {
  profiles!: Table<any>;
  categories!: Table<any>;
  products!: Table<any>;
  sales!: Table<any>;
  expenses!: Table<any>;
  audit_logs!: Table<any>;
  suppliers!: Table<any>;
  stock_logs!: Table<any>;

  constructor() {
    super('DufukaPOSDatabase');
    this.version(1).stores({
      profiles: 'id, username, role, active',
      categories: 'id, name',
      products: 'id, name, category, barcode',
      sales: 'id, receiptNumber, total, cashierId, dateAdded',
      expenses: 'id, category, itemName, date',
      audit_logs: 'id, userId, userName, action, timestamp',
      suppliers: 'id, name',
      stock_logs: 'id, productId, productName, type, timestamp'
    });
  }
}

export const db = new DufukaDatabase();

interface QueueItem {
  id: string; // sync item action id
  action: 'insert' | 'update' | 'delete';
  table: string;
  payload: any;
  targetId?: string;
}

export async function getLocalCache(table: string, fallback: any[] = []): Promise<any[]> {
  try {
    const t = (db as any)[table];
    if (!t) return fallback;
    const data = await t.toArray();
    return data && data.length > 0 ? data : fallback;
  } catch (err) {
    console.error(`getLocalCache error for table ${table}:`, err);
    return fallback;
  }
}

export async function setLocalCache(table: string, data: any[]) {
  try {
    const t = (db as any)[table];
    if (!t) return;
    await t.clear();
    if (data && data.length > 0) {
      await t.bulkAdd(data);
    }
  } catch (err) {
    console.error(`setLocalCache error for table ${table}:`, err);
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

export function queueActions(actions: { action: 'insert' | 'update' | 'delete', table: string, payload: any, targetId?: string }[]) {
  const queue = getSyncQueue();
  actions.forEach(act => {
    queue.push({
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: act.action,
      table: act.table,
      payload: act.payload,
      targetId: act.targetId
    });
  });
  saveSyncQueue(queue);
  triggerSync();
}

let isSyncing = false;

function isTransientError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  const status = error.status || 0;
  
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('connection') ||
    msg.includes('abort') ||
    code === 'PGRST102' ||
    status === 0 ||
    status >= 500
  );
}

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
        const { error } = await supabase.from(item.table).upsert([item.payload]);
        if (error) {
          console.error(`[Offline Sync] Insert/Upsert error for ${item.table}:`, error);
          if (error.code === '23505') {
            console.warn(`[Offline Sync] Row already exists in ${item.table}. Skipping queue item.`);
          } else if (isTransientError(error)) {
            throw new Error(`Transient: ${error.message || 'database timeout'}`);
          }
        }
      } else if (item.action === 'update') {
        const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.targetId);
        if (error) {
          console.error(`[Offline Sync] Update error for ${item.table}:`, error);
          if (isTransientError(error)) {
            throw new Error(`Transient: ${error.message || 'database timeout'}`);
          }
        }
      } else if (item.action === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.targetId);
        if (error) {
          console.error(`[Offline Sync] Delete error for ${item.table}:`, error);
          if (isTransientError(error)) {
            throw new Error(`Transient: ${error.message || 'database timeout'}`);
          }
        }
      }
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('failed to fetch') || errMsg.includes('network') || errMsg.includes('timeout') || errMsg.includes('transient')) {
        console.warn("[Offline Sync] Network/Server connectivity lost. Halting sync queue.");
        hasNetworkError = true;
        remainingQueue.push(item);
      } else {
        console.error(`[Offline Sync] Permanent error processing queue item:`, err);
      }
    }
  }

  // Merge remaining items and keep items added during async processing
  const latestQueue = getSyncQueue();
  const updatedQueue = latestQueue.filter(latestItem => 
    remainingQueue.some(remItem => remItem.id === latestItem.id) ||
    !queue.some(processedItem => processedItem.id === latestItem.id)
  );
  saveSyncQueue(updatedQueue);
  isSyncing = false;

  if (!hasNetworkError && remainingQueue.length === 0) {
    if (onSyncSuccess) {
      onSyncSuccess();
    }
  }
}

export function mergeRemoteWithSyncQueue(table: string, remoteData: any[]): any[] {
  try {
    const queue = getSyncQueue();
    if (queue.length === 0) return remoteData;
    
    let merged = [...remoteData];

    for (const item of queue) {
      if (item.table !== table) continue;

      if (item.action === 'insert') {
        const exists = merged.some(x => x.id === item.payload.id);
        if (!exists) {
          merged.push(item.payload);
        }
      } else if (item.action === 'update') {
        merged = merged.map(x => x.id === item.targetId ? { ...x, ...item.payload } : x);
      } else if (item.action === 'delete') {
        merged = merged.filter(x => x.id !== item.targetId);
      }
    }

    return merged;
  } catch (err) {
    console.error("Error merging remote with sync queue:", err);
    return remoteData;
  }
}


