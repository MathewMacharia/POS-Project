import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  FolderPlus, 
  AlertTriangle, 
  ShieldAlert, 
  Building,
  Calendar,
  DollarSign,
  Barcode,
  Sparkles,
  Layers,
  Check,
  X
} from 'lucide-react';
import { Product, Category, Supplier } from '../types';

interface InventoryProps {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  onAddProduct: (product: Omit<Product, 'id' | 'dateAdded'>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onCreateCategory: (catName: string) => void;
  currentUserRole: 'admin' | 'cashier';
}

export default function Inventory({
  products,
  categories,
  suppliers,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onCreateCategory,
  currentUserRole
}: InventoryProps) {
  // Filters & State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState('All'); // All, Low, Out, NearingExpiry, Expired
  
  // Custom Category Drawer
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Add/Edit Product Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    barcode: '',
    buyingPrice: '',
    sellingPrice: '',
    quantityInStock: '',
    supplierName: '',
    customSupplierName: '',
    description: '',
    expiryDate: ''
  });

  // Calculate Date markers
  const todayStr = '2026-06-08'; // System current local time is 2026-06-08
  const currentTimestamp = new Date(todayStr).getTime();
  const thirtyDaysLaterTimestamp = currentTimestamp + 30 * 24 * 60 * 60 * 1000;

  // Filter Catalog
  const processedProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Search filter
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.barcode.includes(searchQuery) ||
        p.supplierName.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Category filter
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;

      // 3. Stock lifespan / quantities filter
      if (stockStatusFilter === 'All') {
        return matchesSearch && matchesCategory;
      }
      
      const isLow = p.quantityInStock > 0 && p.quantityInStock <= 10;
      const isOut = p.quantityInStock === 0;
      
      const expTime = p.expiryDate ? new Date(p.expiryDate).getTime() : null;
      const isExpired = expTime !== null && expTime < currentTimestamp;
      const isNearing = expTime !== null && expTime >= currentTimestamp && expTime <= thirtyDaysLaterTimestamp;

      if (stockStatusFilter === 'Low') return matchesSearch && matchesCategory && isLow;
      if (stockStatusFilter === 'Out') return matchesSearch && matchesCategory && isOut;
      if (stockStatusFilter === 'Expired') return matchesSearch && matchesCategory && isExpired;
      if (stockStatusFilter === 'NearingExpiry') return matchesSearch && matchesCategory && isNearing;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, stockStatusFilter]);

  // Open Form to Add Product
  const openAddModal = () => {
    if (currentUserRole !== 'admin') {
      alert("Samahani! Access denied. Only administrators can perform this change.");
      return;
    }
    setEditingProduct(null);
    setFormData({
      name: '',
      category: categories[0]?.name || 'Food Items',
      barcode: '',
      buyingPrice: '',
      sellingPrice: '',
      quantityInStock: '',
      supplierName: suppliers[0]?.name || 'Bidco Africa Ltd',
      customSupplierName: '',
      description: '',
      expiryDate: ''
    });
    setIsProductModalOpen(true);
  };

  // Open Form to Edit Product
  const openEditModal = (product: Product) => {
    if (currentUserRole !== 'admin') {
      alert("Access denied. Only administrators can edit products.");
      return;
    }
    const isCustomVal = product.supplierName && !suppliers.some(s => s.name === product.supplierName);
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      barcode: product.barcode || '',
      buyingPrice: product.buyingPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      quantityInStock: product.quantityInStock.toString(),
      supplierName: isCustomVal ? 'Other' : (product.supplierName || (suppliers[0]?.name || '')),
      customSupplierName: isCustomVal ? product.supplierName : '',
      description: product.description || '',
      expiryDate: product.expiryDate || ''
    });
    setIsProductModalOpen(true);
  };

  // Submit Product addition / modifications
  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!formData.name.trim()) {
      alert('Product Name is required.');
      return;
    }

    const buying = parseFloat(formData.buyingPrice) || 0;
    const selling = parseFloat(formData.sellingPrice) || 0;
    const qty = parseInt(formData.quantityInStock) || 0;

    if (buying <= 0) {
      alert('Buying Price must be greater than zero.');
      return;
    }

    if (selling <= 0) {
      alert('Selling Price must be greater than zero.');
      return;
    }

    if (selling < buying) {
      const confirmMargin = window.confirm(
        `⚠️ Warning: Your Selling Price (${selling}) is lower than the Buying Price (${buying}). This will record a financial loss on sales. Do you still want to proceed?`
      );
      if (!confirmMargin) return;
    }

    if (qty < 0) {
      alert('Stock Quantity cannot be negative.');
      return;
    }

    const finalSupplierName = formData.supplierName === 'Other'
      ? (formData.customSupplierName.trim() || 'Other')
      : formData.supplierName;

    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      barcode: formData.barcode.trim() || `619${Math.floor(Math.random() * 90000000 + 10000000)}`, // auto generate barcode if empty
      buyingPrice: buying,
      sellingPrice: selling,
      quantityInStock: qty,
      supplierName: finalSupplierName,
      description: formData.description.trim(),
      expiryDate: formData.expiryDate || undefined
    };

    if (editingProduct) {
      // Update
      onEditProduct({
        ...editingProduct,
        ...payload
      });
    } else {
      // Add
      onAddProduct(payload);
    }

    setIsProductModalOpen(false);
  };

  // Delete product action
  const handleDeleteProductClick = (id: string, name: string) => {
    if (currentUserRole !== 'admin') {
      alert("Access denied. Only administrators can delete products from catalog.");
      return;
    }
    const confirmDelete = window.confirm(`Futa Product? Are you completely sure you want to delete "${name}"? This action cannot be undone.`);
    if (confirmDelete) {
      onDeleteProduct(id);
    }
  };

  // Create Category action
  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    // Check if category exists
    const exists = categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase());
    if (exists) {
      alert('This category already exists.');
      return;
    }

    onCreateCategory(newCategoryName.trim());
    setNewCategoryName('');
    setIsCategoryModalOpen(false);
  };

  const KES = (val: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6" id="inventory-module-page">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="inventory-header">
        <div>
          <h2 className="text-xl font-bold font-sans text-zinc-900 dark:text-white">Product Catalog &amp; Stock Manager</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Add, edit, and keep track of your active inventory shelf levels and expiries.</p>
        </div>
        <div className="flex gap-2">
          <button
            id="open-category-ctrl"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            Custom Category
          </button>
          {currentUserRole === 'admin' && (
            <button
              id="add-product-btn-main"
              onClick={openAddModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          )}
        </div>
      </div>

      {/* Filter and Table Tools Panel */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row gap-3.5 items-stretch md:items-center justify-between" id="inventory-search-panel">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-zinc-400" />
          <input
            id="inv-search-input"
            type="text"
            placeholder="Search catalog by Name, Barcode, Supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-semibold"
          />
        </div>

        {/* Filters Selects */}
        <div className="flex flex-col sm:flex-row gap-2.5" id="inv-filter-selects">
          
          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-zinc-900 dark:bg-zinc-900 px-2 rounded-lg border border-zinc-700">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <select
              id="inv-category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent border-none py-1.5 px-2 text-xs font-semibold text-white dark:text-zinc-100 focus:outline-hidden cursor-pointer dark:bg-zinc-900"
            >
              <option value="All" className="bg-zinc-900 text-white">All Categories</option>
              {categories.map((cat, i) => (
                <option key={i} value={cat.name} className="bg-zinc-900 text-white">{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Lifespan Alert Status Filter */}
          <div className="flex items-center gap-1 bg-zinc-900 dark:bg-zinc-900 px-2 rounded-lg border border-zinc-700">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              id="inv-status-select"
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="bg-transparent border-none py-1.5 px-2 text-xs font-semibold text-white dark:text-zinc-100 focus:outline-hidden cursor-pointer dark:bg-zinc-900"
            >
              <option value="All" className="bg-zinc-900 text-white">All Shelf Alerts</option>
              <option value="Low" className="bg-zinc-900 text-white">⚠️ Low Stock Stock List</option>
              <option value="Out" className="bg-zinc-900 text-white">❌ Completely Sold Out</option>
              <option value="NearingExpiry" className="bg-zinc-900 text-white">⏰ Expiring {"<"} 30 Days</option>
              <option value="Expired" className="bg-zinc-900 text-white">🚨 Expired Products</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Responsive Inventory Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden" id="inventory-table-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" id="inventory-table-element">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="py-3 px-4">Product details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 font-mono">Buying (KES)</th>
                <th className="py-3 px-4 font-mono">Selling (KES)</th>
                <th className="py-3 px-4 text-center">Remaining Stock</th>
                <th className="py-3 px-4">Shelf Expiry</th>
                <th className="py-3 px-4">Supplier Name</th>
                {currentUserRole === 'admin' && <th className="py-3 px-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {processedProducts.length === 0 ? (
                <tr>
                  <td colSpan={currentUserRole === 'admin' ? 8 : 7} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    <AlertTriangle className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm">No products matched</p>
                    <p className="text-xs">Adjust your lookup searches or stock status dropdowns</p>
                  </td>
                </tr>
              ) : (
                processedProducts.map((p) => {
                  const isLow = p.quantityInStock > 0 && p.quantityInStock <= 10;
                  const isOut = p.quantityInStock === 0;

                  // Expiry evaluation
                  const expTime = p.expiryDate ? new Date(p.expiryDate).getTime() : null;
                  const isExpired = expTime !== null && expTime < currentTimestamp;
                  const isNearing = expTime !== null && expTime >= currentTimestamp && expTime <= thirtyDaysLaterTimestamp;

                  return (
                    <tr 
                      key={p.id}
                      className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition text-zinc-700 dark:text-zinc-300 ${
                        isExpired 
                          ? 'bg-red-50/20 dark:bg-red-950/5' 
                          : isNearing 
                            ? 'bg-amber-50/20 dark:bg-amber-950/5' 
                            : ''
                      }`}
                    >
                      {/* Product Name & Barcode */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-zinc-950 dark:text-white text-sm truncate max-w-xs">{p.name}</p>
                          <span className="text-[10px] font-mono text-zinc-400 mt-0.5 inline-flex items-center gap-1">
                            <Barcode className="w-3.5 h-3.5" />
                            {p.barcode || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4 font-medium">
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-[10px]">
                          {p.category}
                        </span>
                      </td>

                      {/* Buying Cost */}
                      <td className="py-3.5 px-4 font-mono font-medium text-zinc-500">
                        {KES(p.buyingPrice)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {KES(p.sellingPrice)}
                      </td>

                      {/* Stock units remaining */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`font-mono font-extrabold px-2.5 py-0.5 rounded-full text-xs text-center ${
                            isOut 
                              ? 'bg-red-100 text-red-700 animate-pulse'
                              : isLow 
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                          }`}>
                            {p.quantityInStock} unit(s)
                          </span>
                        </div>
                      </td>

                      {/* Shelf lifespan dates */}
                      <td className="py-3.5 px-4">
                        {p.expiryDate ? (
                          <span className={`inline-flex items-center gap-1 font-mono font-semibold text-[11px] px-2 py-0.5 rounded ${
                            isExpired 
                              ? 'bg-red-500 text-white animate-pulse' 
                              : isNearing 
                                ? 'bg-amber-500 text-white' 
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}>
                            {isExpired ? <ShieldAlert className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                            {p.expiryDate}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">No Shelf Expiry</span>
                        )}
                      </td>

                      {/* Supplier Contact */}
                      <td className="py-3.5 px-4 text-zinc-500 truncate max-w-[120px]" title={p.supplierName}>
                        <span className="inline-flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-zinc-400" />
                          {p.supplierName}
                        </span>
                      </td>

                      {/* Actions */}
                      {currentUserRole === 'admin' && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition cursor-pointer"
                              title="Modify product details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProductClick(p.id, p.name)}
                              className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition cursor-pointer"
                              title="Delete from list"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOM CATEGORY CREATOR MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xs w-full p-5 shadow-2xl">
            <h3 className="font-bold text-zinc-900 dark:text-white pb-2 border-b border-zinc-100 dark:border-zinc-800 text-center flex items-center justify-center gap-1.5 text-sm">
              <FolderPlus className="text-emerald-600 w-4 h-4" />
              Add Custom Category
            </h3>
            <form onSubmit={handleCategorySubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hygiene, Lubricants"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 focus:border-transparent outline-hidden font-semibold"
                />
              </div>
              <div className="flex gap-2 pt-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="w-1/2 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
                >
                  Save (S)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL FORM */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
            
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4.5 h-4.5 text-emerald-600" />
                {editingProduct ? 'Edit Catalog Product Details' : 'Register New Store Product'}
              </h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs font-medium">
              
              {/* Product name & barcode row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Product Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unga Wa Dola 2kg"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-semibold"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Barcode scanner reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 619112233440 (or auto generates)"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Category selector & Suppler Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Category Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-zinc-100 border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-hidden font-semibold cursor-pointer"
                  >
                    {categories.map((c, i) => (
                      <option key={i} value={c.name} className="bg-zinc-900 text-white">{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Wholesale Supplier</label>
                  <select
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-zinc-100 border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-hidden font-semibold cursor-pointer"
                  >
                    {suppliers.map((s, i) => (
                      <option key={i} value={s.name} className="bg-zinc-900 text-white">{s.name}</option>
                    ))}
                    <option value="Other" className="bg-zinc-900 text-white">-- Other (Custom Supplier) --</option>
                  </select>
                  {formData.supplierName === 'Other' && (
                    <div className="mt-2 text-left">
                      <label className="text-emerald-700 dark:text-emerald-400 block mb-1 font-bold">Specify Custom Supplier Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kipchimchim Wholesalers"
                        value={formData.customSupplierName}
                        onChange={(e) => setFormData({ ...formData, customSupplierName: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-950 dark:bg-zinc-950 text-white dark:text-white border border-emerald-500 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-hidden font-semibold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Buying price, Selling price & Stock units */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Buying Unit Cost (KES) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="wholesale unit cost"
                    value={formData.buyingPrice}
                    onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Selling Retail Price (KES) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="retail shop rate"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Active Quantity In Stock *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="quantity on shelves"
                    value={formData.quantityInStock}
                    onChange={(e) => setFormData({ ...formData, quantityInStock: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-mono text-sm font-bold"
                  />
                </div>
              </div>

              {/* Expiry Date Datepicker & description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Shelf Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="text-zinc-500 dark:text-zinc-400 block mb-1">Product Description / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Baker freshly made grade 1"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:bg-zinc-950 dark:focus:bg-zinc-950 outline-hidden"
                  />
                </div>
              </div>

              {/* Call to actions footer */}
              <div className="flex gap-3 justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Save Product details
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
