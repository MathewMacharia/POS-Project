import React, { useState } from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Layers, 
  PlusCircle, 
  ShoppingBag, 
  FileText, 
  ShieldAlert,
  Calendar,
  DollarSign,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Product, Sale } from '../types';
import { getNairobiDateStr, getNairobiToday } from '../utils/timezoneHelper';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  onNavigate: (tab: string) => void;
  onAddProductQuick: () => void;
  onSellProductQuick: () => void;
  currentUserRole: 'admin' | 'cashier';
  shopName?: string;
}

export default function Dashboard({
  products,
  sales,
  onNavigate,
  onAddProductQuick,
  onSellProductQuick,
  currentUserRole,
  shopName = 'Dufuka Shop'
}: DashboardProps) {
  // Stats calculations
  const { todayStr, currentMonthStr, nairobiNow } = getNairobiToday();
  const today = new Date();
  
  const formattedCurrency = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(val);
  };

  // 1. Total sales today
  const salesToday = sales.filter(s => getNairobiDateStr(s.dateAdded) === todayStr);
  const totalSalesToday = salesToday.reduce((sum, s) => sum + s.total, 0);
  const transactionsTodayCount = salesToday.length;

  // 2. Total sales this month
  const salesThisMonth = sales.filter(s => getNairobiDateStr(s.dateAdded).startsWith(currentMonthStr));
  const totalSalesThisMonth = salesThisMonth.reduce((sum, s) => sum + s.total, 0);

  // 3. Stock metrics
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.quantityInStock > 0);
  const totalItemsInStock = products.reduce((sum, p) => sum + p.quantityInStock, 0);

  // Low Stock Alerts (threshold <= 10)
  const lowStockProducts = products.filter(p => p.quantityInStock > 0 && p.quantityInStock <= 10);
  
  // Out of stock
  const outOfStockProducts = products.filter(p => p.quantityInStock === 0);

  // Expiry date monitoring
  const currentTimestamp = today.getTime();
  const thirtyDaysLaterTimestamp = currentTimestamp + 30 * 24 * 60 * 60 * 1000;

  const expiredProducts = products.filter(p => {
    if (!p.expiryDate) return false;
    const expTime = new Date(p.expiryDate).getTime();
    return expTime < currentTimestamp;
  });

  const nearingExpiryProducts = products.filter(p => {
    if (!p.expiryDate) return false;
    const expTime = new Date(p.expiryDate).getTime();
    return expTime >= currentTimestamp && expTime <= thirtyDaysLaterTimestamp;
  });

  // Payment methods summary for today
  const paymentSummary = salesToday.reduce(
    (acc, sale) => {
      if (sale.paymentMethod === 'Cash') acc.cash += sale.total;
      else if (sale.paymentMethod === 'M-Pesa') acc.mpesa += sale.total;
      else if (sale.paymentMethod === 'Bank') acc.bank += sale.total;
      return acc;
    },
    { cash: 0, mpesa: 0, bank: 0 }
  );

  // Payment methods summary for active month
  const monthlyPaymentSummary = salesThisMonth.reduce(
    (acc, sale) => {
      if (sale.paymentMethod === 'Cash') acc.cash += sale.total;
      else if (sale.paymentMethod === 'M-Pesa') acc.mpesa += sale.total;
      else if (sale.paymentMethod === 'Bank') acc.bank += sale.total;
      return acc;
    },
    { cash: 0, mpesa: 0, bank: 0 }
  );

  // Profit calculations
  // profit = sum_of((selling - buying) * qty)
  const totalProfitToday = salesToday.reduce((sum, sale) => {
    const saleProfit = sale.items.reduce((itemProfit, item) => {
      return itemProfit + (item.sellingPrice - item.buyingPrice) * item.quantity;
    }, 0);
    return sum + saleProfit;
  }, 0);

  const totalProfitThisMonth = salesThisMonth.reduce((sum, sale) => {
    const saleProfit = sale.items.reduce((itemProfit, item) => {
      return itemProfit + (item.sellingPrice - item.buyingPrice) * item.quantity;
    }, 0);
    return sum + saleProfit;
  }, 0);

  // 7-day sales trend (last 8 days dynamically)
  const daysOfTrend = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(nairobiNow.getTime());
    d.setUTCDate(d.getUTCDate() - (7 - i));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  });
  
  const dailyTotals = daysOfTrend.map(targetDate => {
    return sales
      .filter(s => getNairobiDateStr(s.dateAdded) === targetDate)
      .reduce((sum, s) => sum + s.total, 0);
  });

  const maxDailyTotal = Math.max(...dailyTotals, 1000);

  // Selected tooltips
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  return (
    <div className="space-y-6" id="dashboard-module-container">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-xs relative overflow-hidden" id="dashboard-welcome-banner">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-sans tracking-tight">Karibu Tena! Welcome Back</h1>
            <p className="text-emerald-100 mt-1 max-w-xl text-sm leading-relaxed">
              {shopName} POS is running successfully offline-first. Manage your retail products, record sales via Cash, M-Pesa, or Bank, and view real-time operations stats.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              id="quick-sell-btn"
              onClick={onSellProductQuick}
              className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-lg text-sm font-medium transition duration-200 flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <ShoppingBag className="w-4.5 h-4.5" />
              New Sale (F2)
            </button>
            {currentUserRole === 'admin' && (
              <button
                id="quick-add-product-btn"
                onClick={onAddProductQuick}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition duration-200 flex items-center gap-2 border border-emerald-400 cursor-pointer"
              >
                <PlusCircle className="w-4.5 h-4.5" />
                Add Product
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-cards-grid">
        {/* Today's Sales */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md transition duration-200" id="kpi-sales-today">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Sales Today</p>
              <h3 className="text-2xl font-bold font-sans text-zinc-900 dark:text-white mt-1">
                {formattedCurrency(totalSalesToday)}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{transactionsTodayCount} Transactions completed</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium font-mono">
              Profit: {formattedCurrency(totalProfitToday)}
            </span>
          </div>
        </div>

        {/* This Month's Sales */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md transition duration-200" id="kpi-sales-month">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Sales This Month</p>
              <h3 className="text-2xl font-bold font-sans text-zinc-900 dark:text-white mt-1">
                {formattedCurrency(totalSalesThisMonth)}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Calendar className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Month: {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium font-mono">
              Profit: {formattedCurrency(totalProfitThisMonth)}
            </span>
          </div>
        </div>

        {/* Total Stock */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md transition duration-200" id="kpi-stock">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Products in Stock</p>
              <h3 className="text-2xl font-bold font-sans text-zinc-900 dark:text-white mt-1">
                {totalProducts} <span className="text-sm font-normal text-zinc-500">types</span>
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              <Package className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{totalItemsInStock} total units on shelves</span>
            <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-sm font-semibold">
              {activeProducts.length} Active SKU
            </span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:shadow-md transition duration-200" id="kpi-low-stock">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Low Stock / Out of Stock</p>
              <h3 className="text-2xl font-bold font-sans mt-1 text-zinc-900 dark:text-white">
                {lowStockProducts.length} <span className="text-xs font-normal text-amber-500">Low</span>
                {outOfStockProducts.length > 0 && (
                  <span className="text-red-500 ml-2">/ {outOfStockProducts.length} <span className="text-xs font-normal text-red-500">Out</span></span>
                )}
              </h3>
            </div>
            <div className={`p-3 rounded-lg ${outOfStockProducts.length > 0 ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}>
              <AlertTriangle className="w-5.5 h-5.5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="text-amber-600 dark:text-amber-400 font-medium">Alert Threshold: 10 units</span>
            <button onClick={() => onNavigate('stock')} className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-medium cursor-pointer">
              Review
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* AI Enterprise Reports Promotion Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-emerald-950/80 to-zinc-950 text-white rounded-2xl p-5 border border-emerald-900/40 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden" id="dashboard-ai-promo-banner">
        <div className="absolute right-0 bottom-0 pointer-events-none translate-x-12 translate-y-12 opacity-15">
          <Sparkles className="w-48 h-48 text-emerald-500 animate-pulse" />
        </div>
        <div className="relative z-10 space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500 text-zinc-950 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Gemini AI Partner
            </span>
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-405 animate-pulse" />
              Intelligence Engine Available
            </span>
          </div>
          <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            Automated Supermarket AI Analytics &amp; Growth Dossier
          </h2>
          <p className="text-xs text-zinc-350 leading-relaxed">
            Query the AI business growth consultant to auto-compile detailed ledger diagnostics, shelf velocity classifications, restocking recommendations, and upcoming sales margin forecasts.
          </p>
        </div>
        <button
          onClick={() => onNavigate('reports_ai')}
          className="relative z-10 shrink-0 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-lg hover:shadow-emerald-900/30"
        >
          <Sparkles className="w-4 h-4 text-emerald-100" />
          Open AI Report Engine
        </button>
      </div>

      {/* Expiry Alerts Header Notification if any are Expired */}
      {(expiredProducts.length > 0 || nearingExpiryProducts.length > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3" id="expiry-warning-banner">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-300 text-sm">Critical Shelf Expiry Alert</h4>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                You have <span className="font-bold text-red-600 dark:text-red-400">{expiredProducts.length} expired product(s)</span> and <span className="font-bold">{nearingExpiryProducts.length} product(s) expiring within 30 days</span>.
              </p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('stock')} 
            className="text-xs font-semibold bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900 dark:text-amber-200 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 cursor-pointer"
          >
            Manage Shevles Now
          </button>
        </div>
      )}

      {/* Visual Analytics Sections (Custom SVG Graphs) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-analytics-section">
        
        {/* Sales Trend Line (7-Day Area Chart) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs lg:col-span-2 flex flex-col justify-between" id="daily-sales-chart-panel">
          <div>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold font-sans text-zinc-900 dark:text-white">Daily Revenue Trend</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Track operations revenue over the last 8 days</p>
              </div>
              <div className="text-right">
                <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-1 rounded">
                  8-Day High: {formattedCurrency(maxDailyTotal)}
                </span>
              </div>
            </div>

            {/* SVG Visualizing Code */}
            <div className="mt-6 relative h-56" id="sales-svg-container">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = 20 + ratio * 140;
                  const textVal = Math.round(maxDailyTotal * (1 - ratio));
                  return (
                    <g key={index} className="opacity-20 dark:opacity-10">
                      <line x1="50" y1={y} x2="680" y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
                      <text x="10" y={y + 4} className="text-[10px] font-mono fill-zinc-600 dark:fill-zinc-400" textAnchor="start">
                        {Math.floor(textVal / 1000)}k
                      </text>
                    </g>
                  );
                })}

                {/* SVG Curve Path Generation */}
                {(() => {
                  const paddingLeft = 50;
                  const chartWidth = 630;
                  const totalDays = dailyTotals.length - 1;
                  const stepX = chartWidth / totalDays;
                  
                  // Coordinate builder
                  const coords = dailyTotals.map((tot, idx) => {
                    const x = paddingLeft + idx * stepX;
                    const y = 160 - (tot / maxDailyTotal) * 130; // mapping 0 to 130 height max inside panel
                    return { x, y };
                  });

                  // Build SVG path
                  const dLine = coords.reduce((acc, c, idx) => {
                    return acc + `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y} `;
                  }, '');

                  // Closed path for fill area
                  const dArea = dLine + `L ${coords[coords.length - 1].x} 160 L ${coords[0].x} 160 Z`;

                  return (
                    <g>
                      {/* Filled Area */}
                      <path d={dArea} fill="url(#areaGrad)" />
                      {/* The Main Line */}
                      <path d={dLine} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      
                      {/* Interaction Nodes */}
                      {coords.map((c, idx) => (
                        <g key={idx}>
                          <circle 
                            cx={c.x} 
                            cy={c.y} 
                            r="6" 
                            className="fill-white dark:fill-zinc-900 stroke-emerald-600 stroke-2 cursor-pointer transition hover:r-8"
                            onMouseEnter={() => setHoveredTrendIndex(idx)}
                            onMouseLeave={() => setHoveredTrendIndex(null)}
                          />
                          {hoveredTrendIndex === idx && (
                            <g>
                              <rect 
                                x={Math.max(20, c.x - 70)} 
                                y={Math.max(5, c.y - 45)} 
                                width="140" 
                                height="38" 
                                rx="4"
                                className="fill-zinc-800/95 text-white stroke-zinc-700 shadow-lg" 
                              />
                               <text 
                                x={Math.max(20, c.x - 70) + 70} 
                                y={Math.max(5, c.y - 45) + 16} 
                                className="text-[10px] fill-emerald-400 font-bold" 
                                textAnchor="middle"
                              >
                                {(() => {
                                  try {
                                    const d = new Date(daysOfTrend[idx]);
                                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                  } catch (e) {
                                    return daysOfTrend[idx];
                                  }
                                })()}
                              </text>
                              <text 
                                x={Math.max(20, c.x - 70) + 70} 
                                y={Math.max(5, c.y - 45) + 30} 
                                className="text-[11px] fill-white font-semibold font-mono" 
                                textAnchor="middle"
                              >
                                {formattedCurrency(dailyTotals[idx])}
                              </text>
                            </g>
                          )}
                        </g>
                      ))}
                    </g>
                  );
                })()}

                {/* Bottom trend label dates */}
                {daysOfTrend.map((dateStr, idx) => {
                  const stepX = 630 / (dailyTotals.length - 1);
                  const x = 50 + idx * stepX;
                  const parts = dateStr.split('-');
                  const label = parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr;
                  return (
                    <text key={idx} x={x} y="182" className="text-[10px] font-sans fill-zinc-500 text-center" textAnchor="middle">
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500 dark:text-zinc-400" id="sales-trend-totals-footer">
            <span>Graph shows consistent retail velocity</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              Total sales shown: {formattedCurrency(dailyTotals.reduce((a,b)=>a+b, 0))}
            </span>
          </div>
        </div>

        {/* Payment Methods Stack Summary */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex flex-col justify-between" id="payment-methods-breakdown-panel">
          <div>
            <h3 className="font-bold font-sans text-zinc-900 dark:text-white">Payment Split</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} Monthly transaction splits</p>

            {/* Stack bar visual graph */}
            <div className="mt-6 space-y-5" id="payment-channels-metrics">
              {(() => {
                const totalMonthSales = Math.max(totalSalesThisMonth, 1);
                const cashPct = Math.round((monthlyPaymentSummary.cash / totalMonthSales) * 100);
                const mpesaPct = Math.round((monthlyPaymentSummary.mpesa / totalMonthSales) * 100);
                const bankPct = Math.round((monthlyPaymentSummary.bank / totalMonthSales) * 100);

                return (
                  <>
                    {/* Double segmented colored bar */}
                    <div className="h-4 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
                      {cashPct > 0 && (
                        <div 
                          className="h-full bg-emerald-500 relative group" 
                          style={{ width: `${cashPct}%` }}
                          title={`Cash: ${cashPct}%`}
                        />
                      )}
                      {mpesaPct > 0 && (
                        <div 
                          className="h-full bg-teal-500 relative group" 
                          style={{ width: `${mpesaPct}%` }}
                          title={`M-Pesa: ${mpesaPct}%`}
                        />
                      )}
                      {bankPct > 0 && (
                        <div 
                          className="h-full bg-blue-500 relative group" 
                          style={{ width: `${bankPct}%` }}
                          title={`Bank: ${bankPct}%`}
                        />
                      )}
                    </div>

                    <div className="space-y-3 pt-3">
                      {/* Cash Row info */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Cash Payments</span>
                        </div>
                        <div className="text-right font-mono text-zinc-600 dark:text-zinc-400">
                          <span className="font-semibold">{formattedCurrency(monthlyPaymentSummary.cash)}</span> ({cashPct}%)
                        </div>
                      </div>

                      {/* M-Pesa Row info */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300 pointer-events-none">M-Pesa Paybill / Till</span>
                        </div>
                        <div className="text-right font-mono text-zinc-600 dark:text-zinc-400">
                          <span className="font-bold text-teal-600 dark:text-teal-400">{formattedCurrency(monthlyPaymentSummary.mpesa)}</span> ({mpesaPct}%)
                        </div>
                      </div>

                      {/* Bank Transfer Row info */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Bank Transfers</span>
                        </div>
                        <div className="text-right font-mono text-zinc-600 dark:text-zinc-400">
                          <span className="font-semibold">{formattedCurrency(monthlyPaymentSummary.bank)}</span> ({bankPct}%)
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="mt-6 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 text-center border border-zinc-100 dark:border-zinc-800">
            M-Pesa represents the primary cash collection mechanism. All records are stored offline-first.
          </div>
        </div>
      </div>

      {/* Two Columns for Bottom Information: Recent Transactions and Dangerous Shelf/Expiry listings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-bottom-section">
        
        {/* Recent Transactions Module */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs lg:col-span-2" id="recent-transactions-panel">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold font-sans text-zinc-900 dark:text-white">Recent Shop Sales</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Click &quot;Sell Product&quot; to compile new sales instantly</p>
            </div>
            <button 
              onClick={() => onNavigate('reports')} 
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              View Sales History
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto" id="dashboard-sales-table-wrapper">
            <table className="w-full text-left text-sm" id="dashboard-sales-table">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5">Receipt #</th>
                  <th className="py-2.5">Cashier</th>
                  <th className="py-2.5">Items</th>
                  <th className="py-2.5">Pay Method</th>
                  <th className="py-2.5 text-right">Total (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {sales.slice(-5).reverse().map((sale) => (
                  <tr key={sale.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition text-zinc-700 dark:text-zinc-300">
                    <td className="py-3 font-mono text-xs font-semibold">{sale.receiptNumber}</td>
                    <td className="py-3 text-xs">{sale.cashierName}</td>
                    <td className="py-3 text-xs">
                      {sale.items.length} item(s) (
                      <span className="text-zinc-400">
                        {sale.items.slice(0, 2).map(i => `${i.name} x${i.quantity}`).join(', ')}
                        {sale.items.length > 2 ? '...' : ''}
                      </span>
                      )
                    </td>
                    <td className="py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-center ${
                        sale.paymentMethod === 'M-Pesa' 
                          ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400' 
                          : sale.paymentMethod === 'Cash' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-xs">
                      {formattedCurrency(sale.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dashboard Side Shelf Activity Alert Panel */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex flex-col justify-between" id="dashboard-side-alert-panel">
          <div>
            <h3 className="font-bold font-sans text-zinc-900 dark:text-white inline-flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-emerald-600" />
              Shelf Monitoring
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Inventory items needing immediate cashier attention</p>

            <div className="mt-4 space-y-3.5" id="shelf-alert-items-list">
              {/* Near Expiry List */}
              {nearingExpiryProducts.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">Expiring within 30 days:</span>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {nearingExpiryProducts.slice(0, 3).map(p => (
                      <div key={p.id} className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 flex justify-between items-center text-xs">
                        <div className="truncate pr-2">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                          <p className="text-[10px] text-zinc-400">Expires: {p.expiryDate}</p>
                        </div>
                        <span className="flex-none bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-medium px-2 py-0.5 rounded">
                          Qty: {p.quantityInStock}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Low Stock List */}
              {lowStockProducts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Low Stock running out:</span>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {lowStockProducts.slice(0, 3).map(p => (
                      <div key={p.id} className="p-2.5 rounded-lg border border-red-100 dark:border-red-950/30 bg-red-50/30 dark:bg-red-950/10 flex justify-between items-center text-xs">
                        <div className="truncate pr-2">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                          <p className="text-[10px] text-zinc-400">{p.supplierName}</p>
                        </div>
                        <span className="flex-none bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                          Left: {p.quantityInStock}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
            <button 
              onClick={() => onNavigate('stock')}
              className="w-full text-center bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 py-2 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
            >
              Analyze Shelf Metrics
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
