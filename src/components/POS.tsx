import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Minus, 
  Plus, 
  Coins, 
  PhoneCall, 
  Landmark, 
  Printer, 
  Download, 
  Barcode, 
  RotateCcw,
  CheckCircle,
  HelpCircle,
  X,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Product, SaleItem, Sale, ShopSettings } from '../types';
import { generateReceiptPDF } from '../utils/pdfGenerator';

interface POSProps {
  products: Product[];
  categories: string[];
  shopSettings: ShopSettings;
  currentUser: { id: string; fullName: string };
  onCompleteSale: (
    items: SaleItem[], 
    paymentMethod: 'Cash' | 'M-Pesa' | 'Bank', 
    paymentDetailsRef: string, 
    paidAmount: number, 
    changeAmount: number,
    discountAmount?: number
  ) => Sale; // returns the completed Sale
}

export default function POS({
  products,
  categories,
  shopSettings,
  currentUser,
  onCompleteSale
}: POSProps) {
  // POS State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<SaleItem[]>(() => {
    const saved = localStorage.getItem('dufuka_pos_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('dufuka_pos_cart', JSON.stringify(cart));
  }, [cart]);
  
  // Checkout flow state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'M-Pesa' | 'Bank'>('Cash');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState('');
  const [discountInput, setDiscountInput] = useState<string>('0');
  
  // Post-sale receipt state
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptSaved, setIsReceiptSaved] = useState(false);
  const [autoSaveToDb, setAutoSaveToDb] = useState(true);
  const [pendingCheckoutParams, setPendingCheckoutParams] = useState<{
    cartItems: SaleItem[];
    paymentMethod: 'Cash' | 'M-Pesa' | 'Bank';
    refCode: string;
    paidVal: number;
    changeVal: number;
  } | null>(null);

  // Barcode quick-simulator input (simulating a barcode scanner keypress input)
  const [scannerInput, setScannerInput] = useState('');
  const [scanStatusMessage, setScanStatusMessage] = useState('');

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.barcode.includes(searchQuery) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Stock rule: "If stock reaches zero: Product should automatically disappear from active stock list or be marked out of stock"
      // Let's filter products to make sure attendants see what's in stock or out of stock with indicators.
      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, selectedCategory]);

  const barcodeScannerRef = useRef<HTMLInputElement>(null);

  // Format currency
  const KES = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { 
      style: 'currency', 
      currency: 'KES',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.quantityInStock <= 0) {
      alert(`Samahani! This product is currently out of stock.`);
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        // Evaluate stock limit
        if (existingItem.quantity >= product.quantityInStock) {
          alert(`Inatosha! Cannot add more. Only ${product.quantityInStock} units are available in stock.`);
          return prevCart;
        }
        return prevCart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, {
          id: product.id,
          name: product.name,
          quantity: 1,
          sellingPrice: product.sellingPrice,
          buyingPrice: product.buyingPrice
        }];
      }
    });

    // Clear search for easy next addition
    setSearchQuery('');
  };

  // Update Item Quantity directly
  const updateQuantity = (itemId: string, change: number) => {
    const originalProduct = products.find(p => p.id === itemId);
    if (!originalProduct) return;

    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + change;
          
          if (newQty <= 0) {
            return null; // will filter out
          }
          if (newQty > originalProduct.quantityInStock) {
            alert(`Stock limit reached! Only ${originalProduct.quantityInStock} units in stock.`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as SaleItem[];
    });
  };

  // Remove directly
  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  }, [cart]);

  const discountVal = useMemo(() => {
    return parseFloat(discountInput) || 0;
  }, [discountInput]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountVal);
  }, [cartSubtotal, discountVal]);

  // Standard 16% VAT in Kenya
  const cartTax = useMemo(() => {
    // VAT is calculated inside the total (inclusive)
    return Math.round(cartTotal * 0.16);
  }, [cartTotal]);

  // Change Return calculation
  const cashReceivedAmount = parseFloat(paidAmount) || 0;
  const changeCalculation = useMemo(() => {
    if (cashReceivedAmount < cartTotal) return 0;
    return cashReceivedAmount - cartTotal;
  }, [cashReceivedAmount, cartTotal]);

  // Handle barcode scanning simulator action
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannerInput.trim()) return;

    // Search for product with exact matching barcode
    const foundProduct = products.find(p => p.barcode === scannerInput.trim());
    
    if (foundProduct) {
      if (foundProduct.quantityInStock <= 0) {
        setScanStatusMessage(`❌ ${foundProduct.name} is Out of Stock!`);
      } else {
        addToCart(foundProduct);
        setScanStatusMessage(`✅ Added ${foundProduct.name} to checkout`);
      }
    } else {
      setScanStatusMessage(`⚠️ Product with barcode "${scannerInput}" not found`);
    }

    setScannerInput('');
    // Clear message after 3 seconds
    setTimeout(() => setScanStatusMessage(''), 3500);
  };

  // Pre-fill scanner input to try easily
  const simulateScan = (barcode: string) => {
    setScannerInput(barcode);
    setTimeout(() => {
      const foundProduct = products.find(p => p.barcode === barcode);
      if (foundProduct) {
        addToCart(foundProduct);
        setScanStatusMessage(`⚡ Fast Scanned: ${foundProduct.name}`);
      } else {
        setScanStatusMessage(`⚠️ Product not found`);
      }
      setScannerInput('');
      setTimeout(() => setScanStatusMessage(''), 3000);
    }, 200);
  };

  // Begin Checkout process
  const triggerCheckout = () => {
    if (cart.length === 0) return;
    setPaidAmount(cartTotal.toString()); // default the cash received to match total
    setPaymentRef('');
    setPaymentMethod('Cash');
    setIsCheckoutOpen(true);
  };

  // Complete Payment Action
  const finalizeSale = async () => {
    if (cart.length === 0) return;

    const paidVal = parseFloat(paidAmount) || 0;
    if (paymentMethod === 'Cash' && paidVal < cartTotal) {
      alert(`Incomplete cash! Cash received must be at least KES ${cartTotal}.`);
      return;
    }

    const refCode = paymentMethod === 'Cash' 
      ? `CASH-CHG-${changeCalculation}` 
      : paymentRef.trim() || `TX-${Math.floor(Math.random() * 900000 + 100000)}`;

    const paidFinal = paymentMethod === 'Cash' ? paidVal : cartTotal;
    const changeFinal = paymentMethod === 'Cash' ? changeCalculation : 0;

    setPendingCheckoutParams({
      cartItems: [...cart],
      paymentMethod,
      refCode,
      paidVal: paidFinal,
      changeVal: changeFinal
    });

    if (autoSaveToDb) {
      const retSale = await onCompleteSale(
        cart,
        paymentMethod,
        refCode,
        paidFinal,
        changeFinal,
        discountVal
      );
      if (retSale) {
        setCompletedSale(retSale);
        setIsReceiptSaved(true);
      }
      // Reset Cart
      setCart([]);
      setDiscountInput('0');
    } else {
      // Build a realistic provisional/draft Sale object for receipt render
      const tempId = `sale_draft_${Date.now()}`;
      const draftReceiptNo = `DRAFT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
      const draftSale: Sale = {
        id: tempId,
        receiptNumber: draftReceiptNo,
        items: [...cart],
        subtotal: cartSubtotal,
        taxAmount: cartTax,
        total: cartTotal,
        discount: discountVal,
        paymentMethod,
        paymentDetailsRef: refCode,
        paidAmount: paidFinal,
        changeAmount: changeFinal,
        cashierId: currentUser?.id || 'usr_unknown',
        cashierName: currentUser?.fullName || 'Cashier',
        dateAdded: new Date().toISOString()
      };
      setCompletedSale(draftSale);
      setIsReceiptSaved(false);
      setCart([]);
      setDiscountInput('0');
    }

    setIsCheckoutOpen(false);
    setIsReceiptOpen(true);
  };

  // Receipt printing helper
  const handlePrintReceipt = () => {
    window.print();
  };

  // Save uncommitted Sale to active database
  const handleSaveToDatabase = async () => {
    if (isReceiptSaved || !pendingCheckoutParams) return;
    const { cartItems, paymentMethod, refCode, paidVal, changeVal } = pendingCheckoutParams;

    const retSale = await onCompleteSale(
      cartItems,
      paymentMethod,
      refCode,
      paidVal,
      changeVal
    );
    if (retSale) {
      setCompletedSale(retSale);
      setIsReceiptSaved(true);
    }
    // Clear active checkout cart now that records are persisted
    setCart([]);
  };

  // Safe dismiss/close receipt validator
  const handleCloseReceipt = () => {
    if (!isReceiptSaved) {
      const confirmSave = window.confirm(
        "⚠️ WARNING: This sale receipt has NOT been saved to the active records database!\n\nDo you want to save it now to sync stock levels and register the checkout entry?"
      );
      if (confirmSave) {
        handleSaveToDatabase();
      } else {
        // Dismiss and leave items in Cart for subsequent edits if checkout parameters are draft
        setIsReceiptOpen(false);
        setCompletedSale(null);
      }
    } else {
      setIsReceiptOpen(false);
      setCompletedSale(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch" id="pos-terminal-grid">
      
      {/* Products & Catalog browsing side (7 Cols) */}
      <div className="xl:col-span-7 flex flex-col justify-between" id="pos-products-side">
        
        {/* Search, Filter and Barcode simulator bar */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 gap-4 flex flex-col" id="pos-catalog-controls">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            {/* Standard Search Input */}
            <div className="relative w-full md:w-2/3">
              <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-zinc-400 pointer-events-none" />
              <input
                id="product-search-bar"
                type="text"
                placeholder="Search products by Name, Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-900 dark:bg-zinc-900 focus:bg-zinc-950 dark:focus:bg-zinc-950 text-white dark:text-white border border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-2.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Simulated hardware barcode action */}
            <form onSubmit={handleBarcodeSubmit} className="relative w-full md:w-1/3 flex gap-1" id="barcode-form-submit">
              <div className="relative flex-1">
                <Barcode className="absolute left-2.5 top-2.5 w-4.5 h-4.5 text-zinc-400 pointer-events-none" />
                <input
                  id="barcode-hardware-input"
                  ref={barcodeScannerRef}
                  type="text"
                  placeholder="Scan / Type Barcode"
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 bg-zinc-900 dark:bg-zinc-900 text-xs text-white dark:text-white border border-zinc-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-transparent outline-hidden"
                />
              </div>
              <button 
                type="submit" 
                className="bg-zinc-800 text-white dark:bg-zinc-700 text-xs px-2.5 py-2 hover:bg-zinc-700 dark:hover:bg-zinc-600 rounded-lg font-semibold border border-zinc-600 cursor-pointer"
              >
                Enter
              </button>
            </form>
          </div>

          {/* Barcode Quick Simulators for Cashiers to test */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/20 p-2.5 rounded-lg">
            <span className="font-semibold text-[10px] uppercase text-zinc-400 flex items-center gap-1">
              <Barcode className="w-3.5 h-3.5" />
              Quick Scan Sim:
            </span>
            <button 
              type="button"
              onClick={() => simulateScan('619112233441')} // Jogoo Maize
              className="px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 rounded text-[11px] font-medium transition cursor-pointer"
            >
              Jogoo Maize
            </button>
            <button 
              type="button"
              onClick={() => simulateScan('619112233444')} // Tusker Lager
              className="px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 rounded text-[11px] font-medium transition cursor-pointer"
            >
              Tusker Bottle
            </button>
            <button 
              type="button"
              onClick={() => simulateScan('619112233481')} // Panadol
              className="px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 rounded text-[11px] font-medium transition cursor-pointer"
            >
              Panadol Extra
            </button>
            {scanStatusMessage && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse ml-auto">
                {scanStatusMessage}
              </span>
            )}
          </div>

          {/* Category Quick Badges */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin" id="category-filter-scroll">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
                selectedCategory === 'All'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              All Items
            </button>
            {categories.map((cat, i) => (
              <button
                key={i}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Catalog Grid */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[550px] overflow-y-auto pr-1" id="catalog-products-grid">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl" id="no-products-found-indicator">
              <HelpCircle className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">No products found matching &quot;{searchQuery}&quot;</p>
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} 
                className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Reset catalog filters
              </button>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isLow = p.quantityInStock > 0 && p.quantityInStock <= 10;
              const isOut = p.quantityInStock === 0;
              
              return (
                <div
                  id={`product-card-${p.id}`}
                  key={p.id}
                  onClick={() => !isOut && addToCart(p)}
                  className={`bg-white dark:bg-zinc-900 border rounded-xl p-3.5 text-left flex flex-col justify-between transition group relative ${
                    isOut 
                      ? 'border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 opacity-60 cursor-not-allowed' 
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-xs cursor-pointer active:scale-[0.99]'
                  }`}
                >
                  {/* Indicators overlay */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1 items-end pointer-events-none">
                    {isOut ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-100 text-red-700 rounded-sm">
                        SOLD OUT
                      </span>
                    ) : isLow ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-700 rounded-sm">
                        LOW STOCK
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 block truncate">
                      {p.category}
                    </span>
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm group-hover:text-emerald-600 transition mt-1 line-clamp-2">
                      {p.name}
                    </h4>
                    <span className="text-[11px] font-mono text-zinc-400 block mt-1">
                      Barcode: {p.barcode || 'N/A'}
                    </span>
                  </div>

                  <div className="mt-4 flex justify-between items-center pt-2.5 border-t border-zinc-100 dark:border-zinc-800/50">
                    <span className="font-mono font-bold text-zinc-950 dark:text-white text-sm">
                      {KES(p.sellingPrice)}
                    </span>
                    <span className={`text-[11px] font-medium font-mono ${isOut ? 'text-red-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {isOut ? 'Out of stock' : `Stock: ${p.quantityInStock}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
      </div>

      {/* Cart, Checkout & Pricing Details Side (5 Cols) */}
      <div className="xl:col-span-5 flex flex-col justify-between" id="pos-cart-side">
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full min-h-[500px]" id="pos-billing-cart">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3" id="cart-header">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold font-sans text-zinc-900 dark:text-white">Active Checkout Cart</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  {cart.reduce((sum, i) => sum + i.quantity, 0)} items
                </span>
                {cart.length > 0 && (
                  <button 
                    onClick={() => setCart([])}
                    className="text-xs text-zinc-400 hover:text-red-500 p-1 rounded-lg transition hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                    title="Empty Cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1" id="cart-items-scroller">
              {cart.length === 0 ? (
                <div className="py-20 text-center text-zinc-400 dark:text-zinc-500" id="cart-empty-message">
                  <ShoppingCart className="w-12 h-12 text-zinc-200 dark:text-zinc-800 mx-auto mb-3" />
                  <p className="text-sm">Receipt is empty.</p>
                  <p className="text-xs mt-1 text-zinc-400">Search products or trigger &quot;Quick scan simulator&quot; keys above.</p>
                </div>
              ) : (
                cart.map((item) => {
                  const prod = products.find(p => p.id === item.id);
                  const limit = prod ? prod.quantityInStock : 99;

                  return (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 rounded-xl"
                      id={`cart-row-${item.id}`}
                    >
                      <div className="truncate flex-1 pr-3">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate">{item.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {KES(item.sellingPrice)} /unit
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Incrementor Buttons */}
                        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-xs overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 px-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 px-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Totals */}
                        <span className="font-mono text-xs font-bold text-zinc-950 dark:text-white w-20 text-right">
                          {KES(item.sellingPrice * item.quantity)}
                        </span>

                        {/* Trash Button */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-zinc-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Checkout Totals pane */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mt-4" id="cart-billing-totals">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                <span>Subtotal (VAT Inclusive)</span>
                <span className="font-mono font-medium">{KES(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400">
                <span>Estimated 16% VAT Tax</span>
                <span className="font-mono text-zinc-400 text-[11px]">{KES(cartTax)}</span>
              </div>

              {/* Discount Input field / preset selectors */}
              <div className="py-2.5 my-1.5 border-t border-b border-zinc-100 dark:border-zinc-800 text-left">
                <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block mb-1 uppercase tracking-wider">Apply Discount (KES Amount)</span>
                <div className="flex flex-wrap gap-1 mb-2">
                  {[0, 100, 200, 300, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      disabled={cartSubtotal === 0}
                      onClick={() => setDiscountInput(amt.toString())}
                      className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border transition cursor-pointer ${
                        discountVal === amt
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 hover:bg-zinc-100 dark:hover:bg-zinc-850'
                      }`}
                    >
                      {amt === 0 ? 'No Disc' : `${amt}/-`}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    disabled={cartSubtotal === 0}
                    min="0"
                    max={cartSubtotal}
                    placeholder="Custom discount amount"
                    value={discountInput === '0' ? '' : discountInput}
                    onChange={(e) => {
                      const val = Math.min(cartSubtotal, Math.max(0, parseFloat(e.target.value) || 0));
                      setDiscountInput(val > 0 ? val.toString() : '0');
                    }}
                    className="w-full px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 mb-4">
                <span className="font-bold text-zinc-900 dark:text-white text-sm">TOTAL AMOUNT DUE</span>
                <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-xl" id="checkout-total-val">
                  {KES(cartTotal)}
                </span>
              </div>
            </div>

            {/* Complete Sale Execution Button */}
            <button
              id="complete-sale-trigger"
              disabled={cart.length === 0}
              onClick={triggerCheckout}
              className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-xs transition ${
                cart.length === 0
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-[0.99]'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              Complete Sale (F2)
            </button>
          </div>
        </div>

      </div>

      {/* PAYMENT METHOD SELECTION OVERLAY MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 shadow-2xl animate-fade-in" id="payment-overlay">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl" id="payment-modal-card">
            
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
                <Coins className="text-emerald-600 w-5.5 h-5.5" />
                Select Payment & Record Sale
              </h3>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Grand amount tag */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl text-center border border-emerald-100 dark:border-emerald-900">
                <p className="text-xs uppercase font-semibold text-emerald-800 dark:text-emerald-400 tracking-wider">Total Charge</p>
                <h4 className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-300 mt-1">
                  {KES(cartTotal)}
                </h4>
              </div>

              {/* Payment Type Selection Buttons */}
              <div>
                <label className="text-xs font-semibold uppercase text-zinc-400 block mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Cash */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`py-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === 'Cash'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Coins className="w-5 h-5" />
                    Cash Currency
                  </button>

                  {/* M-Pesa till / paybill */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('M-Pesa')}
                    className={`py-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === 'M-Pesa'
                        ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <PhoneCall className="w-5 h-5" />
                    M-Pesa Record
                  </button>

                  {/* Bank Direct transfer */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Bank')}
                    className={`py-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      paymentMethod === 'Bank'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Landmark className="w-5 h-5" />
                    Bank Transfer
                  </button>
                </div>
              </div>

              {/* Dynamic details input panels depending on selection */}
              <div className="p-4 bg-zinc-900 border border-zinc-700/80 rounded-xl space-y-3">
                {paymentMethod === 'Cash' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        Cash Amount Received (KES)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 500, 1000, 2000"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 text-white border border-zinc-705 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:border-transparent outline-hidden font-mono font-bold"
                      />
                    </div>
                    {cashReceivedAmount >= cartTotal ? (
                      <div className="flex justify-between items-center bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-800 text-sm">
                        <span className="font-semibold text-zinc-300">Change to return:</span>
                        <span className="font-mono font-extrabold text-emerald-400">
                           {KES(changeCalculation)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold bg-red-950/20 p-2 rounded">
                        <AlertCircle className="w-4 h-4" />
                        Amount received is lower than total due
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'M-Pesa' && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Instruct customer to pay via Paybill <span className="font-mono font-bold">{shopSettings.paybillNumber}</span> or Buy Goods Till <span className="font-mono font-bold">{shopSettings.tillNumber}</span>.
                    </p>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-zinc-400 block mb-1">M-Pesa SMS Code</label>
                      <input
                        type="text"
                        placeholder="e.g. RFG8AS990Q (10 characters)"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value.toUpperCase())}
                        maxLength={12}
                        className="w-full px-3 py-2 bg-zinc-950 text-white border border-zinc-705 rounded-lg text-sm focus:ring-1 focus:ring-teal-500 focus:border-transparent outline-hidden font-mono font-bold"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'Bank' && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">
                      Record bank deposit, wire cheque or PDQ card terminal transaction tracking.
                    </p>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-zinc-400 block mb-1">Bank Reference Code</label>
                      <input
                        type="text"
                        placeholder="e.g. BK-28952"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-950 text-white border border-zinc-705 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-hidden font-mono font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Auto-Save to Ledger Option */}
              <div className="flex items-center gap-2.5 p-3 bg-zinc-100 dark:bg-zinc-850 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <input
                  id="toggle-autosave-ledger"
                  type="checkbox"
                  checked={autoSaveToDb}
                  onChange={(e) => setAutoSaveToDb(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <div className="flex-1 text-left">
                  <label htmlFor="toggle-autosave-ledger" className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                    Auto-Save to Receipt Database (Ledger)
                  </label>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Check to record sale logs and subtract product stock immediately upon finalize.
                  </p>
                </div>
              </div>

              {/* Action Buttons to finalize */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="w-1/2 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold rounded-xl text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={finalizeSale}
                  disabled={paymentMethod === 'Cash' && cashReceivedAmount < cartTotal}
                  className={`w-1/2 py-2.5 font-bold rounded-xl text-sm transition text-white shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'Cash' && cashReceivedAmount < cartTotal
                      ? 'bg-zinc-400 cursor-not-allowed opacity-50'
                      : paymentMethod === 'M-Pesa' 
                        ? 'bg-teal-600 hover:bg-teal-700' 
                        : paymentMethod === 'Bank' 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <CheckCircle className="w-4.5 h-4.5" />
                  Print Receipt
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE SUPERMARKET THERMAL RECEIPT POPUP MODAL */}
      {isReceiptOpen && completedSale && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" id="receipt-overlay">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col justify-between" id="receipt-modal-card">
            
            {/* Modal Controls */}
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3 print:hidden">
              {isReceiptSaved ? (
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Sale Recorded Successfully
                </span>
              ) : (
                <span className="text-xs bg-amber-100 dark:bg-amber-955 text-amber-850 dark:text-amber-400 font-bold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Uncommitted Draft Receipt
                </span>
              )}
              <button 
                onClick={handleCloseReceipt}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Authenticity Supermarket Thermal Receipt Core (3 inches format structured for printing) */}
            <div 
              id="printable-thermal-receipt" 
              className="bg-zinc-50 p-4 dark:bg-white text-zinc-900 rounded-lg font-mono text-xs border border-zinc-200 shadow-inner flex flex-col leading-tight print:mx-auto print:border-none print:bg-white"
            >
              {/* Draft preview watermark */}
              {!isReceiptSaved && (
                <div className="bg-amber-50 text-amber-900 text-[10px] font-bold p-1.5 text-center border-b border-dashed border-amber-200 mb-2 print:hidden rounded">
                  ⚠️ SYSTEM DRAFT - NOT COMMITTED TO RECORDS
                </div>
              )}
              {/* Receipt Header info */}
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-zinc-300">
                <h4 className="font-extrabold text-sm uppercase font-sans text-emerald-700 tracking-tight flex items-center justify-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 inline" />
                  {shopSettings.shopName}
                </h4>
                <p className="text-[10px] leading-relaxed text-zinc-600 font-medium">
                  {shopSettings.shopAddress}
                </p>
                <p className="text-[10px] text-zinc-500 font-medium">Tel: {shopSettings.shopPhone}</p>
                <p className="text-[10px] text-zinc-500 font-medium">KRA PIN: {shopSettings.taxRegistrationNumber}</p>
              </div>

              {/* Receipt metadata logs */}
              <div className="py-2.5 border-b border-dashed border-zinc-300 text-[10px] space-y-1 text-zinc-700">
                <div className="flex justify-between">
                  <span>RECEIPT NO:</span>
                  <span className="font-semibold">{completedSale.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE &amp; TIME:</span>
                  <span>{new Date(completedSale.dateAdded).toLocaleString('en-KE')}</span>
                </div>
                <div className="flex justify-between">
                  <span>CASHIER OPERATOR:</span>
                  <span className="uppercase">{completedSale.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>TERMINAL:</span>
                  <span>POS-01 (Offline-First)</span>
                </div>
              </div>

              {/* Items details table */}
              <div className="py-3 border-b border-dashed border-zinc-300">
                <div className="grid grid-cols-12 font-bold text-[10px] pb-1 border-b border-zinc-200 mb-1 text-zinc-800">
                  <span className="col-span-6">ITEM</span>
                  <span className="col-span-2 text-center">QTY</span>
                  <span className="col-span-4 text-right">TOTAL</span>
                </div>
                
                <div className="space-y-2 py-1 text-[10px] text-zinc-800">
                  {completedSale.items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 items-start">
                      <div className="col-span-6 leading-none">
                        <span className="uppercase font-semibold block">{it.name}</span>
                        <span className="text-[9px] text-zinc-500">{KES(it.sellingPrice)}</span>
                      </div>
                      <span className="col-span-2 text-center font-bold">x{it.quantity}</span>
                      <span className="col-span-4 text-right font-bold">{KES(it.sellingPrice * it.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipt Totals Summary Pane */}
              <div className="py-2.5 border-b border-dashed border-zinc-300 space-y-1 font-semibold text-[11px] text-zinc-900">
                <div className="flex justify-between text-[10px] text-zinc-500 font-normal">
                  <span>Subtotal:</span>
                  <span>{KES(completedSale.subtotal)}</span>
                </div>
                {completedSale.discount ? (
                  <div className="flex justify-between text-[11px] text-red-600 dark:text-red-400 font-bold">
                    <span>Discount:</span>
                    <span>-{KES(completedSale.discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-xs font-extrabold pt-1 border-t border-dotted border-zinc-200">
                  <span>GRAND TOTAL:</span>
                  <span>{KES(completedSale.total)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 font-normal">
                  <span>Tax (VAT 16% Inc):</span>
                  <span>{KES(completedSale.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-[10px] pt-1">
                  <span>PAYMENT METHOD:</span>
                  <span className="font-bold uppercase">{completedSale.paymentMethod}</span>
                </div>
                {completedSale.paymentMethod === 'Cash' ? (
                  <>
                    <div className="flex justify-between text-[10px] text-zinc-600">
                      <span>Amount Tendered:</span>
                      <span>{KES(completedSale.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-800 font-bold">
                      <span>Change Given:</span>
                      <span>{KES(completedSale.changeAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-[10px] text-zinc-700">
                    <span>Reference Record:</span>
                    <span className="font-mono">{completedSale.paymentDetailsRef}</span>
                  </div>
                )}
              </div>

              {/* Receipt Footer Message */}
              <div className="text-center pt-3 text-[10px] text-zinc-500 space-y-1">
                <p className="whitespace-pre-line leading-relaxed font-sans font-medium text-emerald-800">
                  {shopSettings.receiptHeader}
                </p>
                <p className="text-[9px] mt-1 text-zinc-400 font-sans">
                  {shopSettings.receiptFooter}
                </p>
                <p className="text-[7px] text-zinc-300 font-mono mt-3">
                  Powered by Mshiriki Systems Offline POS
                </p>
              </div>

            </div>

            {/* Receipt Modal actions */}
            <div className="mt-4 space-y-2 print:hidden font-sans" id="receipt-modal-actions">
              {/* Save to database button */}
              <button
                disabled={isReceiptSaved}
                onClick={handleSaveToDatabase}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition duration-150 ${
                  isReceiptSaved
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-dashed border-zinc-200 dark:border-zinc-700'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-[0.98]'
                }`}
              >
                <span>💾</span>
                {isReceiptSaved ? "Saved to Database records ✓" : "Save to Receipt Database (Commit)"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrintReceipt}
                  className="py-2.5 bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:shadow-xs transition duration-150 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </button>
                
                <button
                  onClick={() => generateReceiptPDF(completedSale, shopSettings)}
                  className="py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-zinc-900 border border-emerald-200 dark:border-zinc-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:shadow-xs transition duration-150 cursor-pointer"
                  title="Download High-Fidelity PDF Receipt"
                >
                  <FileText className="w-4 h-4" />
                  PDF Download
                </button>
              </div>

              {/* Raw JSON Download */}
              <button
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(completedSale, null, 2));
                  const dlAnchorElem = document.createElement('a');
                  dlAnchorElem.setAttribute("href",     dataStr     );
                  dlAnchorElem.setAttribute("download", `Receipt-${completedSale.receiptNumber}.json`);
                  dlAnchorElem.click();
                }}
                className="w-full py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-850 dark:hover:bg-zinc-750 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 text-[10px] rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                title="Download Sale JSON details"
              >
                <Download className="w-3.5 h-3.5" />
                Download Raw JSON Backup
              </button>
            </div>

            {/* Close trigger footer */}
            <div className="mt-3 text-center print:hidden">
              <button 
                onClick={handleCloseReceipt}
                className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:underline cursor-pointer"
              >
                Return to sales terminal (Esc)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
