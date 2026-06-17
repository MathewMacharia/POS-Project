import { jsPDF } from "jspdf";
import { Product, ShopSettings, User, Sale } from "../types";

export function generateDatabasePDF(
  products: Product[],
  settings: ShopSettings,
  currentUser: User | null
) {
  // Initialize A4 PDF: portrait, millimeters, a4 (210mm x 297mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const timeStr = now.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  // Calculate high-level stats
  const totalItems = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + p.quantityInStock, 0);
  const totalValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.quantityInStock), 0);
  const totalCostValue = products.reduce((sum, p) => sum + (p.buyingPrice * p.quantityInStock), 0);

  // Helper formatting function
  const formatKES = (num: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  let pageNum = 1;

  // Header and Footer drawer function
  const drawPageDecorations = (pdf: jsPDF, pageIndex: number) => {
    // 1. Subtle Header Line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.line(15, 12, 195, 12);

    // Header Meta
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(settings.shopName || "DUFUKA POINT OF SALE", 15, 9);
    pdf.text("OFFICIAL SYSTEM LEDGER STATEMENT", 195, 9, { align: "right" });

    // 2. Footer Line
    pdf.line(15, 282, 195, 282);

    // Footer Text
    pdf.setFontSize(7.5);
    pdf.setTextColor(140, 140, 140);
    pdf.text("CONFIDENTIAL - FOR INTERNAL AUDITING PURPOSES ONLY", 15, 287);
    pdf.text(`Printed: ${dateStr} at ${timeStr} | Operator: ${currentUser?.fullName || "System Admin"} (${currentUser?.role || "admin"})`, 105, 287, { align: "center" });
    pdf.text(`Page ${pageIndex}`, 195, 287, { align: "right" });
  };

  // ----- MAIN PAGE 1 INITIALIZATION -----
  drawPageDecorations(doc, pageNum);

  // Shop Name & Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // zinc-800
  doc.text(settings.shopName || "DUFUKA POS & RETAIL", 15, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(settings.shopAddress || "Nairobi, Kenya", 15, 29);
  doc.text(`Contact: ${settings.shopPhone || "+254 POS System"}`, 15, 34);
  if (settings.taxRegistrationNumber) {
    doc.text(`PIN/TAX Reg: ${settings.taxRegistrationNumber}`, 15, 39);
  }

  // Right-aligned Statement Information (Standard Bank Statement Header)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 118, 110); // teal-700
  doc.text("STATEMENT SECURE RUN", 195, 24, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const stmtRef = `STMT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  doc.text(`Ref Number:  ${stmtRef}`, 195, 29, { align: "right" });
  doc.text(`Run Date:    ${dateStr}`, 195, 34, { align: "right" });
  doc.text(`Run Time:    ${timeStr}`, 195, 39, { align: "right" });

  // Draw elegant divider
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.8);
  doc.line(15, 43, 195, 43);

  // SUMMARY BLOCK (Grid-like presentation cards)
  doc.setFillColor(248, 250, 252); // extremely light zinc bg
  doc.rect(15, 48, 180, 24, "F");
  doc.setDrawColor(226, 232, 240); // slate-200 border
  doc.rect(15, 48, 180, 24, "S");

  // Summary labels & values
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("TOTAL PRODUCTS", 25, 54);
  doc.text("TOTAL STOCK UNITS", 65, 54);
  doc.text("TOTAL BUYING VALUE", 110, 54);
  doc.text("POTENTIAL SHELF VALUE", 155, 54);

  // Values using Courier / Helvetica bold for financial feel
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(String(totalItems), 25, 63);
  doc.text(String(totalQuantity), 65, 63);
  
  doc.setFont("courier", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(120, 113, 108); // stone-500
  doc.text(`${formatKES(totalCostValue)} KES`, 110, 63);
  
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(`${formatKES(totalValue)} KES`, 155, 63);

  // Draw Statement Products Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 118, 110);
  doc.text("OFFICIAL INVENTORY LEDGER / RECORD ROW INDEX", 15, 80);

  // TABLE COLUMN POSITIONS (Left Margins & Dimensions)
  const xId = 15;        // Product ID & added date (Width: 35mm)
  const xDesc = 50;      // Product Title, Category, Supplier (Width: 72mm)
  const xQty = 122;      // Quantity In Stock (Width: 15mm)
  const xRetail = 137;   // Retail Unit Price (Width: 26mm)
  const xValue = 163;    // Total Line Value (Width: 32mm)

  // Write Table Header
  let y = 85;
  doc.setFillColor(30, 41, 59); // Dark navy/slate header background
  doc.rect(15, y, 180, 7.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255); // White text
  doc.text("DATE / SYSTEM ID", xId + 2, y + 5);
  doc.text("ITEM DESCRIPTION & ATTRIBUTES", xDesc + 2, y + 5);
  doc.text("QTY", xQty + 2, y + 5);
  doc.text("RETAIL PRICE", xRetail + 2, y + 5);
  doc.text("TOTAL VALUE", xValue + 2, y + 5);

  y += 7.5; // Offset header height

  // Write Table Data Rows
  products.forEach((product, idx) => {
    // Check page boundaries: maximum y height should be ~270 to ensure padding before footer
    if (y > 265) {
      // Create new page
      doc.addPage();
      pageNum++;
      drawPageDecorations(doc, pageNum);

      y = 20; // reset y offset for new page
      // Draw standard table headers again
      doc.setFillColor(30, 41, 59);
      doc.rect(15, y, 180, 7.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("DATE / SYSTEM ID", xId + 2, y + 5);
      doc.text("ITEM DESCRIPTION & ATTRIBUTES", xDesc + 2, y + 5);
      doc.text("QTY", xQty + 2, y + 5);
      doc.text("RETAIL PRICE", xRetail + 2, y + 5);
      doc.text("TOTAL VALUE", xValue + 2, y + 5);

      y += 7.5;
    }

    // Zebra striping representation
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251); // gray-50
      doc.rect(15, y, 180, 11, "F");
    }

    // Subtle horizontal separator row line
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.15);
    doc.line(15, y + 11, 195, y + 11);

    // Columns output
    // 1. DATE / SYSTEM ID
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(product.id, xId + 2, y + 5);
    
    // date added underneath
    const addedDate = product.dateAdded ? product.dateAdded.substring(0, 10) : "N/A";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(addedDate, xId + 2, y + 9);

    // 2. ITEM DESCRIPTION: wrap long strings to fit within 68mm
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    
    // Split text into lines of max 68mm
    const splitName = doc.splitTextToSize(product.name, 68);
    // Draw the product name line (first line always, second line if wrapped)
    doc.text(splitName[0] || "", xDesc + 2, y + 5);

    // Underneath label style for attributes: Category & Barcode
    const attribLabel = `${product.category} | SKU: ${product.barcode || "N/A"}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(115, 115, 115);
    
    if (splitName.length > 1) {
      // If name was too long and wrapped, append name line 2 and attributes lower down
      doc.setFont("helvetica", "bold");
      doc.text(splitName[1] + "..", xDesc + 2, y + 7.5);
      doc.setFont("helvetica", "normal");
      doc.text(attribLabel, xDesc + 2, y + 9.8);
    } else {
      // Standard layout
      doc.text(attribLabel, xDesc + 2, y + 9);
    }

    // 3. QTY: draw in standard format, highlight in red if <= 0
    doc.setFont("courier", "bold");
    doc.setFontSize(8.5);
    if (product.quantityInStock <= 0) {
      doc.setTextColor(239, 68, 68); // Red for out of stock
      doc.text(`${product.quantityInStock} (OUT)`, xQty + 2, y + 7);
    } else if (product.quantityInStock <= 5) {
      doc.setTextColor(245, 158, 11); // Amber for low stock
      doc.text(`${product.quantityInStock} (LOW)`, xQty + 2, y + 7);
    } else {
      doc.setTextColor(30, 41, 59);
      doc.text(String(product.quantityInStock), xQty + 2, y + 7);
    }

    // 4. Retail Price (Unit Price)
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(64, 64, 64);
    doc.text(formatKES(product.sellingPrice), xRetail + 2, y + 7);

    // 5. Total Value
    doc.setFont("courier", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const itemValuation = product.sellingPrice * product.quantityInStock;
    doc.text(formatKES(itemValuation), xValue + 2, y + 7);

    y += 11; // advance page row height
  });

  // End of statement summary line
  if (y > 255) {
    // Append blank page for signature/sign-off
    doc.addPage();
    pageNum++;
    drawPageDecorations(doc, pageNum);
    y = 20;
  }

  // Draw final visual summary ledger block
  y += 10;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(15, y, 195, y);

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("LEDGER END VERIFICATION & SIGN-OFF", 15, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text(`This statement acts as an official system stock verification snapshot containing exactly ${totalItems} unique listings across current shop settings with standard local auditing. Checkouts, refunds, or restock operations will automatically update subsequent runs.`, 15, y, { maxWidth: 180 });

  // Add standard signature lines like a true banks statement
  y += 16;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(25, y, 85, y);
  doc.line(125, y, 185, y);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(115, 115, 115);
  doc.text("AUTHORIZED CLERK SIGNATURE", 55, y, { align: "center" });
  doc.text("STORE MANAGER / AUDITOR SIGN-OFF", 155, y, { align: "center" });

  doc.save(`Dufuka_POS_Database_Backup_${now.toISOString().slice(0, 10)}.pdf`);
}

export function generateReceiptPDF(sale: Sale, settings: ShopSettings) {
  // Estimate height: header (30), description (30), items (num * 8), summaries (30), footer (20)
  const width = 80; // 80mm standard receipt paper width
  const height = Math.max(160, 100 + (sale.items.length * 8) + 40);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [width, height]
  });

  const margin = 5;
  const printableWidth = width - (margin * 2);

  // Helper formatting function
  const formatKES = (num: number) => {
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  let y = 10;

  // Store Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59); // zinc-800
  doc.text(settings.shopName ? settings.shopName.toUpperCase() : "DUFUKA POINT OF SALE", width / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(settings.shopAddress || "Nairobi, Kenya", width / 2, y, { align: "center" });

  y += 4;
  doc.text(`Tel: ${settings.shopPhone || "+254 POS System"}`, width / 2, y, { align: "center" });

  if (settings.taxRegistrationNumber) {
    y += 4;
    doc.text(`PIN/TAX: ${settings.taxRegistrationNumber}`, width / 2, y, { align: "center" });
  }

  // Dashed divider line
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, width - margin, y);
  doc.setLineDashPattern([], 0); // Reset dash

  // Metadata block
  y += 4;
  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.setTextColor(64, 64, 64);
  doc.text(`RECEIPT NO: ${sale.receiptNumber}`, margin, y);
  
  y += 3.5;
  const dateStr = new Date(sale.dateAdded).toLocaleString("en-KE");
  doc.text(`DATE: ${dateStr}`, margin, y);

  y += 3.5;
  doc.text(`CASHIER: ${sale.cashierName.toUpperCase()}`, margin, y);

  y += 3.5;
  doc.text(`TERMINAL: POS-01 (SECURE)`, margin, y);

  // Dashed divider
  y += 2.5;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, width - margin, y);
  doc.setLineDashPattern([], 0); // Reset

  // Items Header
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("ITEM DESCRIPTION", margin, y);
  doc.text("QTY", 48, y);
  doc.text("TOTAL (KES)", width - margin, y, { align: "right" });

  // Double line/solid divider
  y += 1.5;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(margin, y, width - margin, y);

  y += 4;
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(64, 64, 64);

  sale.items.forEach((item) => {
    // Check if item name splits
    // Split text into lines of max 38mm width
    const splitName = doc.splitTextToSize(item.name.toUpperCase(), 38);
    const firstNameLine = splitName[0] || "";
    doc.text(firstNameLine, margin, y);
    doc.text(`x${item.quantity}`, 48, y);
    doc.text(formatKES(item.sellingPrice * item.quantity), width - margin, y, { align: "right" });

    if (splitName.length > 1) {
      y += 3;
      doc.text(splitName[1], margin, y);
    }
    
    // Add small unit price line underneath
    y += 3;
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`  @ KES ${formatKES(item.sellingPrice)}`, margin, y);

    // restore
    y += 4.5;
    doc.setFontSize(7.5);
    doc.setTextColor(64, 64, 64);
  });

  // Solid Divider
  y -= 1.5;
  doc.setLineWidth(0.2);
  doc.line(margin, y, width - margin, y);

  // Totals Area
  y += 4;
  if (sale.discount && sale.discount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("SUBTOTAL:", margin, y);
    doc.setFont("courier", "normal");
    doc.text(`${formatKES(sale.subtotal)} KES`, width - margin, y, { align: "right" });

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("DISCOUNT AMOUNT:", margin, y);
    doc.setFont("courier", "bold");
    doc.text(`-${formatKES(sale.discount)} KES`, width - margin, y, { align: "right" });

    y += 4.5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("GRAND TOTAL:", margin, y);
  
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.text(`${formatKES(sale.total)} KES`, width - margin, y, { align: "right" });

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`TAX (VAT 16% INC):`, margin, y);
  doc.text(`${formatKES(sale.taxAmount)} KES`, width - margin, y, { align: "right" });

  y += 4;
  doc.text(`PAYMENT METHOD:`, margin, y);
  doc.text(sale.paymentMethod.toUpperCase(), width - margin, y, { align: "right" });

  if (sale.paymentMethod === 'Cash') {
    y += 4;
    doc.text(`CASH TENDERED:`, margin, y);
    doc.text(`${formatKES(sale.paidAmount)} KES`, width - margin, y, { align: "right" });

    y += 4;
    doc.text(`CHANGE GIVEN:`, margin, y);
    doc.text(`${formatKES(sale.changeAmount)} KES`, width - margin, y, { align: "right" });
  } else {
    y += 4;
    doc.text(`REF CODE:`, margin, y);
    doc.setFont("courier", "normal");
    doc.text(sale.paymentDetailsRef || "N/A", width - margin, y, { align: "right" });
  }

  // Dashed separator
  y += 3;
  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, width - margin, y);
  doc.setLineDashPattern([], 0); // Reset

  // Message / Terms Headers
  y += 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(15, 118, 110); // teal-700
  doc.text("ASANTE SANA!", width / 2, y, { align: "center" });

  if (settings.receiptHeader) {
    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const splitReceiptHeader = doc.splitTextToSize(settings.receiptHeader, printableWidth);
    splitReceiptHeader.forEach((line: string) => {
      doc.text(line, width / 2, y, { align: "center" });
      y += 3;
    });
  }

  if (settings.receiptFooter) {
    y += 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(140, 140, 140);
    const splitReceiptFooter = doc.splitTextToSize(settings.receiptFooter, printableWidth);
    splitReceiptFooter.forEach((line: string) => {
      doc.text(line, width / 2, y, { align: "center" });
      y += 2.5;
    });
  }

  y += 2;
  doc.setFont("courier", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(180, 180, 180);
  doc.text("POWERED BY MSHIRIKI POS", width / 2, y, { align: "center" });

  doc.save(`Receipt-${sale.receiptNumber}.pdf`);
}
