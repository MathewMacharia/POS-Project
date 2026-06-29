import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Supabase admin client using the high-privilege service role key (bypasses RLS)
const supabaseUrl = process.env.SUPABASE_URL || "https://igzozjbppvxwvyeoahle.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined in server environment variables!");
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || "");

// Rate limiting configuration for paid API endpoints
const RATE_LIMIT_WINDOW_MS = (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || "15", 10) || 15) * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "5", 10) || 5;

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired rate limit records periodically to prevent memory growth
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
    );
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// Ensure the Node.js process can exit cleanly if needed
if (rateLimitCleanupInterval && typeof rateLimitCleanupInterval.unref === "function") {
  rateLimitCleanupInterval.unref();
}

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Extract client IP address, handling proxy headers if present
  const xForwardedFor = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(xForwardedFor) ? xForwardedFor[0] : typeof xForwardedFor === "string" ? xForwardedFor.split(",")[0] : null)
    || req.ip 
    || req.socket.remoteAddress 
    || "unknown-ip";
    
  const now = Date.now();

  let record = rateLimitStore.get(ip);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(ip, record);
  }

  // Keep only timestamps within the active window
  record.timestamps = record.timestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  const requestCount = record.timestamps.length;
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - requestCount);
  
  // Calculate reset time based on the oldest request timestamp in the window
  const resetTime = record.timestamps.length > 0 
    ? record.timestamps[0] + RATE_LIMIT_WINDOW_MS 
    : now + RATE_LIMIT_WINDOW_MS;
  const resetSeconds = Math.max(0, Math.ceil((resetTime - now) / 1000));

  // Set standard rate limiting headers
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, remaining - 1));
  res.setHeader("X-RateLimit-Reset", Math.ceil(resetTime / 1000));

  if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader("Retry-After", resetSeconds);
    return res.status(429).json({
      error: "Too Many Requests",
      details: `Rate limit exceeded. You can only generate up to ${RATE_LIMIT_MAX_REQUESTS} reports every ${RATE_LIMIT_WINDOW_MS / (60 * 1000)} minutes. Please wait ${Math.ceil(resetSeconds / 65) /* Round up minutes safely */} minute(s) before trying again.`
    });
  }

  record.timestamps.push(now);
  next();
}

// Set up larger payload limits for complete data uploads to report generator
app.use(express.json({ limit: "30mb" }));

// Lazy-initialized Gemini Client (ensures the key is read when the function is actually called)
let aiClient: GoogleGenAI | null = null;
let lastApiKey: string | null = null;

function getGeminiClient(clientKey?: string): GoogleGenAI {
  const apiKey = clientKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server. Please add your key to Secrets in Settings.");
  }
  if (!aiClient || lastApiKey !== apiKey) {
    lastApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. Core API Endpoint: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), hasApiKey: !!process.env.GEMINI_API_KEY });
});

// Helper function to log login audits directly via service_role bypassing RLS
async function logLoginAttempt(userId: string | null, userName: string, success: boolean, details: string) {
  try {
    await supabaseAdmin.from("audit_logs").insert([
      {
        user_id: userId,
        user_name: userName,
        action: success ? "User Login Success" : "User Login Failure",
        details: `Login attempt on server-side endpoint. Success=${success}. Reason: ${details}`,
        timestamp: new Date().toISOString()
      }
    ]);
  } catch (auditErr) {
    console.error("[Auth API] Failed to write server login audit log:", auditErr);
  }
}

// 1b. Auth API Endpoint: Secure Server-Side Login Route
app.post("/api/auth/login", async (req, res) => {
  const { username, pin } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ error: "Username and PIN are required." });
  }

  const usernameLower = username.trim().toLowerCase();

  try {
    // 1. Query the database using the service_role key to lookup user (bypassing RLS)
    // We select only the columns we need to verify and return
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, email, role, phone, active, pin")
      .eq("username", usernameLower)
      .single();

    if (error || !profile) {
      console.warn(`[Auth API] Login failed: username "${usernameLower}" not found.`);
      await logLoginAttempt(null, usernameLower, false, `Username not found.`);
      return res.status(401).json({ error: "Invalid username or PIN." });
    }

    if (!profile.active) {
      console.warn(`[Auth API] Login failed: account for "${usernameLower}" is locked/inactive.`);
      await logLoginAttempt(profile.id, profile.full_name, false, `Locked/inactive account.`);
      return res.status(403).json({ error: "Account status is locked. Kindly contact Supervisor / Admin." });
    }

    // 2. Securely verify bcrypt hash
    const isPinCorrect = bcrypt.compareSync(pin, profile.pin);
    if (!isPinCorrect) {
      console.warn(`[Auth API] Login failed: incorrect PIN for "${usernameLower}".`);
      await logLoginAttempt(profile.id, profile.full_name, false, `Incorrect PIN.`);
      return res.status(401).json({ error: "Invalid username or PIN." });
    }

    // 3. Issue stateless signed JWT containing ONLY non-sensitive identity attributes
    const tokenSecret = process.env.JWT_SECRET || "default-fallback-secret-for-pos-jwt-signing";
    const token = jwt.sign(
      {
        id: profile.id,
        username: profile.username,
        role: profile.role
      },
      tokenSecret,
      { expiresIn: "10h" } // Expiry set to 10 hours for shift length
    );

    // 4. Log successful attempt in database audit trail
    await logLoginAttempt(profile.id, profile.full_name, true, `Successful verification.`);

    // 5. Return profile and JWT to the client, explicitly omitting the PIN or password hashes
    return res.json({
      token,
      user: {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name,
        email: profile.email || "",
        role: profile.role,
        phone: profile.phone || "",
        active: profile.active
      }
    });
  } catch (err: any) {
    console.error("[Auth API] System authentication error:", err);
    return res.status(500).json({ error: "System authentication error.", details: err.message });
  }
});

