import { User, Category, Product, Supplier, Sale, StockLog, AuditLog, ShopSettings } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_1',
    username: 'admin',
    fullName: 'Erick Omondi',
    email: 'admin@kenyapos.co.ke',
    role: 'admin',
    phone: '0712345678',
    active: true,
  },
  {
    id: 'usr_2',
    username: 'cashier',
    fullName: 'Jane Wambui',
    email: 'cashier@kenyapos.co.ke',
    role: 'cashier',
    phone: '0723456789',
    active: true,
  },
  {
    id: 'usr_3',
    username: 'mali',
    fullName: 'David Mwangi',
    email: 'mwangi@kenyapos.co.ke',
    role: 'cashier',
    phone: '0734567890',
    active: false,
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_1', name: 'Food Items', dateAdded: '2026-01-10T12:00:00Z', isCustom: false },
  { id: 'cat_2', name: 'Beverages', dateAdded: '2026-01-10T12:00:00Z', isCustom: false },
  { id: 'cat_3', name: 'Electronics', dateAdded: '2026-01-10T12:00:00Z', isCustom: false },
  { id: 'cat_4', name: 'Cosmetics', dateAdded: '2026-01-10T12:00:00Z', isCustom: false },
  { id: 'cat_5', name: 'Household Goods', dateAdded: '2026-01-15T12:00:00Z', isCustom: false },
  { id: 'cat_6', name: 'Hardware', dateAdded: '2026-01-15T12:00:00Z', isCustom: false },
  { id: 'cat_7', name: 'Stationery', dateAdded: '2026-01-20T12:00:00Z', isCustom: false },
  { id: 'cat_8', name: 'Medicine', dateAdded: '2026-01-20T12:00:00Z', isCustom: false },
  { id: 'cat_9', name: 'Fashion', dateAdded: '2026-01-22T12:00:00Z', isCustom: false }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_1',
    name: 'Bidco Africa Ltd',
    phone: '0700111222',
    email: 'info@bidcoafrica.com',
    location: 'Thika, Central Kenya',
    productsSupplied: ['cat_1', 'cat_4', 'cat_5']
  },
  {
    id: 'sup_2',
    name: 'East African Breweries Ltd (EABL)',
    phone: '0701222333',
    email: 'sales@eabl.com',
    location: 'Ruaraka, Nairobi',
    productsSupplied: ['cat_2']
  },
  {
    id: 'sup_3',
    name: 'Safaricom PLC Services',
    phone: '100',
    email: 'partners@safaricom.co.ke',
    location: 'Westlands, Nairobi',
    productsSupplied: ['cat_3']
  },
  {
    id: 'sup_4',
    name: 'Beta Healthcare Kenya',
    phone: '0722444555',
    email: 'info@betahealth.com',
    location: 'Industrial Area, Nairobi',
    productsSupplied: ['cat_8']
  },
  {
    id: 'sup_5',
    name: 'Bata Shoe Company Kenya',
    phone: '0733555666',
    email: 'care.bata@bata.com',
    location: 'Limuru, Kiambu',
    productsSupplied: ['cat_9']
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  // Food Items
  {
    id: 'prod_1',
    name: 'Unga wa Dola Wheat Flour 2kg',
    category: 'Food Items',
    barcode: '619112233440',
    buyingPrice: 160,
    sellingPrice: 195,
    quantityInStock: 45,
    supplierName: 'Bidco Africa Ltd',
    description: 'Premium sifted wheat flour ideal for baking and chapatis.',
    dateAdded: '2026-02-15T13:45:00Z',
    expiryDate: '2027-01-10'
  },
  {
    id: 'prod_2',
    name: 'Jogoo Maize Meal 2kg',
    category: 'Food Items',
    barcode: '619112233441',
    buyingPrice: 110,
    sellingPrice: 145,
    quantityInStock: 68,
    supplierName: 'Bidco Africa Ltd',
    description: 'Kenya\'s ultimate standard grade sifted maize meal for Ugali.',
    dateAdded: '2026-02-15T13:50:00Z',
    expiryDate: '2026-12-15'
  },
  {
    id: 'prod_3',
    name: 'Kabras Premium Sugar 1kg',
    category: 'Food Items',
    barcode: '619112233442',
    buyingPrice: 135,
    sellingPrice: 165,
    quantityInStock: 25,
    supplierName: 'Bidco Africa Ltd',
    description: 'Local milled sweet cane sugar.',
    dateAdded: '2026-03-01T09:00:00Z',
    expiryDate: '2026-06-25' // Nearing Expiry
  },
  {
    id: 'prod_4',
    name: 'Broadways White Bread 400g',
    category: 'Food Items',
    barcode: '619112233443',
    buyingPrice: 50,
    sellingPrice: 65,
    quantityInStock: 12,
    supplierName: 'Bidco Africa Ltd',
    description: 'Fresh baked daily bread.',
    dateAdded: '2026-06-01T06:00:00Z',
    expiryDate: '2026-06-05' // Expired!
  },

  // Beverages
  {
    id: 'prod_5',
    name: 'Tusker Lager Bottle 500ml',
    category: 'Beverages',
    barcode: '619112233444',
    buyingPrice: 180,
    sellingPrice: 240,
    quantityInStock: 120,
    supplierName: 'East African Breweries Ltd (EABL)',
    description: 'Famous premium lager brewed internationally since 1922.',
    dateAdded: '2026-02-10T11:20:00Z'
  },
  {
    id: 'prod_6',
    name: 'Safari Pure Tea 250g',
    category: 'Beverages',
    barcode: '619112233445',
    buyingPrice: 125,
    sellingPrice: 155,
    quantityInStock: 8, // Low stock
    supplierName: 'East African Breweries Ltd (EABL)',
    description: 'Handpicked Kenyan black tea leaves, full-bodied and robust.',
    dateAdded: '2026-03-02T10:15:00Z',
    expiryDate: '2028-02-15'
  },
  {
    id: 'prod_7',
    name: 'Keringet Mineral Water 1L',
    category: 'Beverages',
    barcode: '619112233446',
    buyingPrice: 60,
    sellingPrice: 90,
    quantityInStock: 50,
    supplierName: 'East African Breweries Ltd (EABL)',
    description: 'Natural pure spring water sourced from Molo Highlands.',
    dateAdded: '2026-04-10T08:30:00Z',
    expiryDate: '2027-04-10'
  },

  // Electronics
  {
    id: 'prod_8',
    name: 'Samsung Powerbank 10000mAh',
    category: 'Electronics',
    barcode: '8806090123512',
    buyingPrice: 1900,
    sellingPrice: 2500,
    quantityInStock: 4, // Low Stock
    supplierName: 'Safaricom PLC Services',
    description: 'Genuine fast charging dual-USB portable mobile battery pack.',
    dateAdded: '2026-01-20T15:22:00Z'
  },
  {
    id: 'prod_9',
    name: 'Safaricom 4G Wi-Fi Router',
    category: 'Electronics',
    barcode: '8806090123513',
    buyingPrice: 2900,
    sellingPrice: 3800,
    quantityInStock: 2, // Low stock
    supplierName: 'Safaricom PLC Services',
    description: 'Wireless pocket router with Sim Slot, high range 150Mbps.',
    dateAdded: '2026-02-01T10:00:00Z'
  },

  // Cosmetics
  {
    id: 'prod_10',
    name: 'Nice & Lovely Body Lotion 400ml',
    category: 'Cosmetics',
    barcode: '619112233451',
    buyingPrice: 260,
    sellingPrice: 320,
    quantityInStock: 30,
    supplierName: 'Bidco Africa Ltd',
    description: 'Skin nourishing herbal lotion with pure avocado oil.',
    dateAdded: '2026-03-12T14:40:00Z',
    expiryDate: '2028-09-30'
  },
  {
    id: 'prod_11',
    name: 'Dettol Soap Herbal 100g',
    category: 'Cosmetics',
    barcode: '619112233452',
    buyingPrice: 85,
    sellingPrice: 110,
    quantityInStock: 40,
    supplierName: 'Bidco Africa Ltd',
    description: 'Dermatologically tested antibacterial hand and body soap.',
    dateAdded: '2026-03-12T14:45:00Z',
    expiryDate: '2027-10-30'
  },

  // Household Goods
  {
    id: 'prod_12',
    name: 'Omo Hand Wash Powder 1kg',
    category: 'Household Goods',
    barcode: '619112233461',
    buyingPrice: 320,
    sellingPrice: 395,
    quantityInStock: 15,
    supplierName: 'Bidco Africa Ltd',
    description: 'Active dirt removal detergent powder.',
    dateAdded: '2026-04-15T11:00:00Z'
  },
  {
    id: 'prod_13',
    name: 'Sunlight Dishwashing Liquid 400ml',
    category: 'Household Goods',
    barcode: '619112233462',
    buyingPrice: 120,
    sellingPrice: 160,
    quantityInStock: 0, // Out of Stock
    supplierName: 'Bidco Africa Ltd',
    description: 'Real lemon grease cutter concentrate.',
    dateAdded: '2026-04-15T11:10:00Z'
  },

  // Hardware
  {
    id: 'prod_14',
    name: 'Yale Padlock 40mm Premium',
    category: 'Hardware',
    barcode: '501060901239',
    buyingPrice: 650,
    sellingPrice: 850,
    quantityInStock: 3, // Low stock
    supplierName: 'Bidco Africa Ltd',
    description: 'Heavy duty brass lock with hardened steel shackle.',
    dateAdded: '2026-01-18T16:00:00Z'
  },

  // Stationery
  {
    id: 'prod_15',
    name: 'Kasuku Exercise Book A5 120 Pages',
    category: 'Stationery',
    barcode: '619112233471',
    buyingPrice: 45,
    sellingPrice: 60,
    quantityInStock: 140,
    supplierName: 'Bidco Africa Ltd',
    description: 'Standard single ruled exercise notebook for primary and high school.',
    dateAdded: '2026-02-28T09:30:00Z'
  },

  // Medicine
  {
    id: 'prod_16',
    name: 'Panadol Extra Tablets (Pack of 20)',
    category: 'Medicine',
    barcode: '619112233481',
    buyingPrice: 120,
    sellingPrice: 180,
    quantityInStock: 18,
    supplierName: 'Beta Healthcare Kenya',
    description: 'Fast relief from mild to moderate body pain and fever.',
    dateAdded: '2026-03-05T10:00:00Z',
    expiryDate: '2026-06-20' // Nearing Expiry
  },
  {
    id: 'prod_17',
    name: 'Hedex Pain Reliever (Pack of 24)',
    category: 'Medicine',
    barcode: '619112233482',
    buyingPrice: 140,
    sellingPrice: 200,
    quantityInStock: 25,
    supplierName: 'Beta Healthcare Kenya',
    description: 'Rapid acting tablets containing Caffeine and Paracetamol.',
    dateAdded: '2026-03-05T10:10:00Z',
    expiryDate: '2026-05-15' // Expired!
  },

  // Fashion
  {
    id: 'prod_18',
    name: 'Bata Safari Boots Beige Size 42',
    category: 'Fashion',
    barcode: '619112233491',
    buyingPrice: 3200,
    sellingPrice: 4200,
    quantityInStock: 5,
    supplierName: 'Bata Shoe Company Kenya',
    description: 'Classic genuine suede leather desert boots made locally.',
    dateAdded: '2026-02-18T10:00:00Z'
  }
];

