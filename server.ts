import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up larger payload limits for complete data uploads to report generator
app.use(express.json({ limit: "30mb" }));

// Lazy-initialized Gemini Client (ensures the key is read when the function is actually called)
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server. Please add your key to Secrets in Settings.");
  }
  if (!aiClient) {
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
app.post("/api/reports/generate", async (req, res) => {
  try {
    const { sales = [], products = [], expenses = [], type = "monthly" } = req.body;

    console.log(`[AI Report Engine] Request received. Type: ${type}, Sales count: ${sales.length}, Products count: ${products.length}, Expenses count: ${expenses.length}`);

    let ai;
    try {
      ai = getGeminiClient();
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
