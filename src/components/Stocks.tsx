import React, { useState, useMemo } from 'react';
import { 
  History, 
  PlusCircle, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  FileCheck,
  PackageCheck,
  Inbox,
  Sparkles,
  Search,
  BookOpen
} from 'lucide-react';
import { Product, StockLog } from '../types';

interface StocksProps {
  products: Product[];
  stockLogs: StockLog[];
  onRestockProduct: (productId: string, restockQty: number, notes: string, expiryDate?: string) => void;
  onDiscardExpiredProduct: (productId: string, notes: string) => void;
  currentUserRole: 'admin' | 'cashier';
}

export default function Stocks({
  products,
  stockLogs,
  onRestockProduct,
  onDiscardExpiredProduct,
  currentUserRole
}: StocksProps) {
  // Local state
  const [activeStockTab, setActiveStockTab] = useState<'monitoring' | 'logs'>('monitoring');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Restock form popup state
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [formProductId, setFormProductId] = useState('');
  const [formQty, setFormQty] = useState('10');
  const [formNotes, setFormNotes] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');

  // Discard form state
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [discardProductId, setDiscardProductId] = useState('');
  const [discardNotes, setDiscardNotes] = useState('');

  // Timestamps
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentTimestamp = today.getTime();
  const thirtyDaysLaterTimestamp = currentTimestamp + 30 * 24 * 60 * 60 * 1000;

  // Segmenting products according to alerts
  const segmentedProducts = useMemo(() => {
    const lowStock: Product[] = [];
    const outOfStock: Product[] = [];
    const expired: Product[] = [];
    const nearingExpiry: Product[] = [];
    const fullyHealthy: Product[] = [];

    products.forEach(p => {
      const isLow = p.quantityInStock > 0 && p.quantityInStock <= 10;
      const isOut = p.quantityInStock === 0;

      const expTime = p.expiryDate ? new Date(p.expiryDate).getTime() : null;
      const isExpired = expTime !== null && expTime < currentTimestamp;
      const isNearing = expTime !== null && expTime >= currentTimestamp && expTime <= thirtyDaysLaterTimestamp;

      if (isExpired) expired.push(p);
      else if (isNearing) nearingExpiry.push(p);

      if (isOut) outOfStock.push(p);
      else if (isLow) lowStock.push(p);
      else if (!isExpired && !isNearing) fullyHealthy.push(p);
    });

    return { lowStock, outOfStock, expired, nearingExpiry, fullyHealthy };
  }, [products]);

  // Handle restock execution
  const executeRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId) return;

    const qty = parseInt(formQty) || 0;
    if (qty <= 0) {
      alert('Kindly supply a valid restock quantity greater than zero.');
      return;
    }

    onRestockProduct(formProductId, qty, formNotes.trim() || 'Standard stock restock delivery', formExpiryDate || undefined);
    setIsRestockOpen(false);
    setFormNotes('');
    setFormProductId('');
    setFormExpiryDate('');
  };

  // Handle discard execution
  const executeDiscardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discardProductId) return;

    onDiscardExpiredProduct(discardProductId, discardNotes.trim() || 'Discarded expired inventory from shelves.');
    setIsDiscardOpen(false);
    setDiscardNotes('');
    setDiscardProductId('');
  };

  const filteredLogs = useMemo(() => {
    return stockLogs.filter(log => {
      if (!logSearchQuery) return true;
      return (
        log.productName.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
        log.operatorName.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
        (log.notes && log.notes.toLowerCase().includes(logSearchQuery.toLowerCase()))
      );
    });
  }, [stockLogs, logSearchQuery]);

  const KES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6" id="stocks-module-page">
      
      {/* Visual Header Grid */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="stocks-header">
        <div>
          <h2 className="text-xl font-bold font-sans text-zinc-900 dark:text-white flex items-center gap-2">
            <PackageCheck className="w-5.5 h-5.5 text-emerald-600 animate-bounce" />
            Stock Monitoring &amp; Movement Logs
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Perform adjustments, evaluate restock logs, and discard expired batch numbers securely.</p>
        </div>
        
        {/* Tab Selection buttons */}
        <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex self-stretch sm:self-auto text-xs font-bold" id="stock-actions-tabs">
          <button
            onClick={() => setActiveStockTab('monitoring')}
            className={`px-4 py-1.5 rounded-lg transition shrink-0 cursor-pointer ${
              activeStockTab === 'monitoring'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Shelf Surveillance
          </button>
          <button
            onClick={() => setActiveStockTab('logs')}
            className={`px-4 py-1.5 rounded-lg transition shrink-0 cursor-pointer ${
              activeStockTab === 'logs'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Stock Movement Logs ({stockLogs.length})
          </button>
        </div>
      </div>

      {/* RENDER SHELF SURVEILLANCE TAB */}
      {activeStockTab === 'monitoring' && (
        <div className="space-y-6" id="shelf-surveillance-container">
          
          {/* Quick Stats overview of stock parameters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="monitoring-stat-badges">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">EXPIRED PRODUCTS</span>
                <span className="text-lg font-bold font-sans text-red-650 dark:text-red-450">{segmentedProducts.expired.length} item(s)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-655 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase font-sans">NEARLY EXPIRED (30D)</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-450">{segmentedProducts.nearingExpiry.length} item(s)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100/40 text-amber-800">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">LOW STOCK AT SHELF</span>
                <span className="text-lg font-bold text-yellow-600">{segmentedProducts.lowStock.length} item(s)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-100/50 text-red-700 animate-pulse">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 block uppercase">COMPLETELY SOLD OUT</span>
                <span className="text-lg font-bold text-red-600">{segmentedProducts.outOfStock.length} item(s)</span>
              </div>
            </div>
          </div>

          {/* Alerts Details lists section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="critical-conditions-section">
            
            {/* Shelf expiration warnings column */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col" id="expiring-list-panel">
              <h3 className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-sm">
                <ShieldAlert className="w-4.5 h-4.5 text-red-500 animate-bounce" />
                Alerts: Expired (Discard or Refund)
              </h3>

              <div className="mt-4 flex-1 space-y-3.5 max-h-80 overflow-y-auto pr-1" id="expiring-monitoring-scroller">
                {segmentedProducts.expired.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    No expired products found on shop shelves! Good job.
                  </div>
                ) : (
                  segmentedProducts.expired.map(p => (
                    <div key={p.id} className="p-3 border border-red-200 dark:border-red-950/60 bg-red-50/20 dark:bg-red-950/10 rounded-xl flex justify-between items-center text-xs">
                      <div className="truncate">
                        <p className="font-bold text-zinc-950 dark:text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-red-600 font-bold mt-0.5">Expired: {p.expiryDate}</p>
                        <p className="text-[10px] text-zinc-400">Supplier: {p.supplierName}</p>
                      </div>
                      <div className="flex gap-2">
                        {currentUserRole === 'admin' && (
                          <button
                            onClick={() => { setDiscardProductId(p.id); setDiscardNotes(`Discarded expired batch of ${p.name}`); setIsDiscardOpen(true); }}
                            className="bg-red-600 text-white font-semibold text-[10px] px-2.5 py-1.5 hover:bg-red-700 rounded-lg cursor-pointer transition shadow-xs"
                          >
                            Discard (0 Stock)
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Nearing shelf expiry (Orange Warnings) */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col" id="nearing-list-panel">
              <h3 className="font-bold text-zinc-955 dark:text-white flex items-center gap-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-sm">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                Alerts: Expiring soon (Within 30 Days)
              </h3>

              <div className="mt-4 flex-1 space-y-3.5 max-h-80 overflow-y-auto pr-1" id="nearing-monitoring-scroller">
                {segmentedProducts.nearingExpiry.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 text-xs">
                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2 animate-pulse" />
                    No products nearing shelf expiration soon.
                  </div>
                ) : (
                  segmentedProducts.nearingExpiry.map(p => (
                    <div key={p.id} className="p-3 border border-amber-200 dark:border-amber-950/60 bg-amber-50/20 dark:bg-amber-950/10 rounded-xl flex justify-between items-center text-xs">
                      <div className="truncate">
                        <p className="font-bold text-zinc-955 dark:text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Expires soon: {p.expiryDate}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">Qty left on shelf: {p.quantityInStock}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 font-mono text-[10px] font-bold px-2 py-1 rounded">
                        Active Stock
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Low Stock Alerts and Sold Out Products restock control (Classic POS functionality) */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs" id="surveillance-restocks">
            <h3 className="font-bold text-zinc-950 dark:text-white pb-3 border-b border-zinc-100 dark:border-zinc-800 text-sm flex items-center gap-1.5 mb-4">
              <PlusCircle className="text-emerald-700 w-4.5 h-4.5" />
              Shelving Level Restoration (Action required)
            </h3>

            <div className="overflow-x-auto" id="restocks-table-wrapper">
              <table className="w-full text-left" id="restocks-surveillance-table">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="py-2">Product display name</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Wholesale Supplier</th>
                    <th className="py-2 text-center">Remaining Quantity</th>
                    <th className="py-2 text-center">Alert Condition</th>
                    {currentUserRole === 'admin' && <th className="py-2 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {[...segmentedProducts.outOfStock, ...segmentedProducts.lowStock].map((p, idx) => {
                    const isOut = p.quantityInStock === 0;
                    return (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300">
                        <td className="py-3 font-bold text-zinc-900 dark:text-white truncate max-w-sm">{p.name}</td>
                        <td className="py-3">{p.category}</td>
                        <td className="py-3 font-medium text-zinc-500">{p.supplierName}</td>
                        <td className="py-3 text-center">
                          <span className={`font-mono font-bold px-2.5 py-0.5 rounded text-[11px] ${isOut ? 'bg-red-50 text-red-700 font-black' : 'bg-amber-50 text-amber-700'}`}>
                            {p.quantityInStock} units
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${isOut ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white'}`}>
                            {isOut ? 'SOLD OUT' : 'LOW STOCK WARNING'}
                          </span>
                        </td>
                        {currentUserRole === 'admin' && (
                          <td className="py-3 text-center">
                            <button
                              id={`trigger-restock-row-${p.id}`}
                              onClick={() => { setFormProductId(p.id); setFormQty('50'); setFormNotes(`Delivered 50 units bulk supply from ${p.supplierName}`); setIsRestockOpen(true); }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition cursor-pointer"
                            >
                              Restock (In)
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {segmentedProducts.outOfStock.length === 0 && segmentedProducts.lowStock.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-zinc-400">
                        <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        All products are in healthy stock abundance levels! No restocks needed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* RENDER STOCK MOVEMENT LOGS TAB */}
      {activeStockTab === 'logs' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs" id="stock-logs-section">
          
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-5" id="stock-logs-header-panel">
            <div>
              <h3 className="font-bold text-base text-zinc-905 dark:text-white flex items-center gap-1.5">
                <History className="w-4.5 h-4.5 text-zinc-500" />
                Traceability Audit Logs
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-450">Track stock decrements from cashiers checkout, and bulk restock actions.</p>
            </div>

            {/* Quick logs filter query */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search log by Operator, Product..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white dark:text-white font-semibold focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950"
              />
            </div>
          </div>

          {/* Historical Logs List */}
          <div className="overflow-x-auto" id="historical-stock-logs-table-wrapper">
            <table className="w-full text-left text-xs" id="stock-logs-table-element">
              <thead>
                <tr className="border-b border-zinc-150 dark:border-zinc-800/80 text-[10px] font-bold text-zinc-400 uppercase tracking-wider pb-2">
                  <th className="py-2.5">Date &amp; Time</th>
                  <th className="py-2.5">Product display Name</th>
                  <th className="py-2.5 text-center">Delta Quantity</th>
                  <th className="py-2.5">Activity type</th>
                  <th className="py-2.5">Operator signature</th>
                  <th className="py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {filteredLogs.slice().reverse().map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 text-zinc-700 dark:text-zinc-350">
                    <td className="py-3 font-mono text-[11px] text-zinc-400">
                      {new Date(log.timestamp).toLocaleString('en-KE')}
                    </td>
                    <td className="py-3 font-bold text-zinc-950 dark:text-white">{log.productName}</td>
                    <td className="py-3 text-center">
                      <span className={`font-mono font-extrabold px-2 py-0.5 rounded-sm text-[11px] ${
                        log.changeQty > 0 
                          ? 'bg-emerald-50 text-emerald-800' 
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty} units
                      </span>
                    </td>
                    <td className="py-3 font-bold uppercase text-[10px]">
                      <span className={`inline-block px-2 py-0.5 rounded-md ${
                        log.type === 'restock' || log.type === 'initial'
                          ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400'
                          : log.type === 'sale'
                            ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400'
                            : 'bg-red-105 dark:bg-red-950/40 text-red-800 dark:text-red-400'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3">{log.operatorName}</td>
                    <td className="py-3 text-zinc-500 italic truncate max-w-sm" title={log.notes}>
                      {log.notes || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESTOCK ACTION FORM POPUP OVERLAY */}
      {isRestockOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-800 text-center flex items-center justify-center gap-1.5 text-sm">
              <PlusCircle className="text-emerald-600 w-4.5 h-4.5" />
              Restock Shelf Inventory
            </h3>
            
            <form onSubmit={executeRestockSubmit} className="mt-4 space-y-4 text-xs font-semibold">
              <div>
                <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Select Product *</label>
                <select
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-zinc-100 border border-zinc-700 rounded-lg text-xs"
                >
                  <option value="" className="bg-zinc-900 text-white">-- Choose Product --</option>
                  {products.map((p, i) => (
                    <option key={i} value={p.id} className="bg-zinc-900 text-white">
                      {p.name} (Current: {p.quantityInStock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Delivered quantity limit *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg font-mono text-sm block"
                />
              </div>

              <div>
                <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Batch Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={formExpiryDate}
                  onChange={(e) => setFormExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Trace Audit Notes / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Delivered 48 tins Bidco bulk"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsRestockOpen(false)}
                  className="w-1/2 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formProductId}
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer disabled:bg-zinc-150 disabled:text-zinc-400"
                >
                  Increment Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCARD EXPIRED PRODUCTS POPUP FORM */}
      {isDiscardOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <h3 className="font-bold text-red-650 dark:text-red-400 pb-2 border-b border-zinc-105 dark:border-zinc-800 text-center flex items-center justify-center gap-1.5 text-sm">
              <Trash2 className="w-4.5 h-4.5" />
              Confirm Food/Medicine Shelf Discard
            </h3>
            
            <form onSubmit={executeDiscardSubmit} className="mt-4 space-y-4 text-xs font-semibold">
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Discarding this product automatically sets its quantity to <span className="text-red-600 font-bold">0</span> and appends an official stock log entry to keep calculations clean.
              </p>

              <div>
                <label className="text-zinc-550 block mb-1">Reason for shelf removal</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Damaged batch, expired Broadways"
                  value={discardNotes}
                  onChange={(e) => setDiscardNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-red-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden"
                />
              </div>

              <div className="flex gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsDiscardOpen(false)}
                  className="w-1/2 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-lg shadow-xs"
                >
                  Confirm Discard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