// Let's create beautiful historic Sales for reporting graphs
// We will mock sales for the current month (June 2026) and today (June 8, 2026)
export const INITIAL_SALES: Sale[] = [
  // Past sales over the last few days to populate daily analytics beautiful trends
  {
    id: 'sale_1',
    receiptNumber: 'KPOS-20260601-001',
    items: [
      { id: 'prod_1', name: 'Unga wa Dola Wheat Flour 2kg', quantity: 2, sellingPrice: 195, buyingPrice: 160 },
      { id: 'prod_2', name: 'Jogoo Maize Meal 2kg', quantity: 3, sellingPrice: 145, buyingPrice: 110 },
      { id: 'prod_7', name: 'Keringet Mineral Water 1L', quantity: 2, sellingPrice: 90, buyingPrice: 60 }
    ],
    subtotal: 1005,
    taxAmount: 160.8,
    total: 1005,
    paymentMethod: 'Cash',
    paidAmount: 1100,
    changeAmount: 95,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-01T14:30:00Z'
  },
  {
    id: 'sale_2',
    receiptNumber: 'KPOS-20260602-001',
    items: [
      { id: 'prod_18', name: 'Bata Safari Boots Beige Size 42', quantity: 1, sellingPrice: 4200, buyingPrice: 3200 },
      { id: 'prod_10', name: 'Nice & Lovely Body Lotion 400ml', quantity: 1, sellingPrice: 320, buyingPrice: 260 }
    ],
    subtotal: 4520,
    taxAmount: 723.2,
    total: 4520,
    paymentMethod: 'M-Pesa',
    paymentDetailsRef: 'RFF2MN679D',
    paidAmount: 4520,
    changeAmount: 0,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-02T11:15:00Z'
  },
  {
    id: 'sale_3',
    receiptNumber: 'KPOS-20260603-001',
    items: [
      { id: 'prod_9', name: 'Safaricom 4G Wi-Fi Router', quantity: 1, sellingPrice: 3800, buyingPrice: 2900 },
      { id: 'prod_8', name: 'Samsung Powerbank 10000mAh', quantity: 1, sellingPrice: 2500, buyingPrice: 1900 }
    ],
    subtotal: 6300,
    taxAmount: 1008,
    total: 6300,
    paymentMethod: 'Bank',
    paymentDetailsRef: 'BK-582914',
    paidAmount: 6300,
    changeAmount: 0,
    cashierId: 'usr_1',
    cashierName: 'Erick Omondi',
    dateAdded: '2026-06-03T16:45:00Z'
  },
  {
    id: 'sale_4',
    receiptNumber: 'KPOS-20260604-001',
    items: [
      { id: 'prod_15', name: 'Kasuku Exercise Book A5 120 Pages', quantity: 20, sellingPrice: 60, buyingPrice: 45 },
      { id: 'prod_11', name: 'Dettol Soap Herbal 100g', quantity: 4, sellingPrice: 110, buyingPrice: 85 }
    ],
    subtotal: 1640,
    taxAmount: 262.4,
    total: 1640,
    paymentMethod: 'M-Pesa',
    paymentDetailsRef: 'RFF4KJ910A',
    paidAmount: 1640,
    changeAmount: 0,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-04T10:20:00Z'
  },
  {
    id: 'sale_5',
    receiptNumber: 'KPOS-20260605-001',
    items: [
      { id: 'prod_2', name: 'Jogoo Maize Meal 2kg', quantity: 10, sellingPrice: 145, buyingPrice: 110 },
      { id: 'prod_3', name: 'Kabras Premium Sugar 1kg', quantity: 5, sellingPrice: 165, buyingPrice: 135 }
    ],
    subtotal: 2275,
    taxAmount: 364,
    total: 2275,
    paymentMethod: 'Cash',
    paidAmount: 2300,
    changeAmount: 25,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-05T15:10:00Z'
  },
  {
    id: 'sale_6',
    receiptNumber: 'KPOS-20260606-001',
    items: [
      { id: 'prod_12', name: 'Omo Hand Wash Powder 1kg', quantity: 2, sellingPrice: 395, buyingPrice: 320 },
      { id: 'prod_5', name: 'Tusker Lager Bottle 500ml', quantity: 6, sellingPrice: 240, buyingPrice: 180 }
    ],
    subtotal: 2230,
    taxAmount: 356.8,
    total: 2230,
    paymentMethod: 'M-Pesa',
    paymentDetailsRef: 'RFF6LK221B',
    paidAmount: 2230,
    changeAmount: 0,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-06T19:05:00Z'
  },
  {
    id: 'sale_7',
    receiptNumber: 'KPOS-20260607-001',
    items: [
      { id: 'prod_1', name: 'Unga wa Dola Wheat Flour 2kg', quantity: 4, sellingPrice: 195, buyingPrice: 160 },
      { id: 'prod_16', name: 'Panadol Extra Tablets (Pack of 20)', quantity: 2, sellingPrice: 180, buyingPrice: 120 }
    ],
    subtotal: 1140,
    taxAmount: 182.4,
    total: 1140,
    paymentMethod: 'Cash',
    paidAmount: 1200,
    changeAmount: 60,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-07T13:40:00Z'
  },

  // TODAY'S SALES (June 8, 2026) - Totals around 4,800 KES spread over a few transactions
  {
    id: 'sale_8',
    receiptNumber: 'KPOS-20260608-001',
    items: [
      { id: 'prod_1', name: 'Unga wa Dola Wheat Flour 2kg', quantity: 2, sellingPrice: 195, buyingPrice: 160 },
      { id: 'prod_2', name: 'Jogoo Maize Meal 2kg', quantity: 2, sellingPrice: 145, buyingPrice: 110 },
      { id: 'prod_6', name: 'Safari Pure Tea 250g', quantity: 1, sellingPrice: 155, buyingPrice: 125 }
    ],
    subtotal: 835,
    taxAmount: 133.6,
    total: 835,
    paymentMethod: 'M-Pesa',
    paymentDetailsRef: 'RFG8AS990Q',
    paidAmount: 835,
    changeAmount: 0,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-08T07:15:00Z'
  },
  {
    id: 'sale_9',
    receiptNumber: 'KPOS-20260608-002',
    items: [
      { id: 'prod_14', name: 'Yale Padlock 40mm Premium', quantity: 1, sellingPrice: 850, buyingPrice: 650 },
      { id: 'prod_12', name: 'Omo Hand Wash Powder 1kg', quantity: 1, sellingPrice: 395, buyingPrice: 320 }
    ],
    subtotal: 1245,
    taxAmount: 199.2,
    total: 1245,
    paymentMethod: 'Cash',
    paidAmount: 1500,
    changeAmount: 255,
    cashierId: 'usr_2',
    cashierName: 'Jane Wambui',
    dateAdded: '2026-06-08T08:40:00Z'
  },
  {
    id: 'sale_10',
    receiptNumber: 'KPOS-20260608-003',
    items: [
      { id: 'prod_5', name: 'Tusker Lager Bottle 500ml', quantity: 12, sellingPrice: 240, buyingPrice: 180 }
    ],
    subtotal: 2880,
    taxAmount: 460.8,
    total: 2880,
    paymentMethod: 'Bank',
    paymentDetailsRef: 'BK-092551',
    paidAmount: 2880,
    changeAmount: 0,
    cashierId: 'usr_1',
    cashierName: 'Erick Omondi',
    dateAdded: '2026-06-08T09:20:00Z'
  }
];

