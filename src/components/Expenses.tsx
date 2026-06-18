import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Coins, 
  Calendar, 
  Layers, 
  Tag, 
  ClipboardList, 
  Filter, 
  TrendingDown, 
  Search,
  Download
} from 'lucide-react';
import { Expense, User } from '../types';
import { getNairobiToday } from '../utils/timezoneHelper';

interface ExpensesProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id' | 'timestamp' | 'recordedBy'>) => void;
  onDeleteExpense: (id: string) => void;
  currentUser: User;
}

const PRESET_CATEGORIES = [
  'Internet & WiFi Support',
  'Delivery & Logistics Logistics',
  'Products / Store Items Purchased',
  'Office Rent & Leasing',
  'Power & Water Utility Bills',
  'Other Operational Overheads'
];

export default function Expenses({ expenses, onAddExpense, onDeleteExpense, currentUser }: ExpensesProps) {
  // System local date dynamically generated
  const { todayStr, currentMonthStr } = getNairobiToday();
  const today = new Date();

  // State
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('dufuka_expense_categories');
    return saved ? JSON.parse(saved) : PRESET_CATEGORIES;
  });

  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Form states for new expense
  const [formCategory, setFormCategory] = useState(PRESET_CATEGORIES[0]);
  const [formItemName, setFormItemName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(todayStr);
  const [formNotes, setFormNotes] = useState('');

  // Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'daily' | 'monthly'>('monthly');

  // Core formatting helper
  const KES = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  // Add new Custom Expense Category
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategory.trim();
    if (!cleanName) return;
    if (categories.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
      alert('This expense category already exists.');
      return;
    }
    const updated = [...categories, cleanName];
    setCategories(updated);
    localStorage.setItem('dufuka_expense_categories', JSON.stringify(updated));
    setNewCategory('');
    setIsAddingCategory(false);
    setFormCategory(cleanName); // auto select it
  };

  // Remove Custom Category
  const handleDeleteCategory = (catName: string) => {
    if (window.confirm(`Are you sure you want to delete the "${catName}" category?`)) {
      const updated = categories.filter(c => c !== catName);
      setCategories(updated);
      localStorage.setItem('dufuka_expense_categories', JSON.stringify(updated));
      if (formCategory === catName) {
        setFormCategory(updated[0] || '');
      }
    }
  };

  // Create single expense handler
  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formAmount);
    if (!formItemName.trim()) {
      alert('Specify item description name.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Price amount must be greater than zero.');
      return;
    }
    if (!formCategory) {
      alert('Please select an expense category.');
      return;
    }

    onAddExpense({
      category: formCategory,
      itemName: formItemName.trim(),
      amount: amt,
      date: formDate,
      notes: formNotes.trim() || undefined
    });

    setFormItemName('');
    setFormAmount('');
    setFormNotes('');
    alert('Expense recorded successfully!');
  };

  // Filtered Expense Records
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Search matching
      const matchesSearch = exp.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      // Category matching
      const matchesCategory = filterCategory === 'All' || exp.category === filterCategory;
      // Date constraints (2026-06-09 is today code)
      let matchesPeriod = true;
      if (filterPeriod === 'daily') {
        matchesPeriod = exp.date === todayStr;
      } else if (filterPeriod === 'monthly') {
        matchesPeriod = exp.date.startsWith(currentMonthStr);
      }

      return matchesSearch && matchesCategory && matchesPeriod;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [expenses, searchTerm, filterCategory, filterPeriod, todayStr, today]);

  // High-Level Math Indicators
  const metrics = useMemo(() => {
    const todayExpenses = expenses.filter(e => e.date === todayStr);
    const thisMonthExpenses = expenses.filter(e => e.date.startsWith(currentMonthStr));

    const dailyTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Grouping totals by category for breakdown statement
    const categoryGroup: { [cat: string]: number } = {};
    expenses.forEach(e => {
      categoryGroup[e.category] = (categoryGroup[e.category] || 0) + e.amount;
    });

    const breakdown = Object.entries(categoryGroup).map(([name, amount]) => ({
      name,
      amount
    })).sort((a, b) => b.amount - a.amount);

    return {
      dailyTotal,
      monthlyTotal,
      breakdown
    };
  }, [expenses, todayStr]);

  const generateExpensesCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No expense items to export.');
      return;
    }
    const headers = ['ID', 'Date', 'Category', 'Expense Item', 'Amount (KES)', 'Notes', 'Recorded By', 'Created At'];
    const rows = filteredExpenses.map(e => [
      e.id,
      e.date,
      `"${e.category.replace(/"/g, '""')}"`,
      `"${e.itemName.replace(/"/g, '""')}"`,
      e.amount,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.recordedBy.replace(/"/g, '""')}"`,
      e.timestamp
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Dufuka_Store_Expenses_${filterPeriod}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="expenses-module">
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4" id="expenses-header">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Coins className="text-red-500 w-5 h-5" />
            Store Expenses Ledger
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage utility payments, transport dispatch, stock item procurement, internet subscriptions, and other custom corporate expenditures.
          </p>
        </div>
        <button
          onClick={generateExpensesCSV}
          disabled={filteredExpenses.length === 0}
          className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV Log
        </button>
      </div>

      {/* Metrics Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="expense-metrics-row">
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-xl text-red-600 dark:text-red-400">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wider">Today's Expenses</span>
            <span className="text-lg font-mono font-extrabold text-zinc-900 dark:text-zinc-100">{KES(metrics.dailyTotal)}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-xl text-red-600 dark:text-red-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wider">This Month Total</span>
            <span className="text-lg font-mono font-extrabold text-zinc-900 dark:text-zinc-100">{KES(metrics.monthlyTotal)}</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-xl text-red-600 dark:text-red-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block font-bold uppercase tracking-wider">Top Expenditure Allocation</span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
              {metrics.breakdown[0] ? `${metrics.breakdown[0].name} (${KES(metrics.breakdown[0].amount)})` : 'None recorded'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Left Column is Logging Forms & Category admin, Right Column is ledger list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="expense-main-workspace">
        
        {/* Workspace Form Side (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Form: Add New Expense */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <Plus className="text-red-500 w-4 h-4" />
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-xs uppercase tracking-wider">Record Store Expense</h3>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Select Expense Category *</label>
                <div className="flex gap-2">
                  <select
                    required
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="flex-1 bg-zinc-900 dark:bg-zinc-900 py-2.5 px-3 border border-zinc-700 rounded-lg text-white dark:text-zinc-100 outline-hidden font-bold"
                  >
                    {categories.length === 0 && <option value="" className="bg-zinc-900 text-white">-- No Categories --</option>}
                    {categories.map((cat, idx) => (
                      <option key={idx} value={cat} className="bg-zinc-900 text-white">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Expense Item / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Safaricom Fibre Office Internet Subscription"
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-red-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Amount (KES) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 3500"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-red-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-red-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Audit Log / Justification</label>
                <textarea
                  rows={2}
                  placeholder="Additional context on why the operational store expense was incurred..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-red-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden text-[11px]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg tracking-wide uppercase shadow-xs hover:shadow-md transition duration-150 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Commit Expense Entry
              </button>
            </form>
          </div>

          {/* Category Administration Panel */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Tag className="text-red-500 w-4 h-4" />
                <h3 className="font-extrabold text-zinc-900 dark:text-white text-xs uppercase tracking-wider">Expense Categories</h3>
              </div>
              <button
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="text-[10px] text-red-600 hover:text-red-800 font-extrabold flex items-center gap-0.5 cursor-pointer"
              >
                {isAddingCategory ? 'Cancel' : 'Add New'}
              </button>
            </div>

            {isAddingCategory && (
              <form onSubmit={handleAddCategorySubmit} className="space-y-2 mt-1">
                <input
                  type="text"
                  required
                  placeholder="e.g. Staff Beverages & Meals"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg text-xs outline-hidden"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 bg-zinc-900 dark:bg-zinc-805 hover:bg-black dark:hover:bg-zinc-700 text-white text-[10px] uppercase font-extrabold rounded-md shadow-xs cursor-pointer transition duration-150"
                >
                  Save New Category
                </button>
              </form>
            )}

            <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5 text-xs font-semibold">
              {categories.map((cat, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 px-2 bg-zinc-50 dark:bg-zinc-855 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-700 dark:text-zinc-300 truncate pr-2">{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat)}
                    className="text-zinc-400 hover:text-red-600 p-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-750 cursor-pointer"
                    title="Remove category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workspace Ledger Table (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Interactive Filters Grid */}
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col md:flex-row gap-3 items-center">
            
            {/* Search items bar */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search description, logs, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 dark:bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-red-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden text-white dark:text-zinc-150"
              />
            </div>

            {/* Category toggle */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider hidden md:inline">Category:</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-zinc-900 dark:bg-zinc-900 py-2 px-3 border border-zinc-700 rounded-xl text-xs font-bold text-white dark:text-zinc-200 cursor-pointer"
              >
                <option value="All" className="bg-zinc-900 text-white">All Categories</option>
                {categories.map((c, i) => (
                  <option key={i} value={c} className="bg-zinc-900 text-white">{c}</option>
                ))}
              </select>
            </div>

            {/* Period toggle */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl self-stretch md:self-auto">
              {(['all', 'daily', 'monthly'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setFilterPeriod(period)}
                  className={`px-3 py-1.5 text-[10px] font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                    filterPeriod === period
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  {period === 'all' ? 'All' : period === 'daily' ? 'Daily' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>

          {/* Ledger Table Container */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ClipboardList className="text-red-500 w-4 h-4" />
                Filtered Expenditures ({filteredExpenses.length} entries)
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-sm">
                Total Expenses: {KES(filteredExpenses.reduce((sum, e) => sum + e.amount, 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-wider bg-zinc-50/30 dark:bg-zinc-950/20">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Expense Item</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Officer Log</th>
                    <th className="py-3 px-4 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-350">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                        No expense entries found matching selected logs filters.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-850/30 transition">
                        <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap">
                          {exp.date}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 text-[10.5px] text-zinc-650 dark:text-zinc-300 font-bold">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div>
                            <span className="text-zinc-900 dark:text-white font-bold block">{exp.itemName}</span>
                            {exp.notes && (
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-450 italic font-normal line-clamp-1 mt-0.5">
                                Note: {exp.notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-right text-red-600 dark:text-red-400 font-bold whitespace-nowrap">
                          {KES(exp.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-[10.5px] text-zinc-500 uppercase font-semibold whitespace-nowrap">
                          {exp.recordedBy}
                        </td>
                        <td className="py-3.5 px-4 text-center print:hidden whitespace-nowrap">
                          <button
                            onClick={() => onDeleteExpense(exp.id)}
                            className="text-zinc-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition"
                            title="Delete operational log permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredExpenses.length > 0 && (
              <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 text-right text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                ⚠️ PERMANENT FISCAL AUDIT LEDGER
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
