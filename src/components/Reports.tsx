import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  CornerDownRight, 
  Award, 
  TrendingDown, 
  Activity,
  Layers,
  ArrowRight,
  ClipboardList,
  Sparkles,
  BrainCircuit,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Product, Sale, Expense } from '../types';

interface ReportsProps {
  sales: Sale[];
  products: Product[];
  currentUserRole: 'admin' | 'cashier';
  expenses?: Expense[];
  initialPeriod?: 'daily' | 'monthly' | 'ai_insights';
}

export default function Reports({ 
  sales, 
  products, 
  currentUserRole, 
  expenses = [],
  initialPeriod
}: ReportsProps) {
  const today = new Date();
  const todayStr = (() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(today);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
  })();

  // Helper currency formatter
  const KES = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  // State: Tab for Daily vs Monthly Reports view
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'monthly' | 'ai_insights'>(initialPeriod || 'daily');

  useEffect(() => {
    if (initialPeriod) {
      setReportPeriod(initialPeriod);
    }
  }, [initialPeriod]);

  // AI Report State & Pipeline
  const [aiReportPeriod, setAiReportPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [aiReportData, setAiReportData] = useState<any | null>(null);
  const [aiIsLoading, setAiIsLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingStepIdx, setLoadingStepIdx] = useState<number>(0);

  const loadingSteps = [
    "Compiling transaction ledgers...",
    "Ingesting shelf products catalog...",
    "Applying Kenyan supermarket growth analysis...",
    "Running category segment allocations...",
    "Determining item velocity (high, middle, low)...",
    "Predicting weekly forecasts & expected month actions...",
    "Finalizing Owner's Business Intelligence brief..."
  ];

  useEffect(() => {
    let interval: any;
    if (aiIsLoading) {
      interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % loadingSteps.length);
      }, 2200);
    } else {
      setLoadingStepIdx(0);
    }
    return () => clearInterval(interval);
  }, [aiIsLoading]);

  const handleGenerateAIReport = async () => {
    setAiIsLoading(true);
    setAiError(null);
    try {
      const geminiApiKey = localStorage.getItem('dufuka_gemini_api_key') || '';
      const resp = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(geminiApiKey ? { "x-gemini-key": geminiApiKey } : {})
        },
        body: JSON.stringify({
          sales,
          products,
          expenses,
          type: aiReportPeriod
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        const errorMsg = data.details 
          ? `${data.error} (Diagnostic details: ${data.details})` 
          : (data.error || "Failed to generate report");
        throw new Error(errorMsg);
      }
      setAiReportData(data);
    } catch (err: any) {
      setAiError(err.message || "Something went wrong.");
    } finally {
      setAiIsLoading(false);
    }
  };

  const handleDownloadAIPDF = () => {
    if (!aiReportData) return;
    const doc = new jsPDF();
    
    // Page setup
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text("AUTOMATED SUPERMARKET AI ANALYTICS REPORT", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString('en-KE')} | Scope: ${aiReportPeriod.toUpperCase()}`, 14, 26);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 28, 196, 28);
    
    // Executive Summary
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Executive Summary", 14, 38);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const summaryLines = doc.splitTextToSize(aiReportData.summary || "", 182);
    doc.text(summaryLines, 14, 44);
    
    let yPos = 44 + (summaryLines.length * 5) + 8;
    
    // Financial Metrics
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Financial Ledger Summary", 14, yPos);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    yPos += 6;
    
    const KES_FORMAT = (val: number) => `KES ${val.toLocaleString('en-KE')}`;
    
    doc.text(`Total Revenue Analyzed: ${KES_FORMAT(aiReportData.analytics?.totalRevenue || 0)}`, 14, yPos);
    yPos += 5;
    doc.text(`Gross Profit Analyzed: ${KES_FORMAT(aiReportData.analytics?.totalProfit || 0)}`, 14, yPos);
    yPos += 5;
    doc.text(`Total Discounts Granted: ${KES_FORMAT(aiReportData.analytics?.totalDiscounts || 0)}`, 14, yPos);
    yPos += 5;
    doc.text(`Total Expenses Analyzed: ${KES_FORMAT(aiReportData.analytics?.totalExpenses || 0)}`, 14, yPos);
    
    yPos += 12;
    
    // Growth Strategy Dossier
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Owner's Growth Strategy Dossier", 14, yPos);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    yPos += 6;
    
    const dossierText = aiReportData.reportMarkdown || "";
    const cleanText = dossierText
      .replace(/### /g, "")
      .replace(/## /g, "")
      .replace(/# /g, "")
      .replace(/\*\*/g, "");
      
    const dossierLines = doc.splitTextToSize(cleanText, 182);
    
    for (let i = 0; i < dossierLines.length; i++) {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(dossierLines[i], 14, yPos);
      yPos += 5.5;
    }
    
    doc.save(`POS_AI_Analytics_Report_${aiReportPeriod}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Helper markdown parser to keep code bulletproof
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return <div key={index} className="h-2" />;
      
      if (trimmedLine.startsWith('### ')) {
        return (
          <h4 key={index} className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 tracking-tight flex items-center gap-1">
            <CornerDownRight className="w-3.5 h-3.5 text-emerald-500" />
            {trimmedLine.replace('### ', '')}
          </h4>
        );
      }
      if (trimmedLine.startsWith('## ')) {
        return (
          <h3 key={index} className="text-base font-extrabold text-zinc-900 dark:text-white mt-6 mb-3 border-b border-zinc-100 dark:border-zinc-805 pb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-4 bg-emerald-500 rounded-sm"></span>
            {trimmedLine.replace('## ', '')}
          </h3>
        );
      }
      if (trimmedLine.startsWith('# ')) {
        return (
          <h2 key={index} className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-8 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            {trimmedLine.replace('# ', '')}
          </h2>
        );
      }
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        return (
          <li key={index} className="text-xs text-zinc-600 dark:text-zinc-350 ml-4 list-disc pl-1 py-1">
            {parseBold(trimmedLine.substring(2))}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmedLine)) {
        return (
          <li key={index} className="text-xs text-zinc-600 dark:text-zinc-350 ml-4 list-decimal pl-1 py-1">
            {parseBold(trimmedLine.replace(/^\d+\.\s/, ''))}
          </li>
        );
      }
      return (
        <p key={index} className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed mb-2">
          {parseBold(trimmedLine)}
        </p>
      );
    });
  };

  const parseBold = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => 
      i % 2 === 1 
        ? <strong key={i} className="font-extrabold text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800/60 px-1 py-0.5 rounded">{part}</strong> 
        : part
    );
  };

  // --- 1. DAILY MATH CALCULATIONS (For Today: June 8, 2026) ---
  const dailySales = useMemo(() => {
    return sales.filter(s => s.dateAdded.startsWith(todayStr));
  }, [sales, todayStr]);

  const dailyTotalsObj = useMemo(() => {
    return dailySales.reduce((acc, s) => {
      acc.totalRevenue += s.total;
      acc.transactionsCount += 1;
      
      if (s.paymentMethod === 'Cash') acc.cashRevenue += s.total;
      else if (s.paymentMethod === 'M-Pesa') acc.mpesaRevenue += s.total;
      else if (s.paymentMethod === 'Bank') acc.bankRevenue += s.total;

      // Profit metric = (sellingPrice - buyingPrice) * quantity
      const saleProfit = s.items.reduce((sum, item) => {
        return sum + (item.sellingPrice - item.buyingPrice) * item.quantity;
      }, 0);
      acc.estimatedProfit += saleProfit;

      return acc;
    }, {
      totalRevenue: 0,
      transactionsCount: 0,
      cashRevenue: 0,
      mpesaRevenue: 0,
      bankRevenue: 0,
      estimatedProfit: 0
    });
  }, [dailySales]);

  const monthlySales = useMemo(() => {
    const currentMonthPrefix = (() => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Nairobi',
        year: 'numeric',
        month: '2-digit'
      });
      const parts = formatter.formatToParts(today);
      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      return `${y}-${m}`;
    })();
    return sales.filter(s => s.dateAdded.startsWith(currentMonthPrefix));
  }, [sales, today]);

  const monthlyTotalsObj = useMemo(() => {
    return monthlySales.reduce((acc, s) => {
      acc.totalRevenue += s.total;
      acc.transactionsCount += 1;

      if (s.paymentMethod === 'Cash') acc.cashRevenue += s.total;
      else if (s.paymentMethod === 'M-Pesa') acc.mpesaRevenue += s.total;
      else if (s.paymentMethod === 'Bank') acc.bankRevenue += s.total;

      const saleProfit = s.items.reduce((sum, item) => {
        return sum + (item.sellingPrice - item.buyingPrice) * item.quantity;
      }, 0);
      acc.estimatedProfit += saleProfit;

      return acc;
    }, {
      totalRevenue: 0,
      transactionsCount: 0,
      cashRevenue: 0,
      mpesaRevenue: 0,
      bankRevenue: 0,
      estimatedProfit: 0
    });
  }, [monthlySales]);

  // --- 3. PRODUCT SALES ACCUMULATORS (Best & Least Selling) ---
  const productPerformanceStats = useMemo(() => {
    const countsMap: { [id: string]: { name: string, category: string, qtySold: number, revenue: number, profit: number } } = {};

    // Seed empty structures for every catalog product to guarantee they appear (e.g., as least selling with 0)
    products.forEach(p => {
      countsMap[p.id] = {
        name: p.name,
        category: p.category,
        qtySold: 0,
        revenue: 0,
        profit: 0
      };
    });

    // Accumulate actual sales over June 2026
    monthlySales.forEach(sale => {
      sale.items.forEach(item => {
        if (!countsMap[item.id]) {
          countsMap[item.id] = {
            name: item.name,
            category: 'Other',
            qtySold: 0,
            revenue: 0,
            profit: 0
          };
        }
        countsMap[item.id].qtySold += item.quantity;
        countsMap[item.id].revenue += (item.sellingPrice * item.quantity);
        countsMap[item.id].profit += (item.sellingPrice - item.buyingPrice) * item.quantity;
      });
    });

    const performanceList = Object.values(countsMap);

    // Filter out items that are not in catalog anymore if necessary, but keep list
    const bestSelling = [...performanceList].sort((a, b) => b.qtySold - a.qtySold);
    const leastSelling = [...performanceList].sort((a, b) => a.qtySold - b.qtySold);

    return { bestSelling, leastSelling };
  }, [monthlySales, products]);

  // --- 4. CURRENT VALUE OF STOCK IN DOCK (Warehouse Valuation) ---
  const stockValuation = useMemo(() => {
    return products.reduce((acc, p) => {
      acc.totalBuyingCost += (p.buyingPrice * p.quantityInStock);
      acc.potentialSalesValue += (p.sellingPrice * p.quantityInStock);
      return acc;
    }, { totalBuyingCost: 0, potentialSalesValue: 0 });
  }, [products]);

  const expectedProfitValuation = stockValuation.potentialSalesValue - stockValuation.totalBuyingCost;

  // --- 5. EXPORT CSV / EXCEL IMPLEMENTATION ---
  const generateSalesCSV = () => {
    const listToExport = reportPeriod === 'daily' ? dailySales : monthlySales;
    if (listToExport.length === 0) {
      alert('No sales to export in this timeframe.');
      return;
    }

    // Prepare headers
    let csvContent = 'Receipt Number,Date,Cashier,Items Count,Subtotal,Tax,Total,Payment Method,Ref/Code,Total Items List\n';
    
    // Add rows
    listToExport.forEach(s => {
      const itemsStr = s.items.map(it => `${it.name} (${it.quantity}x)`).join(' | ');
      const cleanRef = s.paymentDetailsRef || 'N/A';
      const cleanCashier = s.cashierName.replace(/,/g, '');
      csvContent += `${s.receiptNumber},${s.dateAdded},"${cleanCashier}",${s.items.length},${s.subtotal},${s.taxAmount},${s.total},${s.paymentMethod},"${cleanRef}","${itemsStr.replace(/"/g, '""')}"\n`;
    });

    // Download pipeline
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportPeriod === 'daily' ? 'Daily' : 'Monthly'}_SalesReport_2026-06.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- 6. TRIGGER NATIVE PRINT WINDOW ---
  const triggerPrintReport = () => {
    window.print();
  };

  const activeTotals = reportPeriod === 'daily' ? dailyTotalsObj : monthlyTotalsObj;
  const activeLabel = reportPeriod === 'daily' 
    ? `TODAY (${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})` 
    : reportPeriod === 'monthly'
      ? `THIS MONTH (${today.toLocaleString('en-US', { month: 'long', year: 'numeric' })})`
      : 'AI DIAGNOSTICS DEEP-DIVE';

  const totalPeriodExpenses = useMemo(() => {
    const currentMonthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const filterDateStr = reportPeriod === 'daily' ? todayStr : currentMonthPrefix;
    return expenses
      .filter(e => e.date.startsWith(filterDateStr))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, reportPeriod, todayStr, today]);

  return (
    <div className="space-y-6 printable-report-area" id="reports-module-page">
      
      {/* Visual title row + Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="reports-header-box">
        <div>
          <h2 className="text-xl font-bold font-sans text-zinc-900 dark:text-white flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-emerald-600" />
            Financial Reports &amp; Analytics
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Review retail sales totals, profit margins, payment structures, and top item statistics.</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex gap-2 print:hidden">
          <button
            onClick={generateSalesCSV}
            className="px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export Excel CSV
          </button>
          <button
            onClick={triggerPrintReport}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Report layout
          </button>
        </div>
      </div>

      {/* Selector Tabs and Duration label */}
      <div className="flex justify-between items-center print:hidden" id="reports-period-selector-panel">
        <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl flex" id="reports-tab-controls">
          <button
            onClick={() => setReportPeriod('daily')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              reportPeriod === 'daily'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Today's Audits
          </button>
          <button
            onClick={() => setReportPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              reportPeriod === 'monthly'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Monthly Audits ({today.toLocaleString('en-US', { month: 'short' })})
          </button>
          <button
            onClick={() => setReportPeriod('ai_insights')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportPeriod === 'ai_insights'
                ? 'bg-emerald-605 text-white bg-emerald-600 shadow-xs'
                : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-450'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            AI Enterprise Reports
          </button>
        </div>

        <div className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold uppercase flex items-center gap-1">
          <Calendar className="w-4 h-4 text-zinc-400" />
          Active: <span className="text-zinc-800 dark:text-zinc-100 font-bold ml-1">{activeLabel}</span>
        </div>
      </div>

      {reportPeriod !== 'ai_insights' ? (
        <>
          {/* Main Stats metrics panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="reports-grid-totals">
            
            {/* Total Revenue */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs" id="revenue-card">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Total Accounting Revenue</p>
              <h3 className="text-2xl font-extrabold font-sans text-zinc-950 dark:text-white mt-1.5">
                {KES(activeTotals.totalRevenue)}
              </h3>
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Completed checkouts:</span>
                <span className="font-bold font-mono">{activeTotals.transactionsCount} transactions</span>
              </div>
            </div>

            {/* Estimated Gross Profit */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs" id="profit-card">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Estimated Gross profit</p>
              <h3 className="text-2xl font-extrabold font-sans text-emerald-600 dark:text-emerald-400 mt-1.5">
                {KES(activeTotals.estimatedProfit)}
              </h3>
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Aggregated Gross Margin:</span>
                <span className="font-bold font-mono text-emerald-600">
                  {activeTotals.totalRevenue > 0 ? Math.round((activeTotals.estimatedProfit / activeTotals.totalRevenue) * 100) : 0}% margin
                </span>
              </div>
            </div>

            {/* Total Store Expenses */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs" id="expenses-report-card">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Total Period Expenses</p>
              <h3 className="text-2xl font-extrabold font-sans text-red-600 dark:text-red-400 mt-1.5">
                {KES(totalPeriodExpenses)}
              </h3>
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Corporate expenditures:</span>
                <span className="font-bold font-mono">Deducted ledger logs</span>
              </div>
            </div>

            {/* Net Operating Profit */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs" id="net-profit-card">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Net Operating Profit</p>
              {(() => {
                const netProfit = activeTotals.estimatedProfit - totalPeriodExpenses;
                const isNegative = netProfit < 0;
                return (
                  <>
                    <h3 className={`text-2xl font-extrabold font-sans mt-1.5 ${isNegative ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-350'}`}>
                      {KES(netProfit)}
                    </h3>
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>Net Efficiency:</span>
                      <span className={`font-bold font-mono ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {activeTotals.totalRevenue > 0 ? Math.round((netProfit / activeTotals.totalRevenue) * 100) : 0}% net return
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Payment splits summary indicators */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs" id="payment-methods-card">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-400">Payments collected by route</p>
              
              <div className="mt-3.5 space-y-1.5 text-[11px] text-zinc-655" id="payment-methods-reports-summary">
                {/* Cash */}
                <div className="flex justify-between items-center text-xs">
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-500 dark:text-zinc-450">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block pointer-events-none"></span>
                    Cash Drawer
                  </span>
                  <span className="font-mono font-bold">{KES(activeTotals.cashRevenue)}</span>
                </div>
                {/* M-Pesa */}
                <div className="flex justify-between items-center text-xs">
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-500 dark:text-zinc-450">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block pointer-events-none"></span>
                    Safaricom M-Pesa
                  </span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{KES(activeTotals.mpesaRevenue)}</span>
                </div>
                {/* Bank */}
                <div className="flex justify-between items-center text-xs">
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-500 dark:text-zinc-450">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block pointer-events-none"></span>
                    Bank Transfer / Cheque
                  </span>
                  <span className="font-mono font-bold">{KES(activeTotals.bankRevenue)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Structured Shelf Warehouse Valuation metrics (Useful for shop stock audit valuation!) */}
          {currentUserRole === 'admin' && (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white rounded-2xl p-5 border border-zinc-800 shadow-xs" id="warehouse-valuation-panel">
              <div className="flex items-center gap-2 pb-3.5 border-b border-zinc-800 mb-4">
                <ClipboardList className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-sm tracking-tight text-zinc-100">Supermarket Warehouse Audit &amp; Valuation</h4>
                  <p className="text-[11px] text-zinc-400">Full analysis of buying cost versus potential shelf retail values for active stock currently in stock.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="warehouse-valuation-figures">
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Total Shelf Asset Cost</span>
                  <p className="text-lg font-bold font-mono text-zinc-300 mt-0.5">{KES(stockValuation.totalBuyingCost)}</p>
                  <span className="text-[10px] text-zinc-500">Value of products at buying wholesale values</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Potential Realization Retail Value</span>
                  <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{KES(stockValuation.potentialSalesValue)}</p>
                  <span className="text-[10px] text-zinc-500">Value expected upon 100% stock sales checkout</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Estimated Locked Selling Profit</span>
                  <p className="text-lg font-bold font-mono text-teal-400 mt-0.5">{KES(expectedProfitValuation)}</p>
                  <span className="text-[10px] text-zinc-500">Locked cumulative profit margin: {Math.round((expectedProfitValuation / Math.max(stockValuation.potentialSalesValue, 1)) * 100)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Two Columns showing Best Selling items and Worst Selling items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="products-sales-velocity-section">
            
            {/* Best Selling Products */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs" id="best-selling-panel">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold font-sans text-zinc-905 dark:text-white flex items-center gap-1.5 text-sm">
                    <Award className="text-yellow-500 w-4.5 h-4.5" />
                    Best-Selling Products (Velocity Leaders)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Ranked by quantities bought during the active month (June)</p>
                </div>
              </div>

              <div className="overflow-x-auto" id="best-sellers-table-wrapper">
                <table className="w-full text-left text-xs" id="best-sellers-table">
                  <thead>
                    <tr className="border-b border-zinc-150 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase pb-2">
                      <th className="py-2">Product</th>
                      <th className="py-2">Category</th>
                      <th className="py-2 text-center">Quantities Sold</th>
                      <th className="py-2 text-right">Total Revenue</th>
                      <th className="py-2 text-right">Shop Profit (Est)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                    {productPerformanceStats.bestSelling.slice(0, 5).map((p, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 text-zinc-700 dark:text-zinc-300">
                        <td className="py-3 font-semibold text-zinc-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400 font-bold w-4">#{idx + 1}</span>
                            {p.name}
                          </div>
                        </td>
                        <td className="py-3 text-[11px] text-zinc-400">{p.category}</td>
                        <td className="py-3 text-center">
                          <span className="bg-emerald-50 dark:bg-emerald-950 font-bold px-2.5 py-0.5 rounded-full text-emerald-800 dark:text-emerald-400 font-mono">
                            {p.qtySold} sold
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-zinc-900 dark:text-zinc-200">{KES(p.revenue)}</td>
                        <td className="py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{KES(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Least Selling / Unmoved items (Required by admin to manage dead stock items!) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs" id="least-selling-panel">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold font-sans text-zinc-905 dark:text-white flex items-center gap-1.5 text-sm">
                    <TrendingDown className="text-zinc-450 w-4.5 h-4.5" />
                    Least-Selling / Slow-Moving Stock
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Review products left standing on shelves this month (June)</p>
                </div>
              </div>

              <div className="overflow-x-auto" id="least-sellers-table-wrapper">
                <table className="w-full text-left text-xs" id="least-sellers-table">
                  <thead>
                    <tr className="border-b border-zinc-150 dark:border-zinc-805 text-[10px] font-bold text-zinc-400 uppercase pb-2">
                      <th className="py-2">Product</th>
                      <th className="py-2">Category</th>
                      <th className="py-2 text-center">Quantities Sold</th>
                      <th className="py-2 text-right">Total Revenue</th>
                      <th className="py-2 text-right">Expected Shelf Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                    {productPerformanceStats.leastSelling.slice(0, 5).map((p, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 text-zinc-700 dark:text-zinc-300">
                        <td className="py-3 font-semibold text-zinc-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400 font-bold w-4">#{idx + 1}</span>
                            {p.name}
                          </div>
                        </td>
                        <td className="py-3 text-[11px] text-zinc-400">{p.category}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold font-mono text-[10px] ${p.qtySold === 0 ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-650'}`}>
                            {p.qtySold} sold
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-zinc-450">{KES(p.revenue)}</td>
                        <td className="py-3 text-right font-mono text-zinc-450">{KES(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      ) : (
        /* AI Report Generator Section */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-8" id="ai-generator-panel">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
            <div className="space-y-1">
              <h3 className="text-lg font-bold font-sans text-zinc-900 dark:text-white flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-emerald-600 dark:text-emerald-450 animate-pulse" />
                Automated Supermarket AI Analytics
              </h3>
              <p className="text-xs text-zinc-500">
                Query Gemini 3.5 Flash to synthesize transaction books, stock depth models, and sales activity.
              </p>
            </div>

            <div className="flex items-center gap-3 print:hidden">
              <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex" id="ai-scope-selector">
                <button
                  onClick={() => setAiReportPeriod('weekly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    aiReportPeriod === 'weekly'
                      ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  Weekly Scope
                </button>
                <button
                  onClick={() => setAiReportPeriod('monthly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    aiReportPeriod === 'monthly'
                      ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  Monthly Scope
                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold font-mono pointer-events-none">
                    Detailed
                  </span>
                </button>
              </div>

              <button
                onClick={handleGenerateAIReport}
                disabled={aiIsLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800/50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                {aiIsLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {aiIsLoading ? "Synthesizing..." : "Analyze Shop Ledger"}
              </button>
            </div>
          </div>

          {/* Loading State */}
          {aiIsLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4" id="ai-loading-state">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 animate-pulse">
                  {loadingSteps[loadingStepIdx]}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Please wait, parsing real inventory &amp; bookkeeping metrics may take up to 20 seconds...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {aiError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-xl flex gap-3 text-xs text-red-800 dark:text-red-300" id="ai-error-state">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="space-y-1">
                <p className="font-bold">Diagnostics Synthesis Error</p>
                <p className="text-zinc-650 dark:text-zinc-400">{aiError}</p>
                <button
                  onClick={handleGenerateAIReport}
                  className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-850 text-red-800 dark:text-red-250 font-bold rounded transition"
                >
                  Retry Request
                </button>
              </div>
            </div>
          )}

          {/* Informational guide when no report is generated */}
          {!aiReportData && !aiIsLoading && !aiError && (
            <div className="py-16 text-center max-w-md mx-auto space-y-4" id="ai-empty-prompt">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">No Active AI Report Prepared</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Click the <strong className="font-semibold text-zinc-800 dark:text-zinc-200">"Analyze Shop Ledger"</strong> button above to invoke deep diagnostics. This will ingest all current checkout registries, product stock depths, discounts given, and logged expenses.
                </p>
              </div>
            </div>
          )}

          {/* Generated Report Output Content */}
          {aiReportData && !aiIsLoading && !aiError && (
            <div className="space-y-8 animate-fade-in" id="ai-report-complete">
              
              {/* PDF & Print Actions */}
              <div className="flex justify-end gap-3 print:hidden">
                <button
                  onClick={handleDownloadAIPDF}
                  className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-250 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-850 dark:text-zinc-200 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download PDF Report
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Report
                </button>
              </div>

              {/* 1. Summary Block */}
              <div className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 p-5 rounded-2xl flex flex-col md:flex-row items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center shrink-0">
                  <BrainCircuit className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-600 dark:text-emerald-400 font-bold block">
                    Executive AI Growth Digest
                  </span>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                    {aiReportData.summary}
                  </p>
                </div>
              </div>

              {/* 2. Structured Finer Numbers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">AI Total Revenue</span>
                  <p className="text-lg font-bold font-mono text-zinc-900 dark:text-white mt-1">
                    {KES(aiReportData.analytics.totalRevenue)}
                  </p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">AI Gross Profit</span>
                  <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {KES(aiReportData.analytics.totalProfit)}
                  </p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Total Discounts Granted</span>
                  <p className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                    {KES(aiReportData.analytics.totalDiscounts)}
                  </p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800/80 p-4 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Analyzed Expenses</span>
                  <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                    {KES(aiReportData.analytics.totalExpenses)}
                  </p>
                </div>
              </div>

              {/* 3. Graphs and Finer Statistics (Bespoke Handcrafted SVG Charts) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="ai-charts-grid">
                
                {/* Daily Trend Area Graph */}
                <div className="bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-150 dark:border-zinc-805 p-5 rounded-xl space-y-4">
                  <div>
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider block">
                      Daily Sales &amp; Margin Velocity
                    </h4>
                    <p className="text-[10px] text-zinc-450">Continuous daily tracking of total revenue and corresponding gross profit.</p>
                  </div>
                  {aiReportData.charts?.dailyTrend?.length > 0 ? (
                    <div className="pt-2">
                      {(() => {
                        const trend = aiReportData.charts.dailyTrend;
                        const maxVal = Math.max(...trend.map((t: any) => t.revenue), 1000);
                        const points = trend.map((t: any, idx: number) => {
                          const x = (idx / Math.max(trend.length - 1, 1)) * 480;
                          const y = 140 - (t.revenue / maxVal) * 110;
                          return `${x},${y}`;
                        }).join(' ');

                        const profPoints = trend.map((t: any, idx: number) => {
                          const x = (idx / Math.max(trend.length - 1, 1)) * 480;
                          const y = 140 - (t.profit / maxVal) * 110;
                          return `${x},${y}`;
                        }).join(' ');

                        return (
                          <div className="space-y-2">
                            <svg viewBox="0 0 480 140" className="w-full h-32 overflow-visible">
                              <defs>
                                <linearGradient id="aiRevG" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              <line x1="0" y1="20" x2="480" y2="20" stroke="#e4e4e7" strokeDasharray="2,2" className="dark:stroke-zinc-800" />
                              <line x1="0" y1="70" x2="480" y2="70" stroke="#e4e4e7" strokeDasharray="2,2" className="dark:stroke-zinc-800" />
                              <line x1="0" y1="120" x2="480" y2="120" stroke="#e4e4e7" strokeDasharray="2,2" className="dark:stroke-zinc-800" />
                              
                              <path d={`M 0 140 L ${points} L 480 140 Z`} fill="url(#aiRevG)" />
                              <path d={`M ${points}`} fill="none" stroke="#10b981" strokeWidth="2.5" />
                              <path d={`M ${profPoints}`} fill="none" stroke="#14b8a6" strokeWidth="2" strokeDasharray="3,2" />
                            </svg>
                            <div className="flex justify-between text-[9px] text-zinc-450 font-semibold uppercase px-1">
                              <span>{trend[0]?.date || 'Start'}</span>
                              <span className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-0.5 bg-emerald-500 inline-block pointer-events-none"></span> Revenue
                                <span className="inline-block w-2.5 h-0.5 bg-teal-500 inline-block border-dashed pointer-events-none"></span> Profit
                              </span>
                              <span>{trend[trend.length - 1]?.date || 'Latest'}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Insufficient trend points analyzed.</p>
                  )}
                </div>

                {/* Simulated Forecast Trend Chart */}
                <div className="bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-150 dark:border-zinc-805 p-5 rounded-xl space-y-4">
                  <div>
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider block">
                      Growth Targets &amp; Outcomes Forecast
                    </h4>
                    <p className="text-[10px] text-zinc-450">AI projections (expected) paired with desired growth goals (targeted) for coming weeks.</p>
                  </div>
                  {aiReportData.charts?.forecastTrend?.length > 0 ? (
                    <div className="pt-2">
                      {(() => {
                        const fStats = aiReportData.charts.forecastTrend;
                        const maxF = Math.max(...fStats.flatMap((f: any) => [f.expectedRevenue, f.targetRevenue]), 1000);
                        
                        const expP = fStats.map((f: any, idx: number) => {
                          const x = (idx / Math.max(fStats.length - 1, 1)) * 480;
                          const y = 140 - (f.expectedRevenue / maxF) * 110;
                          return `${x},${y}`;
                        }).join(' ');

                        const tarP = fStats.map((f: any, idx: number) => {
                          const x = (idx / Math.max(fStats.length - 1, 1)) * 480;
                          const y = 140 - (f.targetRevenue / maxF) * 110;
                          return `${x},${y}`;
                        }).join(' ');

                        return (
                          <div className="space-y-2">
                            <svg viewBox="0 0 480 140" className="w-full h-32 overflow-visible">
                              <line x1="0" y1="20" x2="480" y2="20" stroke="#e4e4e7" strokeDasharray="2,2" className="dark:stroke-zinc-800" />
                              <line x1="0" y1="70" x2="480" y2="70" stroke="#e4e4e7" strokeDasharray="2,2" className="dark:stroke-zinc-800" />
                              <line x1="0" y1="120" x2="480" y2="120" stroke="#e4e4e7" strokeDasharray="2,2" className="dark:stroke-zinc-800" />

                              <path d={`M ${tarP}`} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,4" />
                              <path d={`M ${expP}`} fill="none" stroke="#10b981" strokeWidth="2.5" />
                            </svg>
                            <div className="flex justify-between text-[9px] text-zinc-450 font-semibold uppercase px-1">
                              <span>{fStats[0]?.label || 'Next Phase'}</span>
                              <span className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-0.5 bg-emerald-500 inline-block pointer-events-none"></span> Expected
                                <span className="inline-block w-2.5 h-0.5 bg-blue-500 inline-block border-dashed pointer-events-none"></span> Target
                              </span>
                              <span>{fStats[fStats.length - 1]?.label || 'Target End'}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Insufficient forecasting metrics processed.</p>
                  )}
                </div>

              </div>

              {/* 4. Category Growth Share Bars */}
              {aiReportData.charts?.categoryShare?.length > 0 && (
                <div className="bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-150 dark:border-zinc-805 p-5 rounded-2xl space-y-3">
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-widest block">
                    Interactive Category Contribution Index
                  </h4>
                  <div className="space-y-3 pt-1">
                    {aiReportData.charts.categoryShare.map((cat: any, i: number) => {
                      const maxCat = Math.max(...aiReportData.charts.categoryShare.map((c: any) => c.revenue), 1);
                      const percentage = (cat.revenue / maxCat) * 100;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-650 dark:text-zinc-450">
                            <span>{cat.category}</span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-100">
                              Volume: {KES(cat.revenue)} <span className="text-zinc-400 font-semibold">({KES(cat.profit)} Profit)</span>
                            </span>
                          </div>
                          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Inventory & Velocity Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Low Stock Replenishment Guide */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      AI Stock Replenishment &amp; Purchase Orders
                    </h4>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                      Low Stock Targets
                    </span>
                  </div>

                  <div className="overflow-x-auto text-[11px]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-450 font-bold uppercase pb-1">
                          <th className="pb-2">Product Name</th>
                          <th className="pb-2 text-center">In Stock</th>
                          <th className="pb-2 text-center">Recommend Log</th>
                          <th className="pb-2 text-right">Dispatch Urgency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                        {aiReportData.analytics.lowStockReplenishList?.slice(0, 5).map((r: any, idx: number) => {
                          const prioClr = r.priority === 'High' 
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450' 
                            : r.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-450'
                              : 'bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400';
                          return (
                            <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/10 text-zinc-700 dark:text-zinc-300">
                              <td className="py-2.5 font-bold text-zinc-900 dark:text-zinc-100">{r.name}</td>
                              <td className="py-2.5 text-center font-mono text-zinc-500">{r.currentStock} units</td>
                              <td className="py-2.5 text-center font-semibold text-emerald-600 dark:text-emerald-400 font-mono">+{r.recommendedReplenishQty} units</td>
                              <td className="py-2.5 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${prioClr}`}>
                                  {r.priority} Priority
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {(!aiReportData.analytics.lowStockReplenishList || aiReportData.analytics.lowStockReplenishList.length === 0) && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-zinc-400 text-xs">All products properly stocked. Excellent tracking!</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Product Velocity Segmentation Dashboard */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <Layers className="w-4 h-4 text-emerald-500 animate-pulse" />
                      Ledger Sales Velocity Tiers
                    </h4>
                    <span className="text-[10px] font-bold text-zinc-400">June Checkout Activity</span>
                  </div>

                  <div className="space-y-4 text-xs font-semibold">
                    
                    {/* High sales */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/35 px-2 py-0.5 rounded font-extrabold uppercase">
                          High Velocity (Primary Run Rate)
                        </span>
                        <span className="text-zinc-405">Strong Momentum</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/20 p-2.5 rounded-lg space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {aiReportData.analytics.itemVelocity.highSales?.slice(0, 3).map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-[11px] py-1">
                            <span className="text-zinc-800 dark:text-zinc-250 font-medium truncate max-w-[200px]">{item.name}</span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-100 font-bold">{item.qtySold} sold ({KES(item.revenue)})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Middle sales */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-blue-600 dark:text-blue-450 bg-blue-50 dark:bg-blue-950/35 px-2 py-0.5 rounded font-extrabold uppercase">
                          Middle Velocity (Secondary Shelf Run)
                        </span>
                        <span className="text-zinc-405">Regular Turnover</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/20 p-2.5 rounded-lg space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {aiReportData.analytics.itemVelocity.middleSales?.slice(0, 3).map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-[11px] py-1">
                            <span className="text-zinc-800 dark:text-zinc-250 font-medium truncate max-w-[200px]">{item.name}</span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-100 font-bold">{item.qtySold} sold ({KES(item.revenue)})</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Low sales */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-650 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-extrabold uppercase">
                          Low Velocity / Stagnant Stock
                        </span>
                        <span className="text-rose-500 dark:text-rose-455 font-bold">Needs Review</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/20 p-2.5 rounded-lg space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {aiReportData.analytics.itemVelocity.lowSales?.slice(0, 3).map((item: any, i: number) => (
                          <div key={i} className="flex justify-between text-[11px] py-1">
                            <span className="text-zinc-800 dark:text-zinc-250 font-medium truncate max-w-[200px]">{item.name}</span>
                            <span className="font-mono text-rose-500 font-bold">{item.qtySold} sold</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* 6. Comprehensive Owner Dossier (The Markdown report beautifully translated into rich JSX) */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-950/50 shadow-xs space-y-6" id="ai-markdown-brief">
                <div className="flex items-center gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <ClipboardList className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider">
                      Owner's Growth Strategy Dossier
                    </h4>
                    <p className="text-[11px] text-zinc-450">Complete contextualized textual audit covering upcoming month actions and core activity trends.</p>
                  </div>
                </div>

                <div className="prose max-w-none text-xs leading-relaxed font-sans text-zinc-800 dark:text-zinc-300">
                  {renderMarkdown(aiReportData.reportMarkdown)}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