export const INITIAL_STOCK_LOGS: StockLog[] = [
  {
    id: 'log_1',
    productId: 'prod_1',
    productName: 'Unga wa Dola Wheat Flour 2kg',
    changeQty: 50,
    type: 'initial',
    timestamp: '2026-02-15T13:45:00Z',
    operatorName: 'Erick Omondi'
  },
  {
    id: 'log_2',
    productId: 'prod_2',
    productName: 'Jogoo Maize Meal 2kg',
    changeQty: 80,
    type: 'initial',
    timestamp: '2026-02-15T13:50:00Z',
    operatorName: 'Erick Omondi'
  },
  {
    id: 'log_3',
    productId: 'prod_13',
    productName: 'Sunlight Dishwashing Liquid 400ml',
    changeQty: 5,
    type: 'initial',
    timestamp: '2026-04-15T11:10:00Z',
    operatorName: 'Erick Omondi'
  },
  {
    id: 'log_4',
    productId: 'prod_13',
    productName: 'Sunlight Dishwashing Liquid 400ml',
    changeQty: -5,
    type: 'discard_expired',
    timestamp: '2026-06-06T10:00:00Z',
    operatorName: 'Erick Omondi',
    notes: 'Discarded damaged and leaking bottles.'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_1',
    userId: 'usr_1',
    userName: 'Erick Omondi',
    action: 'System Initialized',
    details: 'Kenyan Retail Shop POS populated with original seed products and configurations.',
    timestamp: '2026-06-08T06:00:00Z'
  },
  {
    id: 'aud_2',
    userId: 'usr_2',
    userName: 'Jane Wambui',
    action: 'User Login',
    details: 'Cashier Jane Wambui successfully authenticated on Terminal 1.',
    timestamp: '2026-06-08T07:00:00Z'
  },
  {
    id: 'aud_3',
    userId: 'usr_2',
    userName: 'Jane Wambui',
    action: 'Complete Sale',
    details: 'Completed Sale receipt KPOS-20260608-001 worth KES 835 via M-Pesa.',
    timestamp: '2026-06-08T07:15:00Z'
  }
];

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shopName: 'Mshiriki Super Dufuka Ltd',
  shopAddress: 'Biashara Street, Highway Mall Ground Floor, Shop G12, Nairobi',
  shopPhone: '+254 712 345 678 / +254 20 2345678',
  tillNumber: '5046291',
  paybillNumber: '247247',
  taxRegistrationNumber: 'P051289456Z',
  receiptHeader: 'ASANTE KWA KUSHOP NASI!\nWELCOME BACK AGAIN',
  receiptFooter: 'Goods once sold are not returnable.\nPreserve your receipt for reference.'
};

export const INITIAL_EXPENSES = [
  {
    id: 'exp_1',
    category: 'Internet & WiFi Support',
    itemName: 'Safaricom Fibre 30Mbps Office Subscription',
    amount: 5000,
    date: '2026-06-05',
    notes: 'Primary backoffice routing and payment gateway internet wifi bills paid.',
    recordedBy: 'Erick Omondi',
    timestamp: '2026-06-05T09:30:00Z'
  },
  {
    id: 'exp_2',
    category: 'Delivery & Logistics Logistics',
    itemName: 'Nairobi CBD Courier dispatch riders',
    amount: 1200,
    date: '2026-06-06',
    notes: 'Delivery fee for bulk detergents to retail distributors.',
    recordedBy: 'Erick Omondi',
    timestamp: '2026-06-06T14:15:00Z'
  },
  {
    id: 'exp_3',
    category: 'Power & Water Utility Bills',
    itemName: 'Kenya Power Prepaid Token Purchase',
    amount: 3500,
    date: '2026-06-08',
    notes: 'Power backup prepaid units allocated to electricity meter.',
    recordedBy: 'Erick Omondi',
    timestamp: '2026-06-08T11:00:00Z'
  }
];