// --- JWT Verification & Role Gating Middleware ---
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required." });

  const tokenSecret = process.env.JWT_SECRET || "default-fallback-secret-for-pos-jwt-signing";
  jwt.verify(token, tokenSecret, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid or expired access token." });
    (req as any).user = user;
    next();
  });
}

function requireRole(role: "admin" | "cashier") {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized." });
    if (role === "admin" && user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }
    next();
  };
}

// Helper function to insert audit logs server-side with authenticated user identity
async function insertAuditLog(userId: string | null, userName: string, action: string, details: string, restorePayload?: string) {
  try {
    let finalDetails = details;
    if (restorePayload) {
      finalDetails = `${details} |__RESTORE_PAYLOAD__| ${restorePayload}`;
    }
    await supabaseAdmin.from("audit_logs").insert([
      {
        user_id: userId,
        user_name: userName,
        action,
        details: finalDetails,
        timestamp: new Date().toISOString()
      }
    ]);
  } catch (err) {
    console.error("[Audit Trail] Failed to insert audit log on server:", err);
  }
}

// --- 1c. Profiles (User Registry) API Routes ---
app.get("/api/profiles", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, full_name, email, role, phone, active")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch profiles.", details: err.message });
  }
});

app.post("/api/profiles", authenticateToken, requireRole("admin"), async (req, res) => {
  const { username, fullName, email, role, phone, active, pin } = req.body;
  const adminUser = (req as any).user;

  if (!username || !fullName || !role || !pin) {
    return res.status(400).json({ error: "Required fields missing (username, fullName, role, pin)." });
  }

  const usernameLower = username.trim().toLowerCase();

  try {
    const hashedPin = bcrypt.hashSync(pin, 10);
    const profileRow = {
      username: usernameLower,
      full_name: fullName,
      email: email || null,
      role: role,
      phone: phone || null,
      active: active !== undefined ? active : true,
      pin: hashedPin
    };

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert([profileRow])
      .select("id, username, full_name, email, role, phone, active")
      .single();

    if (error) throw error;

    await insertAuditLog(
      adminUser.id,
      adminUser.username,
      "USER_CREATE",
      `Registered new operator profile "${fullName}" with username "${usernameLower}".`
    );

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create profile.", details: err.message });
  }
});

app.put("/api/profiles/:id", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { username, fullName, email, role, phone, active, pin } = req.body;
  const adminUser = (req as any).user;

  try {
    const updateData: any = {};
    if (username) updateData.username = username.trim().toLowerCase();
    if (fullName) updateData.full_name = fullName;
    if (email !== undefined) updateData.email = email || null;
    if (role) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone || null;
    if (active !== undefined) updateData.active = active;
    if (pin) {
      updateData.pin = bcrypt.hashSync(pin, 10);
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select("id, username, full_name, email, role, phone, active")
      .single();

    if (error) throw error;

    await insertAuditLog(
      adminUser.id,
      adminUser.username,
      "USER_UPDATE",
      `Updated profile details/PIN for user "${fullName || data.full_name}".`
    );

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update profile.", details: err.message });
  }
});

app.delete("/api/profiles/:id", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data: userRow, error: fErr } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", id)
      .single();
    if (fErr) throw fErr;

    const { error } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", id);
    if (error) throw error;

    await insertAuditLog(
      adminUser.id,
      adminUser.username,
      "USER_DELETE",
      `Deleted operator profile "${userRow.full_name}" (ID: ${id}).`
    );

    return res.json({ success: true, message: "Profile deleted successfully." });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete profile.", details: err.message });
  }
});

// --- 1d. Categories API Routes ---
app.post("/api/categories", authenticateToken, requireRole("admin"), async (req, res) => {
  const { name, isCustom } = req.body;
  const adminUser = (req as any).user;

  if (!name) return res.status(400).json({ error: "Category name is required." });

  try {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .insert([{ name, is_custom: isCustom !== undefined ? isCustom : true }])
      .select()
      .single();
    if (error) throw error;

    await insertAuditLog(adminUser.id, adminUser.username, "CATEGORY_CREATE", `Created custom product category "${name}".`);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create category.", details: err.message });
  }
});

app.delete("/api/categories/:id", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data: category, error: fErr } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("id", id)
      .single();
    if (fErr) throw fErr;

    const { error } = await supabaseAdmin
      .from("categories")
      .delete()
      .eq("id", id);
    if (error) throw error;

    await insertAuditLog(adminUser.id, adminUser.username, "CATEGORY_DELETE", `Deleted category "${category.name}".`);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete category.", details: err.message });
  }
});

// --- 1e. Products API Routes ---
app.post("/api/products", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id, name, category, barcode, buyingPrice, sellingPrice, quantityInStock, supplierName, description, imageUrl, expiryDate } = req.body;
  const adminUser = (req as any).user;

  if (!name || !category) return res.status(400).json({ error: "Name and Category are required." });

  try {
    const productRow = {
      id: id || undefined,
      name,
      category,
      barcode: barcode || null,
      buying_price: buyingPrice || 0,
      selling_price: sellingPrice || 0,
      quantity_in_stock: quantityInStock || 0,
      supplier_name: supplierName || null,
      description: description || null,
      image_url: imageUrl || null,
      expiry_date: expiryDate || null
    };

    const { data, error } = await supabaseAdmin
      .from("products")
      .insert([productRow])
      .select()
      .single();
    if (error) throw error;

    await insertAuditLog(adminUser.id, adminUser.username, "PRODUCT_CREATE", `Registered new product "${name}" under category "${category}".`);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create product.", details: err.message });
  }
});

