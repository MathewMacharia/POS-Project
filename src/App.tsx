import React, { useState, useEffect, useCallback, useMemo } from 'react';
import bcrypt from 'bcryptjs';
import { 
  Building, 
  Coins, 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  Activity, 
  Users, 
  ShieldCheck, 
  LogOut, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  ChevronLeft,
  ChevronRight,
  Bell, 
  Clock, 
  Download, 
  Upload, 
  Database,
  Lock,
  Eye,
  EyeOff,
  Wrench,
  HelpCircle,
  Sparkles,
  Wifi,
  ShoppingBag,
  Key,
  FileText,
  AlertTriangle,
  RotateCcw,
  Save
} from 'lucide-react';

// Imports from components & seed data
import { 
  User, 
  Category, 
  Product, 
  Sale, 
  Supplier, 
  StockLog, 
  AuditLog, 
  ShopSettings,
  SaleItem,
  Expense
} from './types';

import { 
  DEFAULT_SHOP_SETTINGS
} from './data/seedData';

import { generateDatabasePDF } from './utils/pdfGenerator';

import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import Stocks from './components/Stocks';
import UsersComponent from './components/Users';
import AuditLogs from './components/AuditLogs';
import Expenses from './components/Expenses';

// Supabase DB Client & Model Mappers & Offline Sync System
import { 
  supabase, 
  mapProfile, toDbProfile,
  mapCategory, 
  mapProduct, toDbProduct,
  mapSale, toDbSale,
  mapExpense, toDbExpense,
  mapAuditLog, toDbAuditLog,
  mapSupplier, toDbSupplier,
  mapStockLog, toDbStockLog,
  getLocalCache, setLocalCache, db,
  queueAction, triggerSync, mergeRemoteWithSyncQueue,
  apiFetch
} from './utils/supabaseClient';

function NairobiClock() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setTime(new Date().toLocaleTimeString('en-US', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>Nairobi: {time || '09:54 AM'}</span>;
}

// Helper functions for secure offline authentication using Web Crypto API
// Key derivation: PBKDF2 with 10,000 iterations (trade-off accepted for supervised till terminals)
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_HASH = 'SHA-256';
const AES_GCM_ALGO = 'AES-GCM';

// Helper to convert base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to convert ArrayBuffer to base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Derive AES-GCM key from plaintext PIN using PBKDF2
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // NOTE: Using 10,000 iterations is a deliberate, known trade-off for speed/performance 
  // on low-power till hardware in supervised environments. This should be increased (e.g. to 600,000+)
  // if deployed in unsupervised or higher-threat physical locations.
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH
    },
    baseKey,
    { name: AES_GCM_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt payload using AES-GCM and derived key from PIN
async function encryptProfileData(profile: any, pin: string): Promise<{ encryptedPayload: string, salt: string, iv: string }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPin(pin, salt);

  const encoder = new TextEncoder();
  const payload = {
    profile,
    marker: 'pos-auth-success',
    cachedAt: Date.now()
  };
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: AES_GCM_ALGO,
      iv
    },
    key,
    encoder.encode(JSON.stringify(payload))
  );

  return {
    encryptedPayload: bufferToBase64(encrypted),
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer)
  };
}

// Decrypt payload using AES-GCM and derived key from PIN
async function decryptProfileData(encryptedPayload: string, salt: string, iv: string, pin: string): Promise<any> {
  const saltBuffer = base64ToBuffer(salt);
  const ivBuffer = base64ToBuffer(iv);
  const payloadBuffer = base64ToBuffer(encryptedPayload);

  const key = await deriveKeyFromPin(pin, new Uint8Array(saltBuffer));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: AES_GCM_ALGO,
      iv: new Uint8Array(ivBuffer)
    },
    key,
    payloadBuffer
  );

  const decoder = new TextDecoder();
  const decryptedObj = JSON.parse(decoder.decode(decryptedBuffer));

  if (decryptedObj.marker !== 'pos-auth-success') {
    throw new Error('Authentication validation marker mismatch.');
  }

  // Enforce a strict 7-day expiration limit on cached offline credentials
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - decryptedObj.cachedAt > SEVEN_DAYS_MS) {
    throw new Error('Offline credentials have expired (exceeded 7 days limit).');
  }

  return decryptedObj.profile;
}