app.put("/api/products/:id", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { name, category, barcode, buyingPrice, sellingPrice, quantityInStock, supplierName, description, imageUrl, expiryDate } = req.body;
  const adminUser = (req as any).user;

  try {
    const updateData: any = {};
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (barcode !== undefined) updateData.barcode = barcode || null;
    if (buyingPrice !== undefined) updateData.buying_price = buyingPrice;
    if (sellingPrice !== undefined) updateData.selling_price = sellingPrice;
    if (quantityInStock !== undefined) updateData.quantity_in_stock = quantityInStock;
    if (supplierName !== undefined) updateData.supplier_name = supplierName || null;
    if (description !== undefined) updateData.description = description || null;
    if (imageUrl !== undefined) updateData.image_url = imageUrl || null;
    if (expiryDate !== undefined) updateData.expiry_date = expiryDate || null;

    const { data, error } = await supabaseAdmin
      .from("products")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await insertAuditLog(adminUser.id, adminUser.username, "PRODUCT_UPDATE", `Updated product specifications for "${name || data.name}".`);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update product.", details: err.message });
  }
});

app.delete("/api/products/:id", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const adminUser = (req as any).user;

  try {
    const { data: product, error: fErr } = await supabaseAdmin
      .from("products")
      .select("name")
      .eq("id", id)
      .single();
    if (fErr) throw fErr;

    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", id);
    if (error) throw error;

    await insertAuditLog(adminUser.id, adminUser.username, "PRODUCT_DELETE", `Deleted product "${product.name}" from catalog.`);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete product.", details: err.message });
  }
});

// --- 1f. Sales & Stock Count Transactional Endpoint ---
app.get("/api/sales", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    let query = supabaseAdmin.from("sales").select("*");
    
    if (user.role === 'cashier') {
      // Cashiers see only their own sales created today (Nairobi timezone UTC+3)
      const nowNairobi = new Date(new Date().getTime() + 3 * 60 * 60 * 1000);
      const startOfDay = new Date(Date.UTC(nowNairobi.getUTCFullYear(), nowNairobi.getUTCMonth(), nowNairobi.getUTCDate(), 0, 0, 0));
      const startUtc = new Date(startOfDay.getTime() - 3 * 60 * 60 * 1000).toISOString();
      
      query = query.eq("cashier_id", user.id).gte("date_added", startUtc);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch sales.", details: err.message });
  }
});