export default function App() {
  // ----- 1. SHARED STATE FROM SUPABASE & LOCALSTORAGE FOR UI PREFS -----
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dufuka_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.fullName === 'Erick Omondi' || parsed.fullName === 'Erick oMONDI' || parsed.fullName === 'Erick')) {
          parsed.fullName = 'admin';
          localStorage.setItem('dufuka_current_user', JSON.stringify(parsed));
        }
        return parsed;
      } catch {}
    }
    return null;
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [shopSettings, setShopSettings] = useState<ShopSettings>(() => {
    const saved = localStorage.getItem('dufuka_shop_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SHOP_SETTINGS;
  });
  const [formSettings, setFormSettings] = useState<ShopSettings>(shopSettings);
  useEffect(() => {
    setFormSettings(shopSettings);
  }, [shopSettings]);
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    return localStorage.getItem('dufuka_gemini_api_key') || '';
  });
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('dufuka_dark_mode') === 'true';
  });

  // UI Flow states
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedTab = localStorage.getItem('dufuka_active_tab') || 'dashboard';
    const savedUserStr = localStorage.getItem('dufuka_current_user');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        if (savedUser.role === 'cashier') {
          return (savedTab === 'pos' || savedTab === 'stock') ? savedTab : 'pos';
        }
      } catch {}
    }
    return savedTab;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dufuka_sidebar_collapsed') === 'true';
  });
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Login inputs states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // PIN change states
  const [showChangeDefaultPin, setShowChangeDefaultPin] = useState(false);
  const [pinChangeUsername, setPinChangeUsername] = useState('admin');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // ----- 2. LOAD DATA FROM SUPABASE ON MOUNT WITH OFFLINE CACHE -----
  const loadData = useCallback(async () => {
    // Load from local cache immediately so app starts instantly (even offline)
    const [u, c, p, s, e, al, sup, sl] = await Promise.all([
      getLocalCache('profiles'),
      getLocalCache('categories'),
      getLocalCache('products'),
      getLocalCache('sales'),
      getLocalCache('expenses'),
      getLocalCache('audit_logs'),
      getLocalCache('suppliers'),
      getLocalCache('stock_logs')
    ]);

    const sanitizedCached = u.map(profile => {
      if (profile.username === 'admin' && (profile.full_name === 'Erick Omondi' || profile.full_name === 'Erick oMONDI' || profile.fullName === 'Erick Omondi' || profile.full_name === 'Erick')) {
        profile.full_name = 'admin';
        profile.fullName = 'admin';
      }
      return profile;
    });
    setUsers(sanitizedCached.map(mapProfile));
    setCategories(c.map(mapCategory));
    setProducts(p.map(mapProduct));
    setSales(s.map(mapSale));
    setExpenses(e.map(mapExpense));
    setAuditLogs(al.map(mapAuditLog));
    setSuppliers(sup.map(mapSupplier));
    setStockLogs(sl.map(mapStockLog));

    if (!navigator.onLine) return;

    try {
      // Trigger and await sync for any unsynced offline changes first
      await triggerSync();

      // Fetch public tables (categories and products) directly via Supabase (since select policy is open to all)
      const { data: categoriesData } = await supabase.from('categories').select('*');
      if (categoriesData) {
        const merged = mergeRemoteWithSyncQueue('categories', categoriesData);
        setCategories(merged.map(mapCategory));
        setLocalCache('categories', merged);
      }

      const { data: productsData } = await supabase.from('products').select('*');
      if (productsData) {
        const merged = mergeRemoteWithSyncQueue('products', productsData);
        setProducts(merged.map(mapProduct));
        await setLocalCache('products', merged);
      }

      // Fetch role-scoped tables via authenticated REST endpoints
      if (currentUser) {
        if (currentUser.role === 'admin') {
          // Fetch profiles
          const profilesData = await apiFetch('/api/profiles');
          if (profilesData) {
            const merged = mergeRemoteWithSyncQueue('profiles', profilesData);
            const sanitized = merged.map((p: any) => {
              if (p.username === 'admin' && (p.full_name === 'Erick Omondi' || p.full_name === 'Erick oMONDI' || p.full_name === 'Erick')) {
                p.full_name = 'admin';
              }
              return p;
            });
            setUsers(sanitized.map(mapProfile));
            setLocalCache('profiles', sanitized);
          }

          // Fetch sales
          const salesData = await apiFetch('/api/sales');
          if (salesData) {
            const merged = mergeRemoteWithSyncQueue('sales', salesData);
            setSales(merged.map(mapSale));
            setLocalCache('sales', merged);
          }

          // Fetch expenses
          const expensesData = await apiFetch('/api/expenses');
          if (expensesData) {
            const merged = mergeRemoteWithSyncQueue('expenses', expensesData);
            setExpenses(merged.map(mapExpense));
            setLocalCache('expenses', merged);
          }

          // Fetch audit logs
          const auditData = await apiFetch('/api/audit-logs');
          if (auditData) {
            const merged = mergeRemoteWithSyncQueue('audit_logs', auditData);
            setAuditLogs(merged.map(mapAuditLog));
            setLocalCache('audit_logs', merged);
          }

          // Fetch suppliers
          const suppliersData = await apiFetch('/api/suppliers');
          if (suppliersData) {
            const merged = mergeRemoteWithSyncQueue('suppliers', suppliersData);
            setSuppliers(merged.map(mapSupplier));
            setLocalCache('suppliers', merged);
          }

          // Fetch stock logs
          const stockLogsData = await apiFetch('/api/stock-logs');
          if (stockLogsData) {
            const merged = mergeRemoteWithSyncQueue('stock_logs', stockLogsData);
            setStockLogs(merged.map(mapStockLog));
            setLocalCache('stock_logs', merged);
          }
        } else if (currentUser.role === 'cashier') {
          // Cashier scopes: only fetch today's own sales and today's stock logs
          const salesData = await apiFetch('/api/sales');
          if (salesData) {
            const merged = mergeRemoteWithSyncQueue('sales', salesData);
            setSales(merged.map(mapSale));
            setLocalCache('sales', merged);
          }

          const stockLogsData = await apiFetch('/api/stock-logs');
          if (stockLogsData) {
            const merged = mergeRemoteWithSyncQueue('stock_logs', stockLogsData);
            setStockLogs(merged.map(mapStockLog));
            setLocalCache('stock_logs', merged);
          }

          // Clear admin-only state data from memory to prevent caching mixups
          setUsers([currentUser]);
          setExpenses([]);
          setAuditLogs([]);
          setSuppliers([]);
        }
      } else {
        // If not logged in, clear authenticated state lists
        setUsers([]);
        setSales([]);
        setExpenses([]);
        setAuditLogs([]);
        setSuppliers([]);
        setStockLogs([]);
      }
    } catch (err) {
      console.error("Error loading data from server/Supabase:", err);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();

    // Sync listener when device comes back online
    const handleOnline = () => {
      console.log("Device is back online! Triggering sync...");
      loadData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadData]);

  // UI preferences persistence
  useEffect(() => {
    localStorage.setItem('dufuka_dark_mode', darkMode.toString());
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('dufuka_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('dufuka_sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // Keyboard Shortcuts Handler: (F2 to open Sales checkout, Esc to dismiss menus)
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (currentUser) {
        if (e.key === 'F2') {
          e.preventDefault();
          setActiveTab('pos');
        }
        if (e.key === 'Escape') {
          setIsSidebarOpen(false);
          setIsNotifOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [currentUser]);

  // Append new audit trace logs
  const addAuditLog = useCallback(async (action: string, details: string) => {
    const id = crypto.randomUUID();
    const newLog: AuditLog = {
      id,
      userId: currentUser?.id || 'anonymous',
      userName: currentUser?.fullName || 'System Guest',
      action,
      details,
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => {
      const updated = [...prev, newLog];
      setLocalCache('audit_logs', updated.map(toDbAuditLog));
      return updated;
    });
    // Audit logs are generated server-side on API writes to prevent client tampering.
  }, [currentUser]);

  // ----- 3. LOGIN / OVERRIDE CREDENTIAL CHECKS -----
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginUsername.trim()) {
      setLoginError('Kindly enter your username name.');
      return;
    }

    const usernameLower = loginUsername.trim().toLowerCase();

    try {
      if (navigator.onLine) {
        // Online login: Authenticate via server-side secure route
        const resp = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: usernameLower,
            pin: loginPassword
          })
        });

        const data = await resp.json();

        if (!resp.ok) {
          setLoginError(data.error || "Invalid username or PIN.");
          return;
        }

        const { token, user } = data;
        setCurrentUser(user);
        localStorage.setItem('dufuka_current_user', JSON.stringify(user));
        localStorage.setItem('dufuka_auth_token', token);

        // Cache credentials securely for offline verification using PIN-derived key encryption
        try {
          const encryptedData = await encryptProfileData(user, loginPassword);
          const cachedProfiles = await getLocalCache('profiles');
          const filtered = cachedProfiles.filter(p => p.username.toLowerCase() !== usernameLower);
          
          filtered.push({
            id: user.id,
            username: user.username,
            full_name: user.fullName,
            email: user.email,
            role: user.role,
            phone: user.phone,
            active: user.active,
            salt: encryptedData.salt,
            iv: encryptedData.iv,
            encryptedPayload: encryptedData.encryptedPayload
          });

          await setLocalCache('profiles', filtered);
          setUsers(filtered.map(mapProfile));
        } catch (cryptoErr) {
          console.error("Failed to securely cache offline credentials:", cryptoErr);
        }

        const msg = `Operator ${user.fullName} successfully logged into ${user.role === 'admin' ? 'administrator' : 'cashier terminal'} desk.`;
        
        const newAuditLog: AuditLog = {
          id: crypto.randomUUID(),
          userId: user.id,
          userName: user.fullName,
          action: 'User Login',
          details: msg,
          timestamp: new Date().toISOString()
        };
        
        setAuditLogs(prev => {
          const updated = [...prev, newAuditLog];
          setLocalCache('audit_logs', updated.map(toDbAuditLog));
          return updated;
        });

        if (user.role === 'admin') {
          setActiveTab('dashboard');
        } else {
          setActiveTab('pos');
        }

        // Check for first-time login passcode change
        if (user.username === 'admin' && loginPassword === '1234') {
          setPinChangeUsername('admin');
          setShowChangeDefaultPin(true);
          return;
        }

        setLoginUsername('');
        setLoginPassword('');
      } else {
        // Offline login: Read credentials from offline cached profiles in Dexie
        const cachedProfiles = await getLocalCache('profiles');
        const cachedUser = cachedProfiles.find(p => p.username.toLowerCase() === usernameLower);

        if (!cachedUser) {
          setLoginError('No offline credentials found. Please log in online at least once to enable offline access on this device.');
          return;
        }

        if (!cachedUser.active) {
          setLoginError('Account status is locked. Kindly contact Supervisor / Admin.');
          return;
        }

        try {
          // Decrypt user profile using the entered PIN
          const decryptedProfile = await decryptProfileData(
            cachedUser.encryptedPayload,
            cachedUser.salt,
            cachedUser.iv,
            loginPassword
          );

          setCurrentUser(decryptedProfile);
          localStorage.setItem('dufuka_current_user', JSON.stringify(decryptedProfile));
          
          const msg = `Operator ${decryptedProfile.fullName} successfully logged in offline to ${decryptedProfile.role === 'admin' ? 'administrator' : 'cashier terminal'} desk.`;
          
          const newAuditLog: AuditLog = {
            id: crypto.randomUUID(),
            userId: decryptedProfile.id,
            userName: decryptedProfile.fullName,
            action: 'User Login Offline',
            details: msg,
            timestamp: new Date().toISOString()
          };
          
          setAuditLogs(prev => {
            const updated = [...prev, newAuditLog];
            setLocalCache('audit_logs', updated.map(toDbAuditLog));
            return updated;
          });

          if (decryptedProfile.role === 'admin') {
            setActiveTab('dashboard');
          } else {
            setActiveTab('pos');
          }

          // Check for first-time login passcode change
          if (decryptedProfile.username === 'admin' && loginPassword === '1234') {
            setPinChangeUsername('admin');
            setShowChangeDefaultPin(true);
            return;
          }

          setLoginUsername('');
          setLoginPassword('');
        } catch (decryptErr: any) {
          console.warn("Offline login failed during decryption:", decryptErr);
          setLoginError('Incorrect PIN passcode entered or credentials expired.');
        }
      }
    } catch (err: any) {
      setLoginError('Authentication error: ' + err.message);
    }
  };

  const handlePinChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError('');

    if (!newPin.trim()) {
      setPinChangeError('PIN passcode cannot be empty.');
      return;
    }

    if (newPin !== confirmNewPin) {
      setPinChangeError('PIN codes do not match. Please verify.');
      return;
    }

    if (newPin === '1234') {
      setPinChangeError('You must choose a passcode different from the default "1234".');
      return;
    }

    try {
      const hashedPin = bcrypt.hashSync(newPin.trim(), 10);
      if (navigator.onLine) {
        const { error } = await supabase
          .from('profiles')
          .update({ pin: hashedPin })
          .eq('username', pinChangeUsername);
        
        if (error) throw error;
      } else {
        const cached = await getLocalCache('profiles');
        const userProf = cached.find(p => p.username === pinChangeUsername);
        if (userProf) {
          queueAction('update', 'profiles', { pin: hashedPin }, userProf.id);
        }
      }

      const cachedProfiles = await getLocalCache('profiles');
      const updated = cachedProfiles.map(p => {
        if (p.username === pinChangeUsername) {
          return { ...p, pin: hashedPin };
        }
        return p;
      });
      await setLocalCache('profiles', updated);
      setUsers(updated.map(mapProfile));

      await addAuditLog('Passcode Changed', `Operator ${pinChangeUsername} passcode updated from default value.`);

      alert('Admin passcode updated successfully! Please log in with your new PIN.');
      
      setShowChangeDefaultPin(false);
      setNewPin('');
      setConfirmNewPin('');
      setLoginPassword('');
    } catch (err: any) {
      setPinChangeError('Failed to update passcode: ' + err.message);
    }
  };

  const handleLogout = () => {
    addAuditLog('User Logout', `Operator logged out safely.`);
    setCurrentUser(null);
    localStorage.removeItem('dufuka_current_user');
    localStorage.removeItem('dufuka_active_tab');
    localStorage.removeItem('dufuka_auth_token');
  };

  // ----- 4. CORE POS ACTION: CHECKOUT TRIGGER -----
  const handleAddSaleSession = useCallback(async (
    cartItems: SaleItem[],
    paymentMethod: 'Cash' | 'M-Pesa' | 'Bank',
    paymentRef: string,
    paidAmount: number,
    changeAmount: number,
    discountAmount: number = 0
  ) => {
    const todayObj = new Date();
    const yyyy = todayObj.getFullYear();
    const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
    const dd = String(todayObj.getDate()).padStart(2, '0');
    
    const todayISO = todayObj.toISOString();
    const receiptNo = `KPOS-${yyyy}${mm}${dd}-${Math.floor(Math.random() * 900 + 100)}`;
    const saleId = crypto.randomUUID();

    const subtotal = cartItems.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const taxAmount = Math.round(Math.max(0, subtotal - discountAmount) * 0.16);

    const newSale: Sale = {
      id: saleId,
      receiptNumber: receiptNo,
      items: cartItems,
      subtotal,
      taxAmount,
      total: Math.max(0, subtotal - discountAmount),
      discount: discountAmount,
      paymentMethod,
      paymentDetailsRef: paymentRef,
      paidAmount,
      changeAmount,
      cashierId: currentUser?.id || 'usr_unknown',
      cashierName: currentUser?.fullName || 'Cashier',
      dateAdded: todayISO
    };

    try {
      // 1. Save Sale locally
      setSales(prev => {
        const updated = [...prev, newSale];
        setLocalCache('sales', updated.map(toDbSale));
        return updated;
      });

      // 2. Reduce products stock quantities locally
      const updatedProducts = products.map(p => {
        const cartMatch = cartItems.find(item => item.id === p.id);
        if (cartMatch) {
          const newQty = Math.max(0, p.quantityInStock - cartMatch.quantity);
          return { ...p, quantityInStock: newQty };
        }
        return p;
      });
      setProducts(updatedProducts);
      setLocalCache('products', updatedProducts.map(toDbProduct));

      // 3. Append to stock movement logs locally
      const newStockLogsToSave: StockLog[] = [];
      for (const item of cartItems) {
        const logId = crypto.randomUUID();
        const newStockLog: StockLog = {
          id: logId,
          productId: item.id,
          productName: item.name,
          changeQty: -item.quantity,
          type: 'sale',
          timestamp: todayISO,
          operatorName: currentUser?.fullName || 'System',
          notes: `Sold via checkout receipt ${receiptNo}`
        };
        newStockLogsToSave.push(newStockLog);
      }

      setStockLogs(prev => {
        const updated = [...prev, ...newStockLogsToSave];
        setLocalCache('stock_logs', updated.map(toDbStockLog));
        return updated;
      });

      // 4. Queue the sale insert (this will trigger triggerSync() for the whole batch which updates stocks server-side)
      queueAction('insert', 'sales', toDbSale(newSale));

      // 5. Attach Security Audit Trail
      addAuditLog('Complete Sale', `Completed Checkout receipt ${receiptNo} worth KES ${subtotal} via ${paymentMethod}.`);

      return newSale;
    } catch (err: any) {
      alert("Checkout failed: " + err.message);
      return null;
    }
  }, [currentUser, products, addAuditLog]);

  const handleRegisterProduct = async (newProd: Omit<Product, 'id' | 'dateAdded'>) => {
    const timestampISO = new Date().toISOString();
    const productId = crypto.randomUUID();
    const productItem: Product = {
      ...newProd,
      id: productId,
      dateAdded: timestampISO
    };
    
    try {
      if (navigator.onLine) {
        // Online: directly persist via authenticated API route (uses service role key)
        const savedProduct = await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            id: productId,
            name: productItem.name,
            category: productItem.category,
            barcode: productItem.barcode,
            buyingPrice: productItem.buyingPrice,
            sellingPrice: productItem.sellingPrice,
            quantityInStock: productItem.quantityInStock,
            supplierName: productItem.supplierName,
            description: productItem.description,
            imageUrl: productItem.imageUrl,
            expiryDate: productItem.expiryDate
          })
        });

        // Use server-confirmed data to update state
        const confirmedProduct = mapProduct(savedProduct);
        setProducts(prev => {
          const updated = [...prev, confirmedProduct];
          setLocalCache('products', updated.map(toDbProduct));
          return updated;
        });
      } else {
        // Offline: update local state and queue for later sync
        setProducts(prev => {
          const updated = [...prev, productItem];
          setLocalCache('products', updated.map(toDbProduct));
          return updated;
        });
        queueAction('insert', 'products', toDbProduct(productItem));
      }

      // Add stock logarithm for traceability audit
      const stockLogId = crypto.randomUUID();
      const newStockLog: StockLog = {
        id: stockLogId,
        productId,
        productName: productItem.name,
        changeQty: productItem.quantityInStock,
        type: 'initial',
        timestamp: timestampISO,
        operatorName: currentUser?.fullName || 'Admin',
        notes: `Registered new catalog item with baseline quantities.`
      };

      setStockLogs(prev => {
        const updated = [...prev, newStockLog];
        setLocalCache('stock_logs', updated.map(toDbStockLog));
        return updated;
      });
      queueAction('insert', 'stock_logs', toDbStockLog(newStockLog));

      addAuditLog('Create Product', `Registered fresh product ${productItem.name} @ KES ${productItem.sellingPrice}.`);
    } catch (err: any) {
      alert("Product registration failed: " + err.message);
    }
  };



  const handleModifyProduct = async (updatedProd: Product) => {
    try {
      setProducts(prev => {
        const updated = prev.map(p => p.id === updatedProd.id ? updatedProd : p);
        setLocalCache('products', updated.map(toDbProduct));
        return updated;
      });
      queueAction('update', 'products', toDbProduct(updatedProd), updatedProd.id);
      addAuditLog('Update Product', `Modified product profiles of "${updatedProd.name}".`);
    } catch (err: any) {
      alert("Modification failed: " + err.message);
    }
  };

  const handleDeleteProduct = async (prodId: string) => {
    const prodMatch = products.find(p => p.id === prodId);
    try {
      setProducts(prev => {
        const updated = prev.filter(p => p.id !== prodId);
        setLocalCache('products', updated.map(toDbProduct));
        return updated;
      });
      queueAction('delete', 'products', null, prodId);
      addAuditLog('Delete Product', `Permanently deleted catalog key "${prodMatch?.name || prodId}" from shelves.`);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleRegisterCategory = async (categoryName: string) => {
    const categoryId = crypto.randomUUID();
    const dateAdded = new Date().toISOString();
    const newCat: Category = {
      id: categoryId,
      name: categoryName,
      isCustom: true,
      dateAdded
    };

    try {
      setCategories(prev => {
        const updated = [...prev, newCat];
        setLocalCache('categories', updated.map(c => ({ id: c.id, name: c.name, is_custom: c.isCustom, date_added: c.dateAdded })));
        return updated;
      });
      queueAction('insert', 'categories', { id: categoryId, name: categoryName, is_custom: true, date_added: dateAdded });
      addAuditLog('Create Category', `Created custom visual category filter "${categoryName}".`);
    } catch (err: any) {
      alert("Category creation failed: " + err.message);
    }
  };

  // Restock action incrementor from monitoring screen
  const handleRestockProductSelection = async (productId: string, restockQty: number, notes: string, expiryDate?: string) => {
    const todayISO = new Date().toISOString();
    const pMatch = products.find(p => p.id === productId);
    if (!pMatch) return;

    try {
      if (pMatch.expiryDate) {
        // Create a separate new batch product line
        const newProductId = crypto.randomUUID();
        const newProductItem: Product = {
          ...pMatch,
          id: newProductId,
          quantityInStock: restockQty,
          expiryDate: expiryDate || pMatch.expiryDate,
          dateAdded: todayISO
        };

        setProducts(prev => {
          const updated = [...prev, newProductItem];
          setLocalCache('products', updated.map(toDbProduct));
          return updated;
        });
        queueAction('insert', 'products', toDbProduct(newProductItem));

        const logId = crypto.randomUUID();
        const log: StockLog = {
          id: logId,
          productId: newProductId,
          productName: pMatch.name,
          changeQty: restockQty,
          type: 'initial',
          timestamp: todayISO,
          operatorName: currentUser?.fullName || 'Admin',
          notes: `Separate batch restocked (Expiry: ${newProductItem.expiryDate}). ${notes}`
        };

        setStockLogs(prev => {
          const updated = [...prev, log];
          setLocalCache('stock_logs', updated.map(toDbStockLog));
          return updated;
        });
        queueAction('insert', 'stock_logs', toDbStockLog(log));

        addAuditLog('Restock New Batch', `Created new product batch line for "${pMatch.name}" with +${restockQty} units expiring on ${newProductItem.expiryDate}.`);
      } else {
        // Standard in-place restock for non-expiring products
        const newQty = pMatch.quantityInStock + restockQty;

        setProducts(prev => {
          const updated = prev.map(p => p.id === productId ? {
            ...p,
            quantityInStock: newQty,
            expiryDate: expiryDate ? expiryDate : p.expiryDate
          } : p);
          setLocalCache('products', updated.map(toDbProduct));
          return updated;
        });

        queueAction('update', 'products', { 
          quantity_in_stock: newQty,
          ...(expiryDate ? { expiry_date: expiryDate } : {})
        }, productId);

        const logId = crypto.randomUUID();
        const log: StockLog = {
          id: logId,
          productId,
          productName: pMatch.name,
          changeQty: restockQty,
          type: 'restock',
          timestamp: todayISO,
          operatorName: currentUser?.fullName || 'Admin',
          notes: expiryDate ? `${notes} (Expiry: ${expiryDate})` : notes
        };

        setStockLogs(prev => {
          const updated = [...prev, log];
          setLocalCache('stock_logs', updated.map(toDbStockLog));
          return updated;
        });
        queueAction('insert', 'stock_logs', toDbStockLog(log));

        addAuditLog('Restock Product', `Incremented inventory of "${pMatch.name}" by +${restockQty} units.${expiryDate ? ` New expiry date keyed in: ${expiryDate}` : ''}`);
      }
    } catch (err: any) {
      alert("Restock failed: " + err.message);
    }
  };

  // Discard expired stock logic
  const handleDiscardExpiredProductSelection = async (productId: string, notes: string) => {
    const todayISO = new Date().toISOString();
    const pMatch = products.find(p => p.id === productId);
    if (!pMatch) return;

    const currentQty = pMatch.quantityInStock;

    try {
      setProducts(prev => {
        const updated = prev.map(p => p.id === productId ? { ...p, quantityInStock: 0 } : p);
        setLocalCache('products', updated.map(toDbProduct));
        return updated;
      });
      queueAction('update', 'products', { quantity_in_stock: 0 }, productId);

      const logId = crypto.randomUUID();
      const log: StockLog = {
        id: logId,
        productId,
        productName: pMatch.name,
        changeQty: -currentQty,
        type: 'discard_expired',
        timestamp: todayISO,
        operatorName: currentUser?.fullName || 'Admin',
        notes
      };

      setStockLogs(prev => {
        const updated = [...prev, log];
        setLocalCache('stock_logs', updated.map(toDbStockLog));
        return updated;
      });
      queueAction('insert', 'stock_logs', toDbStockLog(log));

      addAuditLog('Discard expired product', `Discarded remaining ${currentQty} units of expired "${pMatch.name}" and locked to zero.`);
    } catch (err: any) {
      alert("Discard failed: " + err.message);
    }
  };

  // ----- EXTRA: EXPENSE MODULE MANAGERS -----
  const handleRecordExpense = async (newExpFields: Omit<Expense, 'id' | 'timestamp' | 'recordedBy'>) => {
    const expenseId = crypto.randomUUID();
    const completeExpense: Expense = {
      ...newExpFields,
      id: expenseId,
      timestamp: new Date().toISOString(),
      recordedBy: currentUser?.fullName || 'Administrator'
    };

    try {
      setExpenses(prev => {
        const updated = [...prev, completeExpense];
        setLocalCache('expenses', updated.map(toDbExpense));
        return updated;
      });
      queueAction('insert', 'expenses', toDbExpense(completeExpense));
      addAuditLog('Record Expense', `Logged financial expense under category "${completeExpense.category}" for KES ${completeExpense.amount}.`);
    } catch (err: any) {
      alert("Expense recording failed: " + err.message);
    }
  };

  const handleRemoveExpense = async (expenseId: string) => {
    const itemToDel = expenses.find(e => e.id === expenseId);
    if (!itemToDel) return;

    if (window.confirm(`Are you sure you want to permanently delete expense entry "${itemToDel.itemName}" total KES ${itemToDel.amount}?`)) {
      try {
        setExpenses(prev => {
          const updated = prev.filter(e => e.id !== expenseId);
          setLocalCache('expenses', updated.map(toDbExpense));
          return updated;
        });
        queueAction('delete', 'expenses', null, expenseId);
        addAuditLog('Delete Expense', `Removed expense log "${itemToDel.itemName}" of category "${itemToDel.category}" worth KES ${itemToDel.amount}.`);
      } catch (err: any) {
        alert("Expense removal failed: " + err.message);
      }
    }
  };

  // ----- 6. USER/CASHIER MANAGEMENT ACTIONS -----
  const handleRegisterUser = async (newUserFields: Omit<User, 'id'> & { pin: string }) => {
    const userId = crypto.randomUUID();
    const plainPin = newUserFields.pin; // plaintext for server-side hashing
    const hashedPinForCache = bcrypt.hashSync(plainPin, 10); // hash only for local offline cache
    const completeUserForCache = {
      ...newUserFields,
      id: userId,
      pin: hashedPinForCache
    };

    try {
      if (navigator.onLine) {
        // Online: call the authenticated server route directly (server hashes PIN once)
        const savedProfile = await apiFetch('/api/profiles', {
          method: 'POST',
          body: JSON.stringify({
            username: newUserFields.username,
            fullName: newUserFields.fullName,
            email: newUserFields.email,
            role: newUserFields.role,
            phone: newUserFields.phone,
            active: newUserFields.active !== undefined ? newUserFields.active : true,
            pin: plainPin // server will hash this
          })
        });

        // Use server-confirmed profile (has correct hashed PIN in DB)
        const confirmedUser = mapProfile(savedProfile);
        setUsers(prev => {
          const updated = [...prev, confirmedUser];
          // Store with client-hashed PIN in local cache for offline auth
          const cacheData = updated.map(u => {
            const dbRow = toDbProfile(u);
            return u.id === confirmedUser.id ? { ...dbRow, pin: hashedPinForCache } : dbRow;
          });
          setLocalCache('profiles', cacheData);
          return updated;
        });
      } else {
        // Offline: queue with plaintext PIN so server hashes it exactly once on sync
        const serverPayload = {
          ...toDbProfile({ ...newUserFields, id: userId }),
          pin: plainPin // plaintext — server hashes it
        };
        setUsers(prev => {
          const updated = [...prev, mapProfile(toDbProfile(completeUserForCache))];
          setLocalCache('profiles', updated.map(toDbProfile));
          return updated;
        });
        queueAction('insert', 'profiles', serverPayload);
      }

      addAuditLog('User Registered', `Registered operator credentials for cashiers @${newUserFields.username} (${newUserFields.fullName}).`);
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    }
  };

  const handleToggleUserActiveShift = async (userId: string) => {
    const uMatch = users.find(u => u.id === userId);
    if (!uMatch) return;

    const nextState = !uMatch.active;

    try {
      setUsers(prev => {
        const updated = prev.map(u => u.id === userId ? { ...u, active: nextState } : u);
        setLocalCache('profiles', updated.map(toDbProfile));
        return updated;
      });
      queueAction('update', 'profiles', { active: nextState }, userId);
      addAuditLog('Employee Status Adjustment', `Toggled employee shift login block for ${uMatch.fullName} to ${nextState ? 'Unlocked' : 'Shift Locked'}.`);
    } catch (err: any) {
      alert("Toggle status failed: " + err.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDel = users.find(u => u.id === userId);
    if (!userToDel) return;

    try {
      if (navigator.onLine) {
        // Use the authenticated server route (service role key bypasses RLS)
        await apiFetch(`/api/profiles/${userId}`, { method: 'DELETE' });
      } else {
        // Queue for sync when back online
        queueAction('delete', 'profiles', null, userId);
      }

      // Update local state only after confirming the server delete succeeded
      setUsers(prev => {
        const updated = prev.filter(u => u.id !== userId);
        setLocalCache('profiles', updated.map(toDbProfile));
        return updated;
      });

      addAuditLog('User Deleted', `Deleted cashier/operator credentials for @${userToDel.username} (${userToDel.fullName}).`);
    } catch (err: any) {
      alert("Delete operator failed: " + err.message);
    }
  };

  // ----- 7. DATABASE BACKUP AND RESTORE OPERATIONS -----
  const triggerDownloadBackupJSON = () => {
    const masterDb = {
      backupTimestamp: new Date().toISOString(),
      products,
      sales,
      categories,
      stockLogs,
      auditLogs,
      shopSettings,
      users,
      expenses
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(masterDb, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href",     dataStr     );
    dlAnchorElem.setAttribute("download", `Dufuka_POS_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();

    addAuditLog('DB Backup', 'Downloaded complete in-memory JSON shop databases backup securely.');
  };

  const triggerDownloadBackupPDF = () => {
    generateDatabasePDF(products, shopSettings, currentUser);
    addAuditLog('DB PDF Statement Download', 'Downloaded stock appraisal database statement PDF securely.');
  };

  const triggerUploadBackupSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          
          if (parsed.products && parsed.sales && parsed.categories && parsed.users) {
            setProducts(parsed.products);
            setSales(parsed.sales);
            setCategories(parsed.categories);
            setStockLogs(parsed.stockLogs || []);
            setAuditLogs(parsed.auditLogs || []);
            setShopSettings(parsed.shopSettings || DEFAULT_SHOP_SETTINGS);
            setUsers(parsed.users);
            setExpenses(parsed.expenses || []);
            
            alert('Ameamua! Database state restored successfully! All stock levels, logs and reports are updated.');
            
            // Log successful database restoration trail
            const restorationAudit: AuditLog = {
              id: `aud_${Date.now()}`,
              userId: currentUser?.id || 'admin',
              userName: currentUser?.fullName || 'admin',
              action: 'Database Restored',
              details: `Uploaded historical database backup dated ${parsed.backupTimestamp || 'N/A'}. Refreshing dashboard parameters.`,
              timestamp: new Date().toISOString()
            };
            setAuditLogs(prev => [...prev, restorationAudit]);
          } else {
            alert('Invalid backup schema. The JSON does not match the Point of Sale structure.');
          }
        } catch (err) {
          alert('Failed to parse document. Confirm it is a valid JSON file.');
        }
      };
    }
  };

  // Clear Audit log history action
  const handleClearAuditHistory = () => {
    handleClearSection('audit');
  };

  // Clear specific section data action (Admin override only)
  const handleClearSection = async (section: 'sales' | 'products' | 'expenses' | 'suppliers' | 'audit') => {
    if (!navigator.onLine) {
      alert("Network connection is required to execute a secure database wipe.");
      return;
    }

    const confirmPin = window.prompt(`To authorize this database purge for ${section}, please enter your Admin PIN:`);
    if (!confirmPin) return;

    let startDate = '';
    let endDate = '';
    if (section !== 'suppliers') {
      startDate = window.prompt("Enter deletion Start Date (YYYY-MM-DD):", "2026-01-01") || "";
      if (!startDate) return;
      endDate = window.prompt("Enter deletion End Date (YYYY-MM-DD):", "2026-12-31") || "";
      if (!endDate) return;
    }

    try {
      const res = await apiFetch('/api/data/wipe', {
        method: 'POST',
        body: JSON.stringify({
          section,
          confirmPin,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        })
      });

      alert(res.message || 'Records cleared successfully!');
      // Reload fresh database state from the server
      await loadData();
    } catch (err: any) {
      alert(`Failed to clear records: ` + err.message);
    }
  };

  // Restore specific section data action (Admin override only)
  const handleRestoreWipedData = async (auditLogId: string) => {
    if (!navigator.onLine) {
      alert("Network connection is required to restore database records.");
      return;
    }

    const confirmPin = window.prompt("To authorize database restoration, please enter your Admin PIN:");
    if (!confirmPin) return;

    try {
      const res = await apiFetch('/api/audit-logs/restore', {
        method: 'POST',
        body: JSON.stringify({
          auditLogId,
          confirmPin
        })
      });

      alert(res.message || 'Data restored successfully!');
      // Reload fresh database state from the server
      await loadData();
    } catch (err: any) {
      alert('Failed to restore wiped data: ' + err.message);
    }
  };

  // Save Shop Details
  const handleModifySettings = (newSettingsData: ShopSettings) => {
    setShopSettings(newSettingsData);
    localStorage.setItem('dufuka_shop_settings', JSON.stringify(newSettingsData));
    addAuditLog('Settings Modified', 'Customized shop information details, tax register and receipt headers.');
  };

  // ----- 8. SYSTEM SHELF WARNING ENTITIES GENERATION -----
  const currentTimestampForAlerts = new Date().setHours(0, 0, 0, 0);
  const thirtyDaysLaterTimestampForAlerts = currentTimestampForAlerts + 30 * 24 * 60 * 60 * 1000;

  const systemAlertNotifications = useMemo(() => {
    const notifications: { id: string, title: string, subtitle: string, urgency: 'red' | 'orange' }[] = [];

    products.forEach(p => {
      // Out of Stock
      if (p.quantityInStock === 0) {
        notifications.push({
          id: `notif_out_${p.id}`,
          title: `Sold Out: "${p.name}"`,
          subtitle: `Shelf quantity is 0. Product automatically marked Out of Stock on catalog.`,
          urgency: 'red'
        });
      }
      
      // Expiry dates checks
      if (p.expiryDate) {
        const expTime = new Date(p.expiryDate).getTime();
        if (expTime < currentTimestampForAlerts) {
          notifications.push({
            id: `notif_exp_${p.id}`,
            title: `Expired Shelf Alert: "${p.name}"`,
            subtitle: `Expired on ${p.expiryDate}. Discard immediately to prevent customer hazards.`,
            urgency: 'red'
          });
        } else if (expTime >= currentTimestampForAlerts && expTime <= thirtyDaysLaterTimestampForAlerts) {
          notifications.push({
            id: `notif_near_${p.id}`,
            title: `Nearing Shelf Expiry: "${p.name}"`,
            subtitle: `Will expire soon on ${p.expiryDate}. Consider discounting or pushing checkout promotions.`,
            urgency: 'orange'
          });
        }
      }
    });

    return notifications;
  }, [products, currentTimestampForAlerts, thirtyDaysLaterTimestampForAlerts]);

  // Categories simple mapping string extraction
  const categoriesMapString = useMemo(() => {
    return categories.map(c => c.name);
  }, [categories]);

  // ----- 9. RENDER BRANCH ROUTINGS (If No login Session exists, show login panel) -----
  if (!currentUser) {
    if (showChangeDefaultPin) {
      return (
        <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 transition-colors duration-200" id="pin-change-screen-view">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl p-8 relative overflow-hidden" id="pin-change-card">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
            
            <div className="text-center space-y-2 mb-6" id="pin-change-header">
              <div className="bg-amber-50 dark:bg-amber-950 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <Key className="w-8 h-8 pointer-events-none" />
              </div>
              <h1 className="text-2xl font-extrabold font-sans text-zinc-900 dark:text-white tracking-tight">
                First-Time Login Security Setup
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal font-medium">
                Please change the default administrator PIN passcode to secure your Point of Sale system.
              </p>
            </div>

            <form onSubmit={handlePinChangeSubmit} className="space-y-4" id="pin-change-form">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
                  New PIN / Passcode *
                </label>
                <input
                  id="new-pin-input"
                  type="password"
                  required
                  placeholder="Enter new PIN passcode"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700/80 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm focus:bg-zinc-950 dark:focus:bg-zinc-950 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
                  Confirm New PIN / Passcode *
                </label>
                <input
                  id="confirm-pin-input"
                  type="password"
                  required
                  placeholder="Confirm new PIN passcode"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700/80 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm focus:bg-zinc-950 dark:focus:bg-zinc-950 transition"
                />
              </div>

              {pinChangeError && (
                <p className="text-xs text-red-655 font-semibold text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg border border-red-200/50">
                  {pinChangeError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeDefaultPin(false);
                    setNewPin('');
                    setConfirmNewPin('');
                    setPinChangeError('');
                  }}
                  className="w-1/2 py-3 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-extrabold rounded-xl shadow-md transition duration-150 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition duration-150 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Save &amp; Login
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 transition-colors duration-200" id="login-screen-view">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl p-8 relative overflow-hidden" id="login-card">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
          
          <div className="text-center space-y-2 mb-6" id="login-header">
            <div className="bg-emerald-50 dark:bg-emerald-950 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <Building className="w-8 h-8 pointer-events-none" />
            </div>
            <h1 className="text-2xl font-extrabold font-sans text-zinc-900 dark:text-white tracking-tight">
              Mshiriki Super Dufuka POS
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal font-medium">
              Kenyan Offline-First Supermarket &amp; Retail POS System. Enter your cashier credentials below.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4" id="login-form">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
                Cashier PIN Username name
              </label>
              <input
                id="login-username-input"
                type="text"
                required
                placeholder="e.g. admin or cashier"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700/80 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm focus:bg-zinc-950 dark:focus:bg-zinc-950 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400 block mb-1">
                Shift Passcode Code *
              </label>
              <div className="relative">
                <input
                  id="login-passcode-input"
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="PIN code (default is '1234')"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700/80 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm focus:bg-zinc-950 dark:focus:bg-zinc-950 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-3 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-xs text-red-655 font-semibold text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg border border-red-200/50">
                {loginError}
              </p>
            )}

            <button
              id="login-submit-button"
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Unlock Shift Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  const getSidebarTabClass = (tabId: string) => {
    const isActive = activeTab === tabId || (tabId === 'reports' && activeTab === 'reports_ai');
    const showLabelsOnMobile = isSidebarOpen;
    const isFullWidthNeeded = !isSidebarCollapsed || showLabelsOnMobile;

    const baseClass = "w-full py-3 rounded-xl flex items-center transition-all duration-150 tracking-wide cursor-pointer font-bold text-[11px] shrink-0";
    const layoutClass = isFullWidthNeeded ? "justify-start px-4 gap-3.5" : "justify-center px-0";
    
    // Changing unclicked/inactive menus from faded color to solid bright, highly readable text-zinc-100/text-white hover actions!
    const colorClass = isActive 
      ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40" 
      : "text-zinc-100 hover:bg-zinc-800/80 hover:text-white focus:text-white";
    return `${baseClass} ${layoutClass} ${colorClass}`;
  };

  const handleCloseCollapse = () => {
    setIsSidebarCollapsed(true);
    setIsSidebarOpen(false);
  };

  // Determine whether to display label texts
  const showText = !isSidebarCollapsed || isSidebarOpen;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans flex transition-colors duration-200">
      
      {/* 🔴 Mobile Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 xl:hidden transition-opacity duration-200 cursor-pointer"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* 🟢 SIDEBAR NAVIGATION BLOCK (Desktop Sidebar drawer) */}
      <aside 
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between text-zinc-300 select-none transform transition-all duration-200 print:hidden ${
          isSidebarCollapsed ? 'w-16 xl:w-16' : 'w-64 xl:w-64'
        } ${
          isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full xl:translate-x-0'
        }`}
      >
        <div>
          {/* Shop brand title header */}
          <div 
            className={`h-16 border-b border-zinc-800/80 flex items-center justify-between transition-all duration-200 ${
              (isSidebarCollapsed && !isSidebarOpen) ? 'px-0 justify-center' : 'px-6'
            }`} 
            id="sidebar-logo-bar"
          >
            {(isSidebarCollapsed && !isSidebarOpen) ? (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center rounded-xl cursor-pointer transition shadow-md shadow-emerald-900/20 hover:scale-105"
                title="Expand sidebar"
              >
                <Building className="w-5 h-5" />
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2 text-white">
                  <div className="bg-emerald-600 p-1.5 rounded-lg text-white">
                    <Building className="w-5 h-5 pointer-events-none" />
                  </div>
                  <span className="font-extrabold tracking-tight text-white font-sans text-sm block truncate w-36">
                    {shopSettings.shopName}
                  </span>
                </div>
                {/* Collapse button - "when the x button at the top is clicked" */}
                <button 
                  onClick={handleCloseCollapse}
                  className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer transition duration-150"
                  title="Collapse sidebar to icons"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Core Navigation Routing Link Tabs */}
          <nav className={`p-4 space-y-1.5 text-xs font-bold transition-all duration-200 ${isSidebarCollapsed ? 'px-2' : ''}`} id="sidebar-nav-elements">
            
            {/* 1. Dashboard */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
                className={getSidebarTabClass('dashboard')}
                title={isSidebarCollapsed ? "Metrics Dashboard" : undefined}
              >
                <Activity className="w-4.5 h-4.5 shrink-0" />
                {showText && <span className="truncate">Metrics Dashboard</span>}
              </button>
            )}

            {/* 2. Sales Cashier POS Terminal link */}
            <button
              onClick={() => { setActiveTab('pos'); setIsSidebarOpen(false); }}
              className={getSidebarTabClass('pos')}
              title={isSidebarCollapsed ? "Checkout Terminal (F2)" : undefined}
            >
              <ShoppingCart className="w-4.5 h-4.5 shrink-0" />
              {showText && <span className="truncate">Checkout Terminal (F2)</span>}
            </button>

            {/* 3. Catalog & Product manager */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('inventory'); setIsSidebarOpen(false); }}
                className={getSidebarTabClass('inventory')}
                title={isSidebarCollapsed ? "Product Catalog" : undefined}
              >
                <Package className="w-4.5 h-4.5 shrink-0" />
                {showText && <span className="truncate">Product Catalog</span>}
              </button>
            )}

            {/* 4. Stock, expiries & logs */}
            <button
              onClick={() => { setActiveTab('stock'); setIsSidebarOpen(false); }}
              className={getSidebarTabClass('stock')}
              title={isSidebarCollapsed ? "Shelf Monitoring" : undefined}
            >
              <Wrench className="w-4.5 h-4.5 shrink-0" />
              {showText && <span className="truncate">Shelf Monitoring</span>}
            </button>

            {/* 5. Reports and margins */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }}
                className={getSidebarTabClass('reports')}
                title={isSidebarCollapsed ? "Financial Reports" : undefined}
              >
                <TrendingUp className="w-4.5 h-4.5 shrink-0" />
                {showText && <span className="truncate">Financial Reports</span>}
              </button>
            )}

            {/* 5.5. Store Expenses Ledger */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('expenses'); setIsSidebarOpen(false); }}
                className={getSidebarTabClass('expenses')}
                title={isSidebarCollapsed ? "Store Expenses" : undefined}
              >
                <Coins className="w-4.5 h-4.5 shrink-0" />
                {showText && <span className="truncate">Store Expenses</span>}
              </button>
            )}

            {/* 6. Active Shift Cashier Registry */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
                className={getSidebarTabClass('users')}
                title={isSidebarCollapsed ? "Shop Operators" : undefined}
              >
                <Users className="w-4.5 h-4.5 shrink-0" />
                {showText && <span className="truncate">Shop Operators</span>}
              </button>
            )}

            {/* 7. Audit log table */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('audit'); setIsSidebarOpen(false); }}
                className={getSidebarTabClass('audit')}
                title={isSidebarCollapsed ? "Security Audit Trails" : undefined}
              >
                <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
                {showText && <span className="truncate">Security Audit Trails</span>}
              </button>
            )}

            {/* 8. Setup settings */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
                className={getSidebarTabClass('settings')}
                title={isSidebarCollapsed ? "Shop Settings & DB" : undefined}
              >
                <Database className="w-4.5 h-4.5 shrink-0" />
                {showText && <span className="truncate">Shop Settings &amp; DB</span>}
              </button>
            )}

          </nav>
        </div>

        {/* User context footer inside sidebar actions */}
        <div 
          className={`p-4 border-t border-zinc-800 text-xs bg-zinc-950/45 transition-all duration-250 ${
            (isSidebarCollapsed && !isSidebarOpen) ? 'space-y-4 flex flex-col items-center justify-center p-2' : 'space-y-3'
          }`} 
          id="sidebar-footer"
        >
          <div 
            className={`flex items-center ${(isSidebarCollapsed && !isSidebarOpen) ? 'justify-center' : 'gap-2 w-full'}`}
            title={`${currentUser.fullName} (${currentUser.role === 'admin' ? 'Administrator' : 'Cashier'})`}
          >
            <div className="w-8.5 h-8.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-center shrink-0">
              {currentUser.fullName.charAt(0)}
            </div>
            {showText && (
              <div className="truncate flex-1">
                <span className="font-extrabold text-white text-[11px] block truncate">{currentUser.fullName}</span>
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">{currentUser.role === 'admin' ? 'Administrator' : 'Cashier Desk'}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            title="Lock shift login"
            className={`bg-zinc-800 hover:bg-zinc-750 hover:text-white transition duration-150 rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer ${
              (isSidebarCollapsed && !isSidebarOpen) ? 'w-9 h-9 p-0' : 'w-full py-2 gap-2'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {showText && <span>Lock shift login</span>}
          </button>
        </div>

      </aside>

      {/* 🟢 RIGHT MAIN SCREEN SECTION COORDINATOR */}
      <div 
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
          isSidebarCollapsed ? 'xl:pl-16' : 'xl:pl-64'
        }`} 
        id="app-main-view"
      >
        
        {/* TOP STATUS HEADER BAR */}
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 print:hidden" id="app-header">
          
          <div className="flex items-center gap-2">
            {/* Hamburger trigger toggler */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="xl:hidden text-zinc-655 dark:text-zinc-350 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-202 dark:border-zinc-700/80 hover:bg-zinc-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <h2 className="font-extrabold text-zinc-900 dark:text-white tracking-tight capitalize text-sm">
                Tab: {activeTab === 'pos' ? 'Cashier Checkout Terminal' : activeTab}
              </h2>
            </div>
          </div>

          {/* Running Clock & Indicators */}
          <div className="flex items-center gap-4">
            
            {/* dynamic system Nairobi timezone dynamic clock */}
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-1.5 flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200 pointer-events-none">
              <Clock className="w-4 h-4 text-emerald-500" />
              <NairobiClock />
            </div>

            {/* Offline-Ready indicator validation */}
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 px-3 py-1.5 rounded-lg text-[10px] text-emerald-700 dark:text-emerald-400 font-bold tracking-wider">
              <Wifi className="w-4 h-4 text-emerald-500 animate-pulse pointer-events-none" />
              BIASHARA READY
            </div>

            {/* Notifications Alert Bells Badge and list pane */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="p-2 bg-zinc-50 dark:bg-zinc-803 hover:bg-zinc-102 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-650 dark:text-zinc-300 relative cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5 pointer-events-none" />
                {systemAlertNotifications.length > 0 && (
                  <span className="absolute top-1 right-1 bg-red-600 text-white w-2 h-2 rounded-full animate-ping"></span>
                )}
              </button>

              {/* Toggle panel notifications drawer */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2.5 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 shadow-2xl rounded-2xl p-4 space-y-3 z-50">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="font-extrabold text-zinc-900 dark:text-white text-xs">Shop Watch Notifications</span>
                    <span className="bg-red-100/60 dark:bg-red-950/40 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">
                      {systemAlertNotifications.length} warning(s)
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5" id="header-notif-scroller">
                    {systemAlertNotifications.length === 0 ? (
                      <p className="text-zinc-400 text-xs py-5 text-center">No shelving alerts or low stock warnings!</p>
                    ) : (
                      systemAlertNotifications.map((notif, idx) => (
                        <div key={idx} className={`p-2 rounded-lg text-xs border ${
                          notif.urgency === 'red' 
                            ? 'bg-red-50/10 dark:bg-red-950/20 border-red-200 dark:border-red-900' 
                            : 'bg-amber-50/10 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                        }`}>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100 leading-none">{notif.title}</p>
                          <p className="text-[10px] text-zinc-400 mt-1 leading-normal">{notif.subtitle}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dark & Light custom switcher */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 bg-zinc-50 dark:bg-zinc-805 text-zinc-655 dark:text-zinc-305 hover:bg-zinc-100 dark:hover:bg-zinc-804 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

          </div>

        </header>

        {/* CORE CONTAINER ROUTED CONTENT VIEWPORT */}
        <main className="flex-1 p-4 md:p-6" id="app-tab-container">
          
          {/* TAB: DASHBOARD MODULE */}
          {activeTab === 'dashboard' && currentUser.role === 'admin' && (
            <Dashboard
              products={products}
              sales={sales}
              onNavigate={(tab) => {
                if (tab === 'stock') setActiveTab('stock');
                if (tab === 'reports') setActiveTab('reports');
                if (tab === 'reports_ai') setActiveTab('reports_ai');
              }}
              onSellProductQuick={() => setActiveTab('pos')}
              onAddProductQuick={() => setActiveTab('inventory')}
              currentUserRole={currentUser.role}
              shopName={shopSettings.shopName}
            />
          )}

          {/* TAB: POS CHECKOUT TERMINAL */}
          {activeTab === 'pos' && (
            <POS
              products={products}
              categories={categoriesMapString}
              shopSettings={shopSettings}
              currentUser={currentUser}
              onCompleteSale={handleAddSaleSession}
            />
          )}

          {/* TAB: CATALOG MANAGEMENT */}
          {activeTab === 'inventory' && currentUser.role === 'admin' && (
            <Inventory
              products={products}
              categories={categories}
              suppliers={suppliers}
              onAddProduct={handleRegisterProduct}
              onEditProduct={handleModifyProduct}
              onDeleteProduct={handleDeleteProduct}
              onCreateCategory={handleRegisterCategory}
              currentUserRole={currentUser.role}
            />
          )}

          {/* TAB: FINANCIAL REPORTS */}
          {(activeTab === 'reports' || activeTab === 'reports_ai') && currentUser.role === 'admin' && (
            <Reports
              sales={sales}
              products={products}
              currentUserRole={currentUser.role}
              expenses={expenses}
              initialPeriod={activeTab === 'reports_ai' ? 'ai_insights' : undefined}
            />
          )}

          {/* TAB: STORE EXPENSES LEDGER */}
          {activeTab === 'expenses' && currentUser.role === 'admin' && (
            <Expenses
              expenses={expenses}
              onAddExpense={handleRecordExpense}
              onDeleteExpense={handleRemoveExpense}
              currentUser={currentUser}
            />
          )}

          {/* TAB: SHELF SURVEILLANCE & RESTOCKS */}
          {activeTab === 'stock' && (
            <Stocks
              products={products}
              stockLogs={stockLogs}
              onRestockProduct={handleRestockProductSelection}
              onDiscardExpiredProduct={handleDiscardExpiredProductSelection}
              currentUserRole={currentUser.role}
            />
          )}

          {/* TAB: CASHIER USERS REGISTRY */}
          {activeTab === 'users' && currentUser.role === 'admin' && (
            <UsersComponent
              users={users}
              onAddUser={handleRegisterUser}
              onToggleUserStatus={handleToggleUserActiveShift}
              onDeleteUser={handleDeleteUser}
              currentUserRole={currentUser.role}
            />
          )}

          {/* TAB: SECURITY AUDIT TRAILS */}
          {activeTab === 'audit' && currentUser.role === 'admin' && (
            <AuditLogs
              logs={auditLogs}
              onClearLogs={handleClearAuditHistory}
              currentUserRole={currentUser.role}
              onRestoreWipedData={handleRestoreWipedData}
            />
          )}

          {/* TAB: DATABASE MANAGEMENT AND SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6" id="backup-settings-layout">
              {/* Shop Identity settings */}
              <div className="bg-white dark:bg-zinc-910 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="settings-branding-section">
                <h3 className="font-extrabold text-zinc-900 dark:text-white text-base flex items-center gap-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                  <Building className="text-emerald-600 w-4.5 h-4.5" />
                  Customize Shop Receipt Details &amp; Till Paybill
                </h3>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleModifySettings(formSettings);
                    alert('Shop Settings Saved successfully!');
                  }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold"
                >
                  <div>
                    <label className="text-zinc-500 block mb-1">Dufuka Shop Display Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden"
                      value={formSettings.shopName}
                      onChange={(e) => setFormSettings({ ...formSettings, shopName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 block mb-1">KRA Tax PIN number</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden font-mono"
                      value={formSettings.taxRegistrationNumber}
                      onChange={(e) => setFormSettings({ ...formSettings, taxRegistrationNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 block mb-1">Full Shop Location Address</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden"
                      value={formSettings.shopAddress}
                      onChange={(e) => setFormSettings({ ...formSettings, shopAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 block mb-1">Branded Customer Support Tel</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden"
                      value={formSettings.shopPhone}
                      onChange={(e) => setFormSettings({ ...formSettings, shopPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 block mb-1">M-Pesa Buy Goods Till Code Number</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden font-mono"
                      value={formSettings.tillNumber}
                      onChange={(e) => setFormSettings({ ...formSettings, tillNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 block mb-1">M-Pesa Paybill Business Number</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden font-mono"
                      value={formSettings.paybillNumber}
                      onChange={(e) => setFormSettings({ ...formSettings, paybillNumber: e.target.value })}
                    />
                  </div>
                  
                  <div className="md:col-span-2 flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                    >
                      <Save className="w-4 h-4" />
                      Save Shop Settings
                    </button>
                  </div>
                </form>
              </div>

              {/* Database sync parameters */}
              <div className="bg-white dark:bg-zinc-910 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="settings-db-section">
                <h3 className="font-extrabold text-zinc-905 dark:text-white text-base flex items-center gap-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                  <Database className="text-emerald-600 w-4.5 h-4.5" />
                  Database Synchronizations &amp; Offline backups
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 leading-relaxed text-xs">
                  {/* Backup row download */}
                  <div className="p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl space-y-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <h4 className="font-extrabold text-zinc-950 dark:text-white text-sm flex items-center gap-1">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Download Database Backup
                    </h4>
                    <p className="text-zinc-500 text-[11px]">
                      Generate and download the database list as an official print-ready PDF statement. Every product is cleanly indexed in individual rows with current retail valuations, styled elegantly like a bank statement form.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={triggerDownloadBackupPDF}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-sm transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Download PDF Statement
                      </button>
                      <button
                        onClick={triggerDownloadBackupJSON}
                        className="px-3 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-805 dark:hover:bg-zinc-750 text-zinc-750 dark:text-zinc-250 font-bold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download JSON Data
                      </button>
                    </div>
                  </div>

                  {/* Restore uploader */}
                  <div className="p-4 border border-zinc-200 dark:border-zinc-850 rounded-xl space-y-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <h4 className="font-extrabold text-zinc-950 dark:text-white text-sm flex items-center gap-1">
                      <Upload className="w-4 h-4 text-emerald-600" />
                      Restore database backup
                    </h4>
                    <p className="text-zinc-500 text-[11px]">
                      Upload files containing POS backup arrays. Restoring state overwrites current active memory listings, audit traces, stock deductions, and reloads reports database instantly.
                    </p>
                    
                    <div className="relative mt-2">
                      <input
                        type="file"
                        accept=".json"
                        onChange={triggerUploadBackupSelection}
                        className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 file:cursor-pointer dark:file:bg-zinc-800 dark:file:text-zinc-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* API Integrations & Keys */}
              <div className="bg-white dark:bg-zinc-910 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl" id="settings-api-section">
                <h3 className="font-extrabold text-zinc-900 dark:text-white text-base flex items-center gap-1.5 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                  <Key className="text-emerald-600 w-4.5 h-4.5" />
                  API Integrations &amp; Secrets
                </h3>
                <div className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="text-zinc-500 block mb-1">Gemini AI API Key (required for generating AI reports)</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        className="flex-1 px-3 py-2 bg-zinc-900 dark:bg-zinc-900 text-white dark:text-white border border-zinc-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-hidden font-mono text-xs"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          localStorage.setItem('dufuka_gemini_api_key', geminiKey);
                          addAuditLog('API Secrets Updated', 'Configured Gemini AI key securely in terminal workspace.');
                          alert('Gemini API Key saved successfully!');
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1 shadow-sm transition"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Key
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1.5 leading-normal">
                      This key is stored locally in your browser and sent with report requests to authorize Gemini 3.5 Flash ledger synthesis.
                    </p>
                  </div>
                </div>
              </div>

              {/* Danger Zone: Purge Shop Databases (Admin Only) */}
              {currentUser?.role === 'admin' && (
                <div className="bg-red-50/5 dark:bg-red-950/5 border border-red-200 dark:border-red-900/60 p-5 rounded-2xl" id="settings-danger-zone">
                  <h3 className="font-extrabold text-red-600 dark:text-red-400 text-base flex items-center gap-1.5 pb-3 border-b border-red-200/40 dark:border-red-900/40 mb-4">
                    <AlertTriangle className="w-4.5 h-4.5" />
                    Danger Zone: Purge Shop Databases
                  </h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-4 leading-normal">
                    Administrators have the capability to selectively purge database tables of specific sections of the app (e.g. before handing over the app to a new shop owner). Wiping a section automatically records an recovery trace log in the <strong className="text-zinc-800 dark:text-zinc-200">Security Audit Trails</strong> which allows you to restore the version you cleared.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Clear Sales */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-white text-xs">Sales &amp; Stock Movement</h4>
                        <p className="text-zinc-400 text-[10px] leading-tight mt-1">Wipes all completed checkout sales registers and stock movement traces. Resets Dashboard metrics.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm("WARNING: Are you sure you want to delete ALL Sales and Stock Logs? This action will generate a restorable checkpoint.")) {
                            handleClearSection('sales');
                          }
                        }}
                        className="w-full py-2 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded-lg text-[11px] transition text-center cursor-pointer"
                      >
                        Clear Sales Data
                      </button>
                    </div>

                    {/* Clear Products */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-white text-xs">Products Catalog</h4>
                        <p className="text-zinc-400 text-[10px] leading-tight mt-1">Permanently deletes all registered product entries on shelf inventory.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm("WARNING: Are you sure you want to delete ALL Products from shelves? This action will generate a restorable checkpoint.")) {
                            handleClearSection('products');
                          }
                        }}
                        className="w-full py-2 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded-lg text-[11px] transition text-center cursor-pointer"
                      >
                        Clear Catalog
                      </button>
                    </div>

                    {/* Clear Expenses */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-white text-xs">Expenses Ledger</h4>
                        <p className="text-zinc-400 text-[10px] leading-tight mt-1">Clears all recorded shop overhead expenses and payouts logs.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm("WARNING: Are you sure you want to delete ALL recorded expenses? This action will generate a restorable checkpoint.")) {
                            handleClearSection('expenses');
                          }
                        }}
                        className="w-full py-2 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded-lg text-[11px] transition text-center cursor-pointer"
                      >
                        Clear Expenses
                      </button>
                    </div>

                    {/* Clear Suppliers */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-white text-xs">Suppliers Directory</h4>
                        <p className="text-zinc-400 text-[10px] leading-tight mt-1">Clears the registered listing of partner suppliers and distributors.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm("WARNING: Are you sure you want to delete ALL suppliers? This action will generate a restorable checkpoint.")) {
                            handleClearSection('suppliers');
                          }
                        }}
                        className="w-full py-2 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded-lg text-[11px] transition text-center cursor-pointer"
                      >
                        Clear Suppliers
                      </button>
                    </div>

                    {/* Clear Audit Logs */}
                    <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-white text-xs">Security Audit Logs</h4>
                        <p className="text-zinc-400 text-[10px] leading-tight mt-1">Purger of audit trace histories. This operation is itself logged with a recovery point.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm("WARNING: Are you sure you want to delete ALL security audit logs? This action will generate a restorable checkpoint.")) {
                            handleClearSection('audit');
                          }
                        }}
                        className="w-full py-2 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded-lg text-[11px] transition text-center cursor-pointer"
                      >
                        Clear Audit Trail
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>

      </div>

    </div>
  );
}