app.post("/api/sales", authenticateToken, async (req, res) => {
  const { 
    id,
    receiptNumber, 
    items, 
    paymentMethod, 
    paymentDetailsRef, 
    paidAmount, 
    changeAmount, 
    discount,
    dateAdded 
  } = req.body;
  const user = (req as any).user;

  if (!receiptNumber || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid sale payload: receiptNumber and non-empty items array are required." });
  }

  try {
    // 1. Fetch current product stocks to verify counts
    const productIds = items.map(item => item.id);
    const { data: dbProducts, error: pErr } = await supabaseAdmin
      .from("products")
      .select("*")
      .in("id", productIds);

    if (pErr || !dbProducts) {
      return res.status(500).json({ error: "Failed to retrieve products for stock validation.", details: pErr?.message });
    }

    // Verify all items exist and have sufficient stock
    for (const item of items) {
      const prod = dbProducts.find(p => p.id === item.id);
      if (!prod) {
        return res.status(400).json({ error: `Product not found in catalog: ${item.name}` });
      }
      if (prod.quantity_in_stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for product ${item.name}. Available: ${prod.quantity_in_stock}, Requested: ${item.quantity}` });
      }
    }

    // 2. Perform updates and inserts in a single simulated transactional chain
    // Decrement product stock levels
    for (const item of items) {
      const prod = dbProducts.find(p => p.id === item.id)!;
      const newQty = prod.quantity_in_stock - item.quantity;
      const { error: upError } = await supabaseAdmin
        .from("products")
        .update({ quantity_in_stock: newQty })
        .eq("id", item.id);
      if (upError) throw new Error(`Stock decrement failed for ${item.name}: ${upError.message}`);
    }

    // Insert sale record
    const subtotal = items.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
    const calculatedDiscount = discount || 0;
    const taxAmount = Math.round(Math.max(0, subtotal - calculatedDiscount) * 0.16);
    const total = Math.max(0, subtotal - calculatedDiscount);

    // Fetch cashier's profile details to get accurate full name
    const { data: cashierProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const cashierName = cashierProfile?.full_name || user.username;

    const saleRow = {
      id: id || undefined,
      receipt_number: receiptNumber,
      items: items,
      subtotal,
      tax_amount: taxAmount,
      total,
      discount: calculatedDiscount,
      payment_method: paymentMethod,
      payment_details_ref: paymentDetailsRef || null,
      paid_amount: paidAmount,
      change_amount: changeAmount,
      cashier_id: user.id,
      cashier_name: cashierName,
      date_added: dateAdded || new Date().toISOString()
    };

    const { data: insertedSale, error: sErr } = await supabaseAdmin
      .from("sales")
      .insert([saleRow])
      .select()
      .single();

    if (sErr) throw new Error(`Failed to insert sale record: ${sErr.message}`);

    // Insert stock logs for items
    const stockLogsRows = items.map(item => ({
      product_id: item.id,
      product_name: item.name,
      change_qty: -item.quantity,
      type: "sale",
      timestamp: dateAdded || new Date().toISOString(),
      operator_name: cashierName,
      notes: `Sold via checkout receipt ${receiptNumber}`
    }));

    const { error: slErr } = await supabaseAdmin
      .from("stock_logs")
      .insert(stockLogsRows);

    if (slErr) throw new Error(`Failed to write stock logs: ${slErr.message}`);

    // Create server-side audit log
    await insertAuditLog(
      user.id,
      cashierName,
      "SALE_CHECKOUT",
      `Completed Checkout receipt ${receiptNumber} worth KES ${subtotal} via ${paymentMethod}.`
    );

    return res.json(insertedSale);

  } catch (err: any) {
    console.error("[Sales API] Checkout transaction error:", err);
    return res.status(500).json({ error: "Checkout transaction failed on the server.", details: err.message });
  }
});

// --- 1g. Stock Logs API Routes ---
app.get("/api/stock-logs", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  try {
    let query = supabaseAdmin.from("stock_logs").select("*");
    
    if (user.role === 'cashier') {
      // Cashiers see only stock logs created today (Nairobi timezone UTC+3)
      const nowNairobi = new Date(new Date().getTime() + 3 * 60 * 60 * 1000);
      const startOfDay = new Date(Date.UTC(nowNairobi.getUTCFullYear(), nowNairobi.getUTCMonth(), nowNairobi.getUTCDate(), 0, 0, 0));
      const startUtc = new Date(startOfDay.getTime() - 3 * 60 * 60 * 1000).toISOString();
      
      query = query.gte("timestamp", startUtc);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch stock logs.", details: err.message });
  }
});

app.post("/api/stock-logs/adjust", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id, productId, restockQty, changeQty, type, notes, expiryDate } = req.body;
  const user = (req as any).user;

  if (!productId || !type) {
    return res.status(400).json({ error: "productId and adjustment type are required." });
  }

  try {
    // 1. Fetch current product details
    const { data: product, error: pErr } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (pErr || !product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const todayISO = new Date().toISOString();

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const operatorName = adminProfile?.full_name || user.username;

    if (product.expiry_date && type === 'restock') {
      // Create new batch line (creates a separate product row)
      const newProductId = crypto.randomUUID();
      const newProductRow = {
        name: product.name,
        category: product.category,
        barcode: product.barcode,
        buying_price: product.buying_price,
        selling_price: product.selling_price,
        quantity_in_stock: restockQty || changeQty,
        supplier_name: product.supplier_name,
        description: product.description,
        image_url: product.image_url,
        expiry_date: expiryDate || product.expiry_date,
        date_added: todayISO
      };

      const { data: insertedProduct, error: npErr } = await supabaseAdmin
        .from("products")
        .insert([newProductRow])
        .select()
        .single();
      if (npErr) throw npErr;

      // Insert stock log for initial batch
      const stockLogRow = {
        id: id || undefined,
        product_id: insertedProduct.id,
        product_name: product.name,
        change_qty: restockQty || changeQty,
        type: "initial",
        timestamp: todayISO,
        operator_name: operatorName,
        notes: `Separate batch restocked (Expiry: ${newProductRow.expiry_date}). ${notes || ""}`
      };

      const { error: slErr } = await supabaseAdmin.from("stock_logs").insert([stockLogRow]);
      if (slErr) throw slErr;

      await insertAuditLog(
        user.id,
        operatorName,
        "STOCK_ADJUSTMENT",
        `Created new product batch line for "${product.name}" with +${restockQty || changeQty} units expiring on ${newProductRow.expiry_date}.`
      );

      return res.json(insertedProduct);
    } else {
      // Standard restock / discard
      let newQty = product.quantity_in_stock;
      let finalChange = changeQty || 0;

      if (type === 'restock') {
        finalChange = restockQty || changeQty;
        newQty = product.quantity_in_stock + finalChange;
      } else if (type === 'discard_expired') {
        finalChange = -product.quantity_in_stock;
        newQty = 0;
      } else if (type === 'adjustment') {
        newQty = product.quantity_in_stock + finalChange;
      }

      const { data: updatedProduct, error: upErr } = await supabaseAdmin
        .from("products")
        .update({
          quantity_in_stock: newQty,
          ...(expiryDate ? { expiry_date: expiryDate } : {})
        })
        .eq("id", productId)
        .select()
        .single();
      if (upErr) throw upErr;

      // Insert stock log
      const stockLogRow = {
        id: id || undefined,
        product_id: productId,
        product_name: product.name,
        change_qty: finalChange,
        type: type,
        timestamp: todayISO,
        operator_name: operatorName,
        notes: expiryDate ? `${notes || ""} (Expiry: ${expiryDate})` : notes || ""
      };

      const { error: slErr } = await supabaseAdmin.from("stock_logs").insert([stockLogRow]);
      if (slErr) throw slErr;

      await insertAuditLog(
        user.id,
        operatorName,
        "STOCK_ADJUSTMENT",
        `Adjusted stock of "${product.name}" by ${finalChange > 0 ? "+" : ""}${finalChange} units (Type: ${type}).`
      );

      return res.json(updatedProduct);
    }
  } catch (err: any) {
    console.error("[Stock API] Stock adjustment failed:", err);
    return res.status(500).json({ error: "Stock adjustment failed on the server.", details: err.message });
  }
});

// --- 1h. Expenses API Routes ---
app.get("/api/expenses", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("expenses").select("*");
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch expenses.", details: err.message });
  }
});

app.post("/api/expenses", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id, category, itemName, amount, date, notes } = req.body;
  const adminUser = (req as any).user;

  if (!category || !itemName || amount === undefined) {
    return res.status(400).json({ error: "category, itemName, and amount are required." });
  }

  try {
    const expenseRow = {
      id: id || undefined,
      category,
      item_name: itemName,
      amount,
      date: date || new Date().toISOString().split("T")[0],
      notes: notes || null,
      recorded_by: adminUser.username,
      timestamp: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from("expenses")
      .insert([expenseRow])
      .select()
      .single();
    if (error) throw error;

    await insertAuditLog(
      adminUser.id,
      adminUser.username,
      "EXPENSE_CREATE",
      `Recorded overhead expense of KES ${amount} for "${itemName}" under "${category}".`
    );
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to save expense record.", details: err.message });
  }
});

// --- 1i. Suppliers API Routes ---
app.get("/api/suppliers", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("suppliers").select("*");
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch suppliers.", details: err.message });
  }
});

app.post("/api/suppliers", authenticateToken, requireRole("admin"), async (req, res) => {
  const { id, name, phone, email, location, productsSupplied } = req.body;
  const adminUser = (req as any).user;

  if (!name) return res.status(400).json({ error: "Supplier name is required." });

  try {
    const supplierRow = {
      id: id || undefined,
      name,
      phone: phone || null,
      email: email || null,
      location: location || null,
      products_supplied: productsSupplied || []
    };

    const { data, error } = await supabaseAdmin
      .from("suppliers")
      .insert([supplierRow])
      .select()
      .single();
    if (error) throw error;

    await insertAuditLog(adminUser.id, adminUser.username, "SUPPLIER_CREATE", `Registered new wholesale supplier "${name}".`);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to save supplier details.", details: err.message });
  }
});

// --- 1j. Audit Logs API Routes ---
app.get("/api/audit-logs", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .order("timestamp", { ascending: false });
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch audit logs.", details: err.message });
  }
});

// --- 1k. Dedicated Audit Log Delete (Wipe) Endpoint ---
// Mirrors the same PIN + date-range + backup-payload protection used by /api/data/wipe for other tables.
// IMPORTANT DESIGN NOTE: the backup is written as a brand-new DATABASE_WIPE row AFTER the deletion.
// That new row's timestamp is always "now", which is outside any historical date range being erased,
// so the restore_payload is never accidentally destroyed by the same wipe operation.
app.delete("/api/audit-logs", authenticateToken, requireRole("admin"), async (req, res) => {
  const { confirmPin, startDate, endDate } = req.body;
  const adminUser = (req as any).user;

  if (!confirmPin) {
    return res.status(400).json({ error: "confirmPin is required." });
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required." });
  }

  try {
    // 1. Verify PIN against admin profile
    const { data: profile, error: pError } = await supabaseAdmin
      .from("profiles")
      .select("pin")
      .eq("id", adminUser.id)
      .single();

    if (pError || !profile) {
      return res.status(401).json({ error: "Verification failed. Admin profile not found." });
    }

    if (!bcrypt.compareSync(confirmPin, profile.pin)) {
      await insertAuditLog(
        adminUser.id,
        adminUser.username,
        "WIPE_ATTEMPT_FAILED",
        `Incorrect PIN entered for bulk delete on section "audit".`
      );
      return res.status(401).json({ error: "Invalid confirmation PIN." });
    }

    const startIso = new Date(startDate).toISOString();
    const endIso = new Date(endDate).toISOString();

    // 2. Fetch rows within range to back them up before deletion
    const { data: auditRows, error: aErr } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .gte("timestamp", startIso)
      .lte("timestamp", endIso);

    if (aErr) throw aErr;

    const count = auditRows?.length || 0;

    if (count === 0) {
      return res.json({
        message: "No audit log records found within the specified range. No action taken.",
        count: 0
      });
    }

    // 3. Delete rows in range
    const { error: daErr } = await supabaseAdmin
      .from("audit_logs")
      .delete()
      .gte("timestamp", startIso)
      .lte("timestamp", endIso);

    if (daErr) throw daErr;

    // 4. Write a NEW DATABASE_WIPE audit entry (timestamp = now, outside the deleted range)
    //    embedding the restore_payload so it can be recovered via POST /api/audit-logs/restore.
    const restorePayload = JSON.stringify({ section: "audit", data: { auditLogs: auditRows } });
    const logDetails = `Security Audit Logs wiped clean by administrator override. Range: ${startDate} to ${endDate}. Version backup created.`;
    await insertAuditLog(adminUser.id, adminUser.username, "DATABASE_WIPE", logDetails, restorePayload);

    return res.json({
      success: true,
      message: `Successfully wiped ${count} audit log records and created a restore backup.`,
      count
    });

  } catch (err: any) {
    console.error("[Audit Wipe API] Wipe failed:", err);
    return res.status(500).json({ error: "Audit log wipe operation failed.", details: err.message });
  }
});

// --- 1k. Secure Bulk Delete (Wipe) Endpoint ---
app.post("/api/data/wipe", authenticateToken, requireRole("admin"), async (req, res) => {
  const { section, confirmPin, startDate, endDate } = req.body;
  const adminUser = (req as any).user;

  if (!section || !confirmPin) {
    return res.status(400).json({ error: "Section and PIN are required." });
  }

  if (section !== 'suppliers' && (!startDate || !endDate)) {
    return res.status(400).json({ error: "startDate and endDate are required for date-ranged deletions." });
  }

  try {
    // 1. Verify PIN against admin user profile
    const { data: profile, error: pError } = await supabaseAdmin
      .from("profiles")
      .select("pin")
      .eq("id", adminUser.id)
      .single();

    if (pError || !profile) {
      return res.status(401).json({ error: "Verification failed. Admin profile not found." });
    }

    if (!bcrypt.compareSync(confirmPin, profile.pin)) {
      await insertAuditLog(adminUser.id, adminUser.username, "WIPE_ATTEMPT_FAILED", `Incorrect PIN entered for bulk delete on section "${section}".`);
      return res.status(401).json({ error: "Invalid confirmation PIN." });
    }

    let count = 0;
    let rowsToBackup: any = null;
    let label = "";

    // Calculate Iso bounds
    const startIso = startDate ? new Date(startDate).toISOString() : "";
    const endIso = endDate ? new Date(endDate).toISOString() : "";

    // 2. Select rows & define delete query
    if (section === 'sales') {
      label = "Sales & Stock Logs";
      const { data: salesRows, error: sErr } = await supabaseAdmin
        .from("sales")
        .select("*")
        .gte("date_added", startIso)
        .lte("date_added", endIso);
      if (sErr) throw sErr;

      const { data: stockRows, error: slErr } = await supabaseAdmin
        .from("stock_logs")
        .select("*")
        .gte("timestamp", startIso)
        .lte("timestamp", endIso);
      if (slErr) throw slErr;

      rowsToBackup = { sales: salesRows || [], stockLogs: stockRows || [] };
      count = (salesRows?.length || 0) + (stockRows?.length || 0);

      if (count > 0) {
        const { error: dsErr } = await supabaseAdmin
          .from("sales")
          .delete()
          .gte("date_added", startIso)
          .lte("date_added", endIso);
        if (dsErr) throw dsErr;

        const { error: dslErr } = await supabaseAdmin
          .from("stock_logs")
          .delete()
          .gte("timestamp", startIso)
          .lte("timestamp", endIso);
        if (dslErr) throw dslErr;
      }
    } else if (section === 'products') {
      label = "Products Catalog";
      const { data: productsRows, error: prErr } = await supabaseAdmin
        .from("products")
        .select("*")
        .gte("date_added", startIso)
        .lte("date_added", endIso);
      if (prErr) throw prErr;

      rowsToBackup = { products: productsRows || [] };
      count = productsRows?.length || 0;

      if (count > 0) {
        const { error: dpErr } = await supabaseAdmin
          .from("products")
          .delete()
          .gte("date_added", startIso)
          .lte("date_added", endIso);
        if (dpErr) throw dpErr;
      }
    } else if (section === 'expenses') {
      label = "Expenses Ledger";
      const { data: expensesRows, error: eErr } = await supabaseAdmin
        .from("expenses")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate);
      if (eErr) throw eErr;

      rowsToBackup = { expenses: expensesRows || [] };
      count = expensesRows?.length || 0;

      if (count > 0) {
        const { error: deErr } = await supabaseAdmin
          .from("expenses")
          .delete()
          .gte("date", startDate)
          .lte("date", endDate);
        if (deErr) throw deErr;
      }
    } else if (section === 'suppliers') {
      label = "Suppliers Registry";
      // Suppliers has no date column, delete all
      const { data: suppliersRows, error: supErr } = await supabaseAdmin
        .from("suppliers")
        .select("*");
      if (supErr) throw supErr;

      rowsToBackup = { suppliers: suppliersRows || [] };
      count = suppliersRows?.length || 0;

      if (count > 0) {
        const { error: dSupErr } = await supabaseAdmin
          .from("suppliers")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all
        if (dSupErr) throw dSupErr;
      }
    } else if (section === 'audit') {
      label = "Security Audit Logs";
      const { data: auditRows, error: aErr } = await supabaseAdmin
        .from("audit_logs")
        .select("*")
        .gte("timestamp", startIso)
        .lte("timestamp", endIso);
      if (aErr) throw aErr;

      rowsToBackup = { auditLogs: auditRows || [] };
      count = auditRows?.length || 0;

      if (count > 0) {
        const { error: daErr } = await supabaseAdmin
          .from("audit_logs")
          .delete()
          .gte("timestamp", startIso)
          .lte("timestamp", endIso);
        if (daErr) throw daErr;
      }
    }

    if (count === 0) {
      return res.json({ message: "No records found within the specified range. No action taken.", count: 0 });
    }

    // Create backup payload
    const restorePayload = JSON.stringify({ section, data: rowsToBackup });
    const logDetails = `${label} wiped clean by administrator override. Range: ${startDate || 'All'} to ${endDate || 'All'}. Version backup created.`;
    
    // Insert backup record in audit_logs (happens AFTER the delete is completed)
    await insertAuditLog(adminUser.id, adminUser.username, "DATABASE_WIPE", logDetails, restorePayload);

    return res.json({ success: true, message: `Successfully wiped ${count} records from ${label} and created restore backup.`, count });

  } catch (err: any) {
    console.error(`[Wipe API] Wipe failed for section ${section}:`, err);
    return res.status(500).json({ error: "Wipe operation failed.", details: err.message });
  }
});

// --- 1l. Secure Audit Restore Endpoint ---
app.post("/api/audit-logs/restore", authenticateToken, requireRole("admin"), async (req, res) => {
  const { auditLogId, confirmPin } = req.body;
  const adminUser = (req as any).user;

  if (!auditLogId || !confirmPin) {
    return res.status(400).json({ error: "auditLogId and PIN are required." });
  }

  try {
    // 1. Verify PIN against admin user profile
    const { data: profile, error: pError } = await supabaseAdmin
      .from("profiles")
      .select("pin")
      .eq("id", adminUser.id)
      .single();

    if (pError || !profile) {
      return res.status(401).json({ error: "Verification failed. Admin profile not found." });
    }

    if (!bcrypt.compareSync(confirmPin, profile.pin)) {
      await insertAuditLog(adminUser.id, adminUser.username, "RESTORE_ATTEMPT_FAILED", `Incorrect PIN entered for restore on audit log ${auditLogId}`);
      return res.status(401).json({ error: "Invalid confirmation PIN." });
    }

    // 2. Fetch the specific audit log row
    const { data: log, error: lError } = await supabaseAdmin
      .from("audit_logs")
      .select("details")
      .eq("id", auditLogId)
      .single();

    if (lError || !log) {
      return res.status(404).json({ error: "Audit log entry not found." });
    }

    // Parse the restore payload
    let details = log.details || "";
    if (!details.includes(" |__RESTORE_PAYLOAD__| ")) {
      return res.status(400).json({ error: "Selected audit log does not contain a restorable backup payload." });
    }

    const payloadStr = details.split(" |__RESTORE_PAYLOAD__| ")[1];
    const { section, data } = JSON.parse(payloadStr);

    let count = 0;

    // Helper to drop database fields generated by database defaults if they conflict (e.g. raw insert)
    const sanitizeForUpsert = (row: any) => {
      const copy = { ...row };
      return copy;
    };

    // 3. Re-insert records
    if (section === 'sales') {
      const salesData = data.sales || [];
      const stockData = data.stockLogs || [];

      if (salesData.length > 0) {
        const { error: sErr } = await supabaseAdmin.from("sales").upsert(salesData.map(sanitizeForUpsert));
        if (sErr) throw sErr;
        count += salesData.length;
      }
      if (stockData.length > 0) {
        const { error: slErr } = await supabaseAdmin.from("stock_logs").upsert(stockData.map(sanitizeForUpsert));
        if (slErr) throw slErr;
        count += stockData.length;
      }
    } else if (section === 'products') {
      const productsData = data.products || [];
      if (productsData.length > 0) {
        const { error: prErr } = await supabaseAdmin.from("products").upsert(productsData.map(sanitizeForUpsert));
        if (prErr) throw prErr;
        count += productsData.length;
      }
    } else if (section === 'expenses') {
      const expensesData = data.expenses || [];
      if (expensesData.length > 0) {
        const { error: eErr } = await supabaseAdmin.from("expenses").upsert(expensesData.map(sanitizeForUpsert));
        if (eErr) throw eErr;
        count += expensesData.length;
      }
    } else if (section === 'suppliers') {
      const suppliersData = data.suppliers || [];
      if (suppliersData.length > 0) {
        const { error: supErr } = await supabaseAdmin.from("suppliers").upsert(suppliersData.map(sanitizeForUpsert));
        if (supErr) throw supErr;
        count += suppliersData.length;
      }
    } else if (section === 'audit') {
      const auditData = data.auditLogs || [];
      if (auditData.length > 0) {
        const { error: aErr } = await supabaseAdmin.from("audit_logs").upsert(auditData.map(sanitizeForUpsert));
        if (aErr) throw aErr;
        count += auditData.length;
      }
    }

    // Log restore action in audit trail
    await insertAuditLog(
      adminUser.id,
      adminUser.username,
      "DATABASE_RESTORE",
      `Restored ${count} records for section "${section}" using restore backup ID ${auditLogId}`
    );

    return res.json({ success: true, message: `Successfully restored ${count} records for "${section}".`, count });

  } catch (err: any) {
    console.error(`[Restore API] Restore failed for audit log ${auditLogId}:`, err);
    return res.status(500).json({ error: "Restore operation failed.", details: err.message });
  }
});


// Helper function to synthesize content with retry logic and a fallback model in case of high demand (503)
async function generateReportWithFallback(ai: GoogleGenAI, contents: string, config: any): Promise<any> {
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    // Retry up to 2 times for each model to handle transient spikes or rate limits
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI Report Engine] Attempting generation with model=${model} (Attempt ${attempt}/2)`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });
        console.log(`[AI Report Engine] Generation succeeded using model=${model}`);
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Report Engine] Model option "${model}" failed (Attempt ${attempt}/2): ${err.message || err}`);
        
        // Wait briefly (1.5 seconds) before retrying or switching models
        if (attempt < 2 || model !== modelsToTry[modelsToTry.length - 1]) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }
  }

  throw lastError;
}

// 2. Core API Endpoint: Generate AI Business Report
app.post("/api/reports/generate", rateLimiter, async (req, res) => {
  try {
    const { sales = [], products = [], expenses = [], type = "monthly" } = req.body;
    const clientKey = req.headers["x-gemini-key"] as string;

    console.log(`[AI Report Engine] Request received. Type: ${type}, Sales count: ${sales.length}, Products count: ${products.length}, Expenses count: ${expenses.length}`);

    let ai;
    try {
      ai = getGeminiClient(clientKey);
    } catch (kErr: any) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY is not configured on the server.",
        details: kErr.message 
      });
    }

    // Map the structures to lean formats to avoid token bloat and accelerate processing
    const leanProducts = products.map((p: any) => ({
      name: p.name,
      category: p.category,
      buyingPrice: p.buyingPrice,
      sellingPrice: p.sellingPrice,
      quantityInStock: p.quantityInStock
    }));

    const leanSales = sales.map((s: any) => ({
      receiptNumber: s.receiptNumber,
      dateAdded: s.dateAdded,
      total: s.total,
      discount: s.discount || 0,
      paymentMethod: s.paymentMethod,
      items: Array.isArray(s.items) ? s.items.map((it: any) => ({
        name: it.name,
        quantity: it.quantity,
        sellingPrice: it.sellingPrice || 0,
        buyingPrice: it.buyingPrice || 0
      })) : []
    }));

    const leanExpenses = expenses.map((e: any) => ({
      category: e.category,
      itemName: e.itemName,
      amount: e.amount,
      date: e.date
    }));

    const dataPrompt = `You are an expert senior business growth consultant and financial analyst for physical supermarkets and retail shops in Kenya.
Analyze the following store's business transactional data and inventory records to produce a highly detailed, professional, and actionable business intelligence report.

The owner wants a very thorough, data-driven analysis including graphs, statistics, and forecasts.

- REPORT TIMEFRAME TYPE: ${type === "weekly" ? "Weekly Business Audit" : "Monthly Business Audit (Highly Detailed)"}
- CURRENCY: Kenyan Shillings (KES)
- PRODUCT INVENTORY LIST: ${JSON.stringify(leanProducts)}
- SALES RECORDS: ${JSON.stringify(leanSales)}
- OPERATIONAL EXPENSES RECORD: ${JSON.stringify(leanExpenses)}

Analyze these details and supply a comprehensive report containing:
1. Exact total revenue, total profit (revenue minus buying cost of items sold), total discounts given, and total operational expenses.
2. Low Stock & Restocking Plan: Identify which products are low in stock (inventory <= 15 or <= 5) and suggest precise restock quantities with priority.
3. Sales Velocity Segmentation: Group products into:
   - "highSales" (high quantities sold, rapid turnover)
   - "middleSales" (moderate quantities sold)
   - "lowSales" (stagnant/slow-moving shelf items with low or zero sales)
4. A highly detailed markdown text report with sections exploring these aspects, assessing trends, showing discount impacts, presenting expected financial forecasts, and recommended activities for next month.
5. High-quality numerical trend data for charts:
   - \`dailyTrend\`: Daily breakdown of revenue and profit.
   - \`categoryShare\`: Sales volume and gross profits broken down by product category.
   - \`forecastTrend\`: Simulated future performance projection labels (e.g. Week 1, Week 2, Week 3, Week 4) showing expected vs target growth revenue based on current trends.

Please respond with a strictly formatted JSON object adhering exactly to the schema requested.`;

    const response = await generateReportWithFallback(ai, dataPrompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
          properties: {
            summary: { 
              type: Type.STRING, 
              description: "A solid, professional 2-3 sentence executive breakdown of the business health." 
            },
            reportMarkdown: { 
              type: Type.STRING, 
              description: "A comprehensive, beautifully structured business report in markdown. Must be highly detailed, particularly for Monthly reports. Include exact statistics, financial interpretations, expected business outcomes, and tactical recommendations for the following month." 
            },
            analytics: {
              type: Type.OBJECT,
              properties: {
                totalRevenue: { type: Type.NUMBER },
                totalProfit: { type: Type.NUMBER },
                totalDiscounts: { type: Type.NUMBER },
                totalExpenses: { type: Type.NUMBER },
                lowStockReplenishList: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      currentStock: { type: Type.NUMBER },
                      recommendedReplenishQty: { type: Type.NUMBER },
                      priority: { type: Type.STRING, description: "High, Medium, or Low" }
                    },
                    required: ["name", "currentStock", "recommendedReplenishQty", "priority"]
                  }
                },
                itemVelocity: {
                  type: Type.OBJECT,
                  properties: {
                    highSales: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          qtySold: { type: Type.NUMBER },
                          revenue: { type: Type.NUMBER }
                        },
                        required: ["name", "qtySold", "revenue"]
                      }
                    },
                    middleSales: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          qtySold: { type: Type.NUMBER },
                          revenue: { type: Type.NUMBER }
                        },
                        required: ["name", "qtySold", "revenue"]
                      }
                    },
                    lowSales: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          qtySold: { type: Type.NUMBER },
                          revenue: { type: Type.NUMBER }
                        },
                        required: ["name", "qtySold", "revenue"]
                      }
                    }
                  },
                  required: ["highSales", "middleSales", "lowSales"]
                }
              },
              required: ["totalRevenue", "totalProfit", "totalDiscounts", "totalExpenses", "lowStockReplenishList", "itemVelocity"]
            },
            charts: {
              type: Type.OBJECT,
              properties: {
                dailyTrend: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      date: { type: Type.STRING, description: "YYYY-MM-DD or abbreviated text day (e.g. June 8)" },
                      revenue: { type: Type.NUMBER },
                      profit: { type: Type.NUMBER }
                    },
                    required: ["date", "revenue", "profit"]
                  }
                },
                categoryShare: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: { type: Type.STRING },
                      revenue: { type: Type.NUMBER },
                      profit: { type: Type.NUMBER }
                    },
                    required: ["category", "revenue", "profit"]
                  }
                },
                forecastTrend: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING, description: "e.g. Next Week, Month +1, Month +2" },
                      expectedRevenue: { type: Type.NUMBER },
                      targetRevenue: { type: Type.NUMBER }
                    },
                    required: ["label", "expectedRevenue", "targetRevenue"]
                  }
                }
              },
              required: ["dailyTrend", "categoryShare", "forecastTrend"]
            }
          },
          required: ["summary", "reportMarkdown", "analytics", "charts"]
        }
      });

    let rawText = response.text || "";
    console.log("[AI Report Engine] Raw AI response text length:", rawText.length);

    let cleanText = rawText.trim();
    if (cleanText.includes("```json")) {
      cleanText = cleanText.split("```json")[1].split("```")[0].trim();
    } else if (cleanText.startsWith("```")) {
      const firstLineBreak = cleanText.indexOf("\n");
      const lastBackticks = cleanText.lastIndexOf("```");
      if (firstLineBreak !== -1 && lastBackticks !== -1) {
        cleanText = cleanText.substring(firstLineBreak, lastBackticks).trim();
      }
    }

    try {
      const reportJSON = JSON.parse(cleanText || "{}");
      res.json(reportJSON);
    } catch (parseErr: any) {
      console.error("[AI Report Engine] JSON parsing failed! Raw text was:", rawText);
      res.status(500).json({
        error: "Failed to parse AI-synthesized database report. Format invalid.",
        details: parseErr.message,
        rawResponse: rawText.substring(0, 500)
      });
    }
  } catch (err: any) {
    console.error("Gemini report generation failure:", err);
    res.status(500).json({ 
      error: "Unable to synthesize report contents.",
      details: err.message 
    });
  }
});

// Configure Vite middleware for dev or regular static file serving for prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import to prevent loading Vite in production runtime builds
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on port ${PORT}`);
  });
}

startServer();
