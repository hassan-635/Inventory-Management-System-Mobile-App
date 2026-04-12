import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatProductId } from './formatProductId';

async function getShopSettings() {
    try {
        const str = await AsyncStorage.getItem('shop_settings');
        if (str) return JSON.parse(str);
    } catch {}
    return { name: 'Jellani Hardware Store', address: 'Main Kallar Syedan Road', phone: '0300-0000000' };
}

/** Readable, filesystem-safe piece for PDF names (customer name, period label, etc.) */
function pdfNamePart(raw, maxLen = 40) {
    const s = String(raw ?? 'Unknown')
        .trim()
        .replace(/[/\\?%*:|"<>]+/g, '-')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    const cut = s.slice(0, maxLen);
    return cut || 'Unknown';
}

// Extracted from Reports.css and Expenses.css (.pdf-mode-active classes)
const PDF_CSS = `
    body {
        font-family: 'Segoe UI', Arial, sans-serif !important;
        font-size: 13px !important;
        background: #ffffff !important;
        color: #0f172a !important;
        margin: 0;
        padding: 20px;
    }
    * { box-shadow: none !important; }
    h1 { font-size: 22px !important; margin: 0 0 10px 0 !important; color: #1e3a8a !important; text-align: center; }
    h2 { margin: 15px 0 8px 0 !important; font-size: 18px !important; color: #1e3a8a !important; border-bottom: 2px solid #dbeafe !important; padding-bottom: 4px !important; }
    h3 { margin: 0 0 8px 0 !important; font-size: 14px !important; color: #0f172a !important; }
    
    .report-hero-stats { display: flex; flex-wrap: wrap; gap: 15px !important; margin-bottom: 20px !important; }
    .stat-card-premium {
        flex: 1;
        min-width: 200px;
        background: #fff !important;
        border: 1px solid #e2e8f0 !important;
        border-top: 4px solid #38bdf8 !important;
        padding: 15px !important;
        border-radius: 8px !important;
        break-inside: avoid;
    }
    .stat-card-premium.blue  { border-top-color: #38bdf8 !important; }
    .stat-card-premium.green { border-top-color: #22c55e !important; }
    .stat-card-premium.red   { border-top-color: #ef4444 !important; }
    .stat-card-premium.purple{ border-top-color: #a855f7 !important; }

    .stat-header { display: flex; align-items: center; gap: 10px !important; margin-bottom: 12px !important; }
    .stat-icon-wrapper { width: 30px !important; height: 30px !important; background: #f1f5f9 !important; border-radius: 6px !important; color: #334155 !important; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .stat-title { font-size: 15px !important; font-weight: 700 !important; color: #0f172a !important; margin: 0; }
    
    .stat-row { display: flex; justify-content: space-between; padding: 6px 0 !important; font-size: 13px !important; border-bottom: 1px solid #f1f5f9 !important; color: #475569 !important; }
    .stat-row .stat-value { font-weight: 700 !important; color: #0f172a !important; }
    .stat-row.highlight { padding-top: 10px !important; font-size: 14px !important; border-top: 1px dashed #cbd5e1 !important; border-bottom: none !important; margin-top: 5px; }

    .premium-list-container { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; padding: 15px !important; border-radius: 8px !important; margin-bottom: 15px !important; break-inside: avoid; flex: 1; min-width: 200px; }
    .premium-list-header { margin-bottom: 10px !important; padding-bottom: 8px !important; border-bottom: 1px solid #e2e8f0 !important; display: flex; align-items: center; gap: 8px;}
    .premium-list-header h3 { font-size: 15px !important; color: #0f172a !important; margin: 0; }
    .premium-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;}
    .premium-list-item { font-size: 13px; color: #334155; padding: 4px 0;}

    .premium-table-wrap { margin-top: 10px !important; margin-bottom: 15px !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; background: #fff !important; break-inside: avoid; overflow: hidden !important; }
    .premium-table { font-size: 12px !important; width: 100% !important; border-collapse: collapse !important; }
    .premium-table th { padding: 8px 10px !important; background: #1e3a8a !important; color: #fff !important; font-weight: 700 !important; text-align: left;}
    .premium-table td { padding: 8px 10px !important; border-bottom: 1px solid #f1f5f9 !important; color: #1e293b !important; }
    .premium-table tbody tr:nth-child(even) td { background-color: #f8fafc !important; }
    .premium-table tfoot tr td { background-color: #eff6ff !important; font-weight: 700 !important; border-top: 2px solid #bfdbfe !important; color: #1e3a8a !important; }

    .text-success { color: #16a34a !important; }
    .text-danger { color: #dc2626 !important; }
    .text-muted { color: #64748b !important; }
    
    .footer { margin-top: 40px; padding-top: 15px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 12px; color: #334155; page-break-inside: avoid; }
`;

export const sharePdf = async (htmlContent, defaultFileName) => {
    try {
        // Generate random filename for security
        const randomId = Math.random().toString(36).substring(2, 15); // Random string
        const timestamp = new Date().toISOString().split('T')[0]; // Date part
        const randomFileName = `Report_${timestamp}_${randomId}.pdf`;
        
        const { uri } = await Print.printToFileAsync({
            html: htmlContent,
            base64: false
        });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: randomFileName });
    } catch (error) {
        console.error("PDF Generation Error: ", error);
        throw error;
    }
};

export const generateDailyReportPdf = async (reportDate, salesToday, returnsToday, productsToday, supplierTxns, buyersToday, suppliersToday) => {
    const shopSettings = await getShopSettings();
    const totalSalesAmount = salesToday.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const totalCashPaid = salesToday.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const totalCreditGiven = totalSalesAmount - totalCashPaid;

    // Payment method split
    const cashReceived = salesToday.reduce((sum, s) => {
        const m = (s.payment_method || 'Cash').toLowerCase();
        if (m === 'cash') return sum + Number(s.paid_amount || 0);
        if (m === 'split') return sum + Number(s.cash_amount || 0);
        return sum;
    }, 0);
    const onlineReceived = salesToday.reduce((sum, s) => {
        const m = (s.payment_method || 'Cash').toLowerCase();
        if (m === 'online') return sum + Number(s.paid_amount || 0);
        if (m === 'split') return sum + Number(s.online_amount || 0);
        return sum;
    }, 0);

    // Product profit
    const totalProductProfit = salesToday.reduce((sum, s) => {
        const saleRate = Number(s.products?.price || 0);
        const purchaseRate = Number(s.products?.purchase_rate || 0);
        const qty = Number(s.quantity || 0);
        return sum + ((saleRate - purchaseRate) * qty);
    }, 0);

    const totalReturnsAmount = returnsToday.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const totalReturnsQty = returnsToday.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const netRealProfit = totalProductProfit - totalReturnsAmount;

    const supplierTotalAmount = supplierTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const supplierTotalPaid = supplierTxns.reduce((sum, t) => sum + Number(t.paid_amount || 0), 0);
    const totalCreditToSuppliers = supplierTotalAmount - supplierTotalPaid;

    // Product-wise profit data
    const productProfitMap = salesToday.reduce((acc, s) => {
        const name = s.products?.name || `Product #${s.product_id}`;
        const key = s.product_id || name;
        const saleRate = Number(s.products?.price || 0);
        const purchaseRate = Number(s.products?.purchase_rate || 0);
        const qty = Number(s.quantity || 0);
        if (!acc[key]) acc[key] = { name, saleRate, purchaseRate, qty: 0, revenue: 0, profit: 0 };
        acc[key].qty += qty;
        acc[key].revenue += Number(s.total_amount || 0);
        acc[key].profit += (saleRate - purchaseRate) * qty;
        return acc;
    }, {});
    const productProfitList = Object.values(productProfitMap).sort((a, b) => b.profit - a.profit);

    const htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <style>${PDF_CSS}</style>
        </head>
        <body>
            <h1>${shopSettings.name}</h1>
            <p style="text-align:center; font-size:16px; margin:0 0 5px 0; font-weight:bold; color:#1e3a8a;">Daily Report</p>
            <p style="text-align:center; font-size:14px; margin-top:0px; color:#475569;">Date: <strong>${new Date(reportDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></p>

            <div class="report-hero-stats">
                <div class="stat-card-premium blue">
                    <div class="stat-header"><div class="stat-icon-wrapper">T</div><h3 class="stat-title">Total Sales Overview</h3></div>
                    <div class="stat-row"><span>Total Selling Amount:</span><span class="stat-value">Rs. ${totalSalesAmount.toLocaleString()}</span></div>
                    <div class="stat-row"><span>Cash Received:</span><span class="stat-value text-success">Rs. ${totalCashPaid.toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>Given on Credit:</span><span class="stat-value ${totalCreditGiven > 0 ? 'text-danger' : ''}">Rs. ${totalCreditGiven.toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium green">
                    <div class="stat-header"><div class="stat-icon-wrapper">P</div><h3 class="stat-title">Payment Method Breakdown</h3></div>
                    <div class="stat-row"><span>&#x1F4B5; Cash Only (${salesToday.filter(s => (s.payment_method||'Cash').toLowerCase()==='cash').length} log):</span><span class="stat-value text-success">Rs. ${cashReceived.toLocaleString()}</span></div>
                    <div class="stat-row"><span>&#x1F4F1; Online Only (${salesToday.filter(s => (s.payment_method||'').toLowerCase()==='online').length} log):</span><span class="stat-value" style="color:#38bdf8;">Rs. ${onlineReceived.toLocaleString()}</span></div>
                    <div class="stat-row"><span>&#x1F500; Split (${salesToday.filter(s => (s.payment_method||'').toLowerCase()==='split').length} log):</span><span class="stat-value" style="color:#f59e0b; font-size:0.8em;">Cash + Online &darr;</span></div>
                    <div style="font-size:0.72em; color:#94a3b8; padding-left:10px; margin-bottom:4px;">&darr; Split ka Cash &rarr; &#x1F4B5; mein add | Split ka Online &rarr; &#x1F4F1; mein add</div>
                    <div class="stat-row highlight"><span><strong>&#x1F4B0; Grand Total Received:</strong></span><span class="stat-value text-success"><strong>Rs. ${(cashReceived + onlineReceived).toLocaleString()}</strong></span></div>
                </div>

                <div class="stat-card-premium ${netRealProfit >= 0 ? 'green' : 'red'}">
                    <div class="stat-header"><div class="stat-icon-wrapper">N</div><h3 class="stat-title">Today's Net Profit</h3></div>
                    <div class="stat-row"><span>Product Margin Profit:</span><span class="stat-value text-success">Rs. ${totalProductProfit.toLocaleString()}</span></div>
                    <div class="stat-row"><span>Less Returns:</span><span class="stat-value text-danger">- Rs. ${totalReturnsAmount.toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span><strong>Net Real Profit:</strong></span><span class="stat-value ${netRealProfit >= 0 ? 'text-success' : 'text-danger'}"><strong>Rs. ${netRealProfit.toLocaleString()}</strong></span></div>
                </div>

                <div class="stat-card-premium purple">
                    <div class="stat-header"><div class="stat-icon-wrapper">S</div><h3 class="stat-title">Stock Purchased (Saman Daala)</h3></div>
                    <div class="stat-row"><span>Total Bill (Purchases):</span><span class="stat-value">Rs. ${supplierTotalAmount.toLocaleString()}</span></div>
                    <div class="stat-row"><span>Cash Paid:</span><span class="stat-value text-success">Rs. ${supplierTotalPaid.toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>Owed to Suppliers:</span><span class="stat-value ${totalCreditToSuppliers > 0 ? 'text-danger' : ''}">Rs. ${totalCreditToSuppliers.toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium red">
                    <div class="stat-header"><div class="stat-icon-wrapper">R</div><h3 class="stat-title">Returns Overview</h3></div>
                    <div class="stat-row"><span>Total Returns Value:</span><span class="stat-value">Rs. ${totalReturnsAmount.toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>Total Items Returned:</span><span class="stat-value">${totalReturnsQty}</span></div>
                </div>
            </div>

            <div class="report-hero-stats">
                <div class="premium-list-container">
                    <div class="premium-list-header"><h3 style="color:#0ea5e9;">New Products (${productsToday.length})</h3></div>
                    <ul class="premium-list">
                        ${productsToday.length === 0 ? '<li class="premium-list-item text-muted">No new products today.</li>' : productsToday.map(p => `<li class="premium-list-item"><strong>${p.name || 'Unknown'}</strong></li>`).join('')}
                    </ul>
                </div>
                <div class="premium-list-container">
                    <div class="premium-list-header"><h3 style="color:#22c55e;">New Customers (${buyersToday.length})</h3></div>
                    <ul class="premium-list">
                        ${buyersToday.length === 0 ? '<li class="premium-list-item text-muted">No new customers today.</li>' : buyersToday.map(b => `<li class="premium-list-item"><strong>${b.name || 'Unknown'}</strong> ${b.company_name ? '('+b.company_name+')' : ''}</li>`).join('')}
                    </ul>
                </div>
                <div class="premium-list-container">
                    <div class="premium-list-header"><h3 style="color:#f59e0b;">New Suppliers (${suppliersToday.length})</h3></div>
                    <ul class="premium-list">
                        ${suppliersToday.length === 0 ? '<li class="premium-list-item text-muted">No new suppliers today.</li>' : suppliersToday.map(s => `<li class="premium-list-item"><strong>${s.name || 'Unknown'}</strong> ${s.company_name ? '('+s.company_name+')' : ''}</li>`).join('')}
                    </ul>
                </div>
            </div>

            ${returnsToday.length > 0 ? `
            <div class="premium-list-container" style="border-color:#fca5a5;">
                <div class="premium-list-header"><h3 style="color:#dc2626;">Goods Returned Today (${returnsToday.length})</h3></div>
                <ul class="premium-list">
                    ${returnsToday.map(r => `
                        <li class="premium-list-item">
                            <strong class="text-danger">${r.product_name}</strong> - Qty: ${r.quantity}
                            <strong>(Refunded: Rs.${Number(r.total_amount).toLocaleString()})</strong>
                            ${r.buyer_name ? '<span class="text-muted">from ' + r.buyer_name + '</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}

            ${productProfitList.length > 0 ? `
            <h2>Product-Wise Profit Today</h2>
            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead><tr><th>Product</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Sale Rate</th><th style="text-align:right;">Buy Rate</th><th style="text-align:right;">Profit/Unit</th><th style="text-align:right;">Total Revenue</th><th style="text-align:right;">Total Profit</th></tr></thead>
                    <tbody>
                        ${productProfitList.map(p => `<tr>
                            <td><strong>${p.name}</strong></td>
                            <td style="text-align:center;">${p.qty}</td>
                            <td style="text-align:right;">Rs. ${p.saleRate.toLocaleString()}</td>
                            <td style="text-align:right;" class="text-danger">Rs. ${p.purchaseRate.toLocaleString()}</td>
                            <td style="text-align:right;" class="${(p.saleRate - p.purchaseRate) >= 0 ? 'text-success' : 'text-danger'}"><strong>Rs. ${(p.saleRate - p.purchaseRate).toLocaleString()}</strong></td>
                            <td style="text-align:right;">Rs. ${p.revenue.toLocaleString()}</td>
                            <td style="text-align:right;" class="${p.profit >= 0 ? 'text-success' : 'text-danger'}"><strong>Rs. ${p.profit.toLocaleString()}</strong></td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot><tr>
                        <td><strong>Grand Total</strong></td>
                        <td style="text-align:center;"><strong>${productProfitList.reduce((s, p) => s + p.qty, 0)}</strong></td>
                        <td colspan="3"></td>
                        <td style="text-align:right;"><strong>Rs. ${productProfitList.reduce((s, p) => s + p.revenue, 0).toLocaleString()}</strong></td>
                        <td style="text-align:right;" class="text-success"><strong>Rs. ${productProfitList.reduce((s, p) => s + p.profit, 0).toLocaleString()}</strong></td>
                    </tr></tfoot>
                </table>
            </div>
            ` : ''}

            <h2>Detailed Sales Log (${salesToday.length} records)</h2>
            ${salesToday.length === 0 ? '<p class="text-muted">No sales recorded today.</p>' : `
            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead><tr><th>Customer</th><th>Product</th><th>Qty</th><th>Total</th><th>Paid</th><th>Method</th><th>Profit</th><th>Status</th></tr></thead>
                    <tbody>
                        ${salesToday.map(sale => {
                            const t = Number(sale.total_amount || 0); const p = Number(sale.paid_amount || 0); const u = t - p;
                            const m = sale.payment_method || 'Cash';
                            const saleRate = Number(sale.products?.price || 0);
                            const purchaseRate = Number(sale.products?.purchase_rate || 0);
                            const qty = Number(sale.quantity || 0);
                            const saleProfit = (saleRate - purchaseRate) * qty;
                            const splitDetails = m === 'Split' ? `<br/><small style="color:#64748b; font-size: 10px;">C:${sale.cash_amount} O:${sale.online_amount}</small>` : '';
                            const methodHtml = m === 'Online' ? `<span style="color:#38bdf8;">Online</span>` : m === 'Split' ? `<span style="color:#f59e0b;">Split</span>${splitDetails}` : `<span style="color:#22c55e;">Cash</span>`;
                            return `<tr>
                                <td>${sale.buyer_name || (sale.buyers && sale.buyers.name) || 'Walk-in'}</td>
                                <td><strong>${(sale.products && sale.products.name) || ('Product ID ' + sale.product_id)}</strong></td>
                                <td>${sale.quantity}</td>
                                <td><strong>Rs. ${t.toLocaleString()}</strong></td>
                                <td class="text-success"><strong>Rs. ${p.toLocaleString()}</strong></td>
                                <td style="text-align:center;"><strong>${methodHtml}</strong></td>
                                <td class="${saleProfit >= 0 ? 'text-success' : 'text-danger'}"><strong>Rs. ${saleProfit.toLocaleString()}</strong></td>
                                <td>${u > 0 ? '<span class="text-danger">Credit: Rs.' + u.toLocaleString() + '</span>' : '<span class="text-success">Clear</span>'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            `}

            <div class="footer">
                <h3 style="margin-bottom: 4px;">Software Developed by Hassan Ali Abrar</h3>
                <p style="margin: 0;">Instagram: <strong>hassan.secure</strong> | WhatsApp: <strong>+92 348 5055098</strong></p>
            </div>
        </body>
        </html>
    `;

    const dayLabel = pdfNamePart(reportDate, 12);
    return sharePdf(htmlContent, `InventoryPro_DailySummary_${dayLabel}.pdf`);
};

/**
 * @param {object} [fileMeta]
 * @param {'quotation'|'cash_invoice'|'credit_invoice'} [fileMeta.kind]
 */
export const generateInvoicePdf = async (transactionInfo, cartItems, customerName, totalBill, discount, finalAmount, customPaymentDate, fileMeta = {}) => {
    const shopSettings = await getShopSettings();
    // Exact copy of frontend receipt structure with proper receipt styling
    const htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: 'Segoe UI', Arial, sans-serif !important;
                    font-size: 13px !important;
                    background: white !important;
                    color: black !important;
                    margin: 0;
                    padding: 0;
                    line-height: 1.4;
                }
                * { box-shadow: none !important; }
                
                .receipt {
                    width: 350px !important;
                    min-height: 100vh;
                    padding: 2rem 1.5rem;
                    display: flex;
                    flex-direction: column;
                    background: white;
                    position: relative;
                    overflow: hidden;
                    margin: 0 auto;
                }
                
                .receipt-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                
                .receipt-logo {
                    display: inline-flex;
                    padding: 0.75rem;
                    border-radius: 50%;
                    background: transparent;
                    color: black;
                    margin-bottom: 1rem;
                    border: 1px solid black;
                    width: 24px;
                    height: 24px;
                    align-items: center;
                    justify-content: center;
                }
                
                .receipt-header h2 {
                    font-size: 1.4rem !important;
                    letter-spacing: 2px;
                    margin-bottom: 0.25rem;
                    font-weight: 700;
                    line-height: 1.2;
                }
                
                .receipt-address,
                .receipt-contact {
                    font-size: 0.8rem;
                    color: #666;
                    margin-bottom: 0.25rem;
                }
                
                .receipt-type-badge {
                    display: inline-block;
                    margin-top: 1rem;
                    padding: 0.4rem 1rem;
                    border-radius: 4px;
                    background: transparent;
                    font-size: 0.75rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: #666;
                    border: 1px solid #ccc;
                }
                
                .receipt-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px dashed #ccc;
                }
                
                .meta-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                    color: #666;
                }
                
                .receipt-items-table {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: 2rem;
                    flex: 1;
                }
                
                .receipt-table-header {
                    display: grid;
                    grid-template-columns: 1fr 40px 80px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #666;
                    text-transform: uppercase;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 0.5rem;
                }
                
                .receipt-table-row {
                    display: grid;
                    grid-template-columns: 1fr 40px 80px;
                    font-size: 0.9rem;
                    color: black;
                }
                
                .item-name-col {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    padding-right: 1rem;
                }
                
                .receipt-table-row span:last-child,
                .receipt-table-header span:last-child,
                .receipt-table-row span:nth-child(2),
                .receipt-table-header span:nth-child(2) {
                    text-align: right;
                }
                
                .receipt-summary {
                    border-top: 1px dashed #ccc;
                    padding-top: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: 2rem;
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9rem;
                    color: #666;
                }
                
                .summary-row.total {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: black;
                    margin-top: 0.5rem;
                    padding-top: 0.5rem;
                    border-top: 1px solid #ccc;
                }
                
                .footer {
                    margin-top: 10px;
                    padding-top: 15px;
                    border-top: 1px dashed #ccc;
                    text-align: center;
                    font-size: 12px;
                    color: black;
                    page-break-inside: avoid;
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="receipt-header">
                    <div class="receipt-logo">🧮</div>
                    <h2 style="font-size: 1.4rem; word-break: break-word; white-space: pre-wrap;">${shopSettings.name}</h2>
                    <p class="receipt-address">${shopSettings.address}</p>
                    <p class="receipt-contact">Ph: ${shopSettings.phone}</p>
                    
                    <div class="receipt-type-badge">
                        ${fileMeta.kind === 'quotation' ? 'QUOTATION / ESTIMATE' : fileMeta.kind === 'credit_invoice' ? 'CREDIT / CREDIT INVOICE' : 'TAX INVOICE'}
                    </div>
                </div>

                <div class="receipt-meta">
                    <div class="meta-row">
                        <span>Date:</span>
                        <span>${new Date().toLocaleDateString()}</span>
                    </div>
                    <div class="meta-row">
                        <span>Customer:</span>
                        <span>${customerName || 'Cash Customer'}</span>
                    </div>
                    <div class="meta-row">
                        <span>Invoice #:</span>
                        <span>INV-${Math.floor(100000 + Math.random() * 900000)}</span>
                    </div>
                </div>

                <div class="receipt-items-table">
                    <div class="receipt-table-header">
                        <span>Item</span>
                        <span>Qty</span>
                        <span>Total</span>
                    </div>
                    ${cartItems.map(item => `
                        <div class="receipt-table-row">
                            <span class="item-name-col">
                                <span style="font-weight: 600;">${item.name}</span>
                                <div style="font-size: 0.75em; color: #666; margin-top: 3px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                                    <span>[${item.id || 'ID'}]</span>
                                    <span>• ${item.selectedUnit || 'Piece'}</span>
                                </div>
                            </span>
                            <span>${item.quantity} ${item.selectedUnit ? `(${item.selectedUnit.replace(/^Per\s+/i, '')})` : ''}</span>
                            <span>Rs. ${(item.quantity * item.unitPrice).toLocaleString()}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="receipt-summary">
                    <div class="summary-row">
                        <span>Subtotal</span>
                        <span>Rs. ${totalBill.toLocaleString()}</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total Amount</span>
                        <span>Rs. ${finalAmount.toLocaleString()}</span>
                    </div>

                    ${fileMeta.kind !== 'quotation' ? `
                        <div class="summary-row" style="margin-top: 10px;">
                            <span>Method</span>
                            <span style="font-weight: 600;">${fileMeta.kind === 'credit_invoice' ? 'Credit' : 'Cash'}</span>
                        </div>
                    ` : ''}

                    ${fileMeta.kind === 'credit_invoice' ? `
                        <div class="summary-row">
                            <span>Paid Amount</span>
                            <span>Rs. ${Number(transactionInfo?.amount || 0).toLocaleString()}</span>
                        </div>
                        <div class="summary-row total" style="color: #ef4444;">
                            <span>Remaining (Credit)</span>
                            <span>Rs. ${(Number(finalAmount) - Number(transactionInfo?.amount || 0)).toLocaleString()}</span>
                        </div>
                    ` : fileMeta.kind === 'cash_invoice' ? `
                        <div class="summary-row">
                            <span>Paid Amount</span>
                            <span>Rs. ${Number(transactionInfo?.amount || finalAmount).toLocaleString()}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="footer">
                    <p style="margin: 0 0 5px; font-size: 0.8rem; font-weight: 600;">Software Developed by Hassan Ali Abrar</p>
                    <p style="margin: 0; font-size: 0.75rem; color: #666;">Insta: <strong style="color: #38bdf8;">hassan.secure</strong> | WA: <strong style="color: #22c55e;">+92 348 5055098</strong></p>
                </div>
            </div>
        </body>
        </html>
    `;

    const kind = fileMeta.kind || 'cash_invoice';
    const typeLabel =
        kind === 'quotation' ? 'Quotation' : kind === 'credit_invoice' ? 'CreditInvoice' : 'SalesInvoice';
    const dateStr = new Date().toISOString().split('T')[0];
    const cust = pdfNamePart(customerName || 'Walk-in', 32);
    const fileName = `InventoryPro_${typeLabel}_${cust}_${dateStr}.pdf`;
    return sharePdf(htmlContent, fileName);
};

export const generateMonthlyReportPdf = async (reportData, filterMonth, filterYear, isDailySummary) => {
    const shopSettings = await getShopSettings();
    const { summary, expense_breakdown, activity_lists, company_wise_summary, daily_breakdown, product_profit_list, supplier_purchase_summary } = reportData;
    const paymentSplit = summary.payment_split || { cash: 0, online: 0, cash_count: 0, online_count: 0, split_count: 0, grand_total: 0 };

    let overviewHtml = ``;
    let dailySummaryHtml = ``;

    if (!isDailySummary) {
        overviewHtml = `
            <div class="report-hero-stats">
                <div class="stat-card-premium ${(summary.net_real_profit || 0) >= 0 ? 'green' : 'red'}">
                    <div class="stat-header"><div class="stat-icon-wrapper">N</div><h3 class="stat-title">Net Real Profit</h3></div>
                    <div class="stat-row"><span>Product Profit:</span><span class="stat-value text-success">Rs. ${(summary.product_profit || 0).toLocaleString()}</span></div>
                    <div class="stat-row"><span>Less Expenses:</span><span class="stat-value text-danger">- Rs. ${(summary.total_expenses || 0).toLocaleString()}</span></div>
                    <div class="stat-row"><span>Less Returns:</span><span class="stat-value text-danger">- Rs. ${(summary.total_returns_this_month || 0).toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span><strong>Net Real Profit:</strong></span><span class="stat-value ${(summary.net_real_profit || 0) >= 0 ? 'text-success' : 'text-danger'}"><strong>Rs. ${(summary.net_real_profit || 0).toLocaleString()}</strong></span></div>
                </div>

                <div class="stat-card-premium ${summary.cash_flow_profit >= 0 ? 'blue' : 'red'}">
                    <div class="stat-header"><div class="stat-icon-wrapper">C</div><h3 class="stat-title">Cash Flow (In Hand)</h3></div>
                    <div class="stat-row"><span>Cash In (Sales+Credit):</span><span class="stat-value text-success">Rs. ${(summary.total_cash_sales_this_month + summary.total_sales_collected_this_month).toLocaleString()}</span></div>
                    <div class="stat-row"><span>Cash Out (Suppliers):</span><span class="stat-value text-danger">Rs. ${summary.total_purchases_paid_this_month.toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>Net Cash Flow:</span><span class="stat-value ${summary.cash_flow_profit >= 0 ? 'text-success' : 'text-danger'}">Rs. ${(summary.cash_flow_profit || 0).toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium purple">
                    <div class="stat-header"><div class="stat-icon-wrapper">P</div><h3 class="stat-title">Payment Method Breakdown</h3></div>
                    <div class="stat-row"><span>&#x1F4B5; Cash Only (${paymentSplit.cash_count || 0} log):</span><span class="stat-value text-success">Rs. ${(paymentSplit.cash || 0).toLocaleString()}</span></div>
                    <div class="stat-row"><span>&#x1F4F1; Online Only (${paymentSplit.online_count || 0} log):</span><span class="stat-value" style="color:#38bdf8;">Rs. ${(paymentSplit.online || 0).toLocaleString()}</span></div>
                    <div class="stat-row"><span>&#x1F500; Split (${paymentSplit.split_count || 0} log):</span><span class="stat-value" style="color:#f59e0b; font-size:0.8em;">Cash + Online &darr;</span></div>
                    <div style="font-size:0.72em; color:#94a3b8; padding-left:10px; margin-bottom:4px;">&darr; Split ka Cash &rarr; &#x1F4B5; mein | Split ka Online &rarr; &#x1F4F1; mein</div>
                    <div class="stat-row highlight"><span><strong>&#x1F4B0; Grand Total Received:</strong></span><span class="stat-value text-success"><strong>Rs. ${(paymentSplit.grand_total || 0).toLocaleString()}</strong></span></div>
                </div>

                <div class="stat-card-premium orange">
                    <div class="stat-header"><div class="stat-icon-wrapper">S</div><h3 class="stat-title">Stock Purchased</h3></div>
                    <div class="stat-row"><span>Total Invoices Made:</span><span class="stat-value">Rs. ${(summary.total_purchases_created_value || 0).toLocaleString()}</span></div>
                    <div class="stat-row"><span>Cash Paid to Suppliers:</span><span class="stat-value text-danger">Rs. ${(summary.total_purchases_paid_this_month || 0).toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>Credit Taken:</span><span class="stat-value" style="color:#f59e0b;">Rs. ${(summary.total_credit_taken_this_month || 0).toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium red">
                    <div class="stat-header"><div class="stat-icon-wrapper">R</div><h3 class="stat-title">Returns & Dues</h3></div>
                    <div class="stat-row"><span>Returns Refunded:</span><span class="stat-value text-danger">Rs. ${(summary.total_returns_this_month || 0).toLocaleString()}</span></div>
                    <div class="stat-row"><span>New Credit Given:</span><span class="stat-value" style="color:#f59e0b;">Rs. ${(summary.total_credit_given_this_month || 0).toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>All-Time Customer Dues:</span><span class="stat-value text-danger">Rs. ${(summary.total_all_time_dues_from_buyers || 0).toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium blue">
                    <div class="stat-header"><div class="stat-icon-wrapper">E</div><h3 class="stat-title">Shop Expenses</h3></div>
                    <div class="stat-row highlight"><span>Total Expenses:</span><span class="stat-value text-danger">Rs. ${(summary.total_expenses || 0).toLocaleString()}</span></div>
                    ${Object.entries(expense_breakdown || {}).slice(0, 4).map(([cat, amt]) => `<div class="stat-row"><span>${cat}:</span><span class="stat-value">Rs. ${Number(amt).toLocaleString()}</span></div>`).join('')}
                </div>
            </div>

            ${product_profit_list && product_profit_list.length > 0 ? `
            <h2>Product-Wise Profit Breakdown</h2>
            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead><tr><th>Product</th><th style="text-align:center;">Qty Sold</th><th style="text-align:right;">Sale Rate</th><th style="text-align:right;">Buy Rate</th><th style="text-align:right;">Profit/Unit</th><th style="text-align:right;">Total Revenue</th><th style="text-align:right;">Total Profit</th></tr></thead>
                    <tbody>
                        ${product_profit_list.map(p => `<tr>
                            <td><strong>${p.product_name}</strong></td>
                            <td style="text-align:center;">${p.total_qty_sold}</td>
                            <td style="text-align:right;">Rs. ${p.sale_rate.toLocaleString()}</td>
                            <td style="text-align:right;" class="text-danger">Rs. ${p.purchase_rate.toLocaleString()}</td>
                            <td style="text-align:right;" class="${(p.sale_rate - p.purchase_rate) >= 0 ? 'text-success' : 'text-danger'}"><strong>Rs. ${(p.sale_rate - p.purchase_rate).toLocaleString()}</strong></td>
                            <td style="text-align:right;">Rs. ${p.total_revenue.toLocaleString()}</td>
                            <td style="text-align:right;" class="${p.total_profit >= 0 ? 'text-success' : 'text-danger'}"><strong>Rs. ${p.total_profit.toLocaleString()}</strong></td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot><tr>
                        <td><strong>Grand Total</strong></td>
                        <td style="text-align:center;"><strong>${product_profit_list.reduce((s, p) => s + p.total_qty_sold, 0)}</strong></td>
                        <td colspan="3"></td>
                        <td style="text-align:right;"><strong>Rs. ${product_profit_list.reduce((s, p) => s + p.total_revenue, 0).toLocaleString()}</strong></td>
                        <td style="text-align:right;" class="text-success"><strong>Rs. ${product_profit_list.reduce((s, p) => s + p.total_profit, 0).toLocaleString()}</strong></td>
                    </tr></tfoot>
                </table>
            </div>
            ` : ''}

            ${supplier_purchase_summary && supplier_purchase_summary.length > 0 ? `
            <h2>Supplier-Wise Purchase Summary</h2>
            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead><tr><th>Supplier Name</th><th style="text-align:center;">Transactions</th><th style="text-align:right;">Total Purchased</th><th style="text-align:right;">Cash Paid</th><th style="text-align:right;">Remaining (Credit)</th></tr></thead>
                    <tbody>
                        ${supplier_purchase_summary.map(s => `<tr>
                            <td><strong>${s.supplier_name}</strong></td>
                            <td style="text-align:center;">${s.num_transactions}</td>
                            <td style="text-align:right;"><strong>Rs. ${s.total_purchased.toLocaleString()}</strong></td>
                            <td style="text-align:right;" class="text-success">Rs. ${s.total_paid.toLocaleString()}</td>
                            <td style="text-align:right;" class="${s.total_outstanding > 0 ? 'text-danger' : 'text-success'}"><strong>${s.total_outstanding > 0 ? 'Rs. ' + s.total_outstanding.toLocaleString() : '✓ Clear'}</strong></td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot><tr>
                        <td><strong>Grand Total</strong></td>
                        <td style="text-align:center;"><strong>${supplier_purchase_summary.reduce((s, x) => s + x.num_transactions, 0)}</strong></td>
                        <td style="text-align:right;"><strong>Rs. ${supplier_purchase_summary.reduce((s, x) => s + x.total_purchased, 0).toLocaleString()}</strong></td>
                        <td style="text-align:right;" class="text-success"><strong>Rs. ${supplier_purchase_summary.reduce((s, x) => s + x.total_paid, 0).toLocaleString()}</strong></td>
                        <td style="text-align:right;" class="text-danger"><strong>Rs. ${supplier_purchase_summary.reduce((s, x) => s + x.total_outstanding, 0).toLocaleString()}</strong></td>
                    </tr></tfoot>
                </table>
            </div>
            ` : ''}

            <div style="display:flex; gap: 20px;">
                <div style="flex:1;">
                    <h2 style="color:#38bdf8;">Income &amp; Receivables</h2>
                    <div class="premium-list-container">
                        <div class="stat-row"><span>Total Sales Invoices Made:</span><span class="stat-value">Rs. ${(summary.total_sales_created_value || 0).toLocaleString()}</span></div>
                        <div class="stat-row"><span>Cash Sales (Fully Paid):</span><span class="stat-value text-success">Rs. ${(summary.total_cash_sales_this_month || 0).toLocaleString()}</span></div>
                        <div class="stat-row"><span>Credit Installments Received:</span><span class="stat-value" style="color:#0ea5e9;">Rs. ${(summary.total_sales_collected_this_month || 0).toLocaleString()}</span></div>
                        <div style="margin: 8px 0 4px; padding: 8px; background: rgba(16,185,129,0.05); border-radius: 6px; border: 1px solid rgba(16,185,129,0.15);">
                            <div style="font-weight:700; font-size:0.82em; margin-bottom:6px; color:#1e293b;">&#x1F4B3; Payment Method Breakdown:</div>
                            <div class="stat-row"><span>&#x1F4B5; Cash Only (${paymentSplit.cash_count || 0} log):</span><span class="stat-value text-success">Rs. ${(paymentSplit.cash || 0).toLocaleString()}</span></div>
                            <div class="stat-row"><span>&#x1F4F1; Online Only (${paymentSplit.online_count || 0} log):</span><span class="stat-value" style="color:#38bdf8;">Rs. ${(paymentSplit.online || 0).toLocaleString()}</span></div>
                            <div class="stat-row"><span>&#x1F500; Split (${paymentSplit.split_count || 0} log):</span><span class="stat-value" style="color:#f59e0b; font-size:0.8em;">Cash + Online &darr;</span></div>
                            <div style="font-size:0.7em; color:#94a3b8; padding-left:10px; margin-bottom:4px;">&darr; Split ka Cash &rarr; &#x1F4B5; mein | Online &rarr; &#x1F4F1; mein</div>
                            <div class="stat-row highlight"><span><strong>&#x1F4B0; Grand Total Received:</strong></span><span class="stat-value text-success"><strong>Rs. ${(paymentSplit.grand_total || 0).toLocaleString()}</strong></span></div>
                        </div>
                        <div class="stat-row highlight"><span>New Credit Given This Month:</span><span class="stat-value" style="color:#f59e0b;">Rs. ${(summary.total_credit_given_this_month || 0).toLocaleString()}</span></div>
                    </div>
                    
                    <div class="premium-table-wrap">
                        <h3>Cash Collected (by Salesman)</h3>
                        <table class="premium-table">
                            <thead><tr><th>Salesman</th><th style="text-align:center;">Bills</th><th style="text-align:right;">Collected</th></tr></thead>
                            <tbody>
                                ${activity_lists?.cash_sales_by_salesman?.map(s => `
                                    <tr>
                                        <td>${s.salesman_name}</td>
                                        <td style="text-align:center;">${s.num_cash_bills}</td>
                                        <td style="text-align:right;" class="text-success">+Rs. ${(s.total_cash_collected || 0).toLocaleString()}</td>
                                    </tr>
                                `).join('') || ''}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style="flex:1;">
                    <h2 style="color:#ef4444;">Expenses &amp; Payables</h2>
                    <div class="premium-list-container">
                        <div class="stat-row"><span>Total Purchase Invoices Made:</span><span class="stat-value">Rs. ${(summary.total_purchases_created_value || 0).toLocaleString()}</span></div>
                        <div class="stat-row"><span>Actual Cash Paid to Suppliers:</span><span class="stat-value text-danger">Rs. ${(summary.total_purchases_paid_this_month || 0).toLocaleString()}</span></div>
                        <div class="stat-row highlight"><span>Total Shop Expenses:</span><span class="stat-value" style="color:#f59e0b;">Rs. ${(summary.total_expenses || 0).toLocaleString()}</span></div>
                        <div class="stat-row highlight"><span>New Credit Taken This Month:</span><span class="stat-value" style="color:#0ea5e9;">Rs. ${(summary.total_credit_taken_this_month || 0).toLocaleString()}</span></div>
                    </div>

                    <div class="premium-table-wrap">
                        <h3>Expense Breakdown</h3>
                        <table class="premium-table">
                            <tbody>
                                ${Object.entries(expense_breakdown || {}).map(([category, amount]) => `
                                    <tr>
                                        <td>${category}</td>
                                        <td style="text-align:right;">Rs. ${Number(amount).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="premium-table-wrap">
                <h3>Company-Wise Sales Summary (This Month)</h3>
                <table class="premium-table">
                    <thead><tr><th>Company Name</th><th style="text-align:center;">Txns</th><th style="text-align:right;">Total Sales</th><th style="text-align:right;">Collected</th><th style="text-align:right;">Outstanding</th></tr></thead>
                    <tbody>
                        ${company_wise_summary?.map(c => `
                            <tr>
                                <td>${c.company_name}</td>
                                <td style="text-align:center;">${c.num_transactions}</td>
                                <td style="text-align:right;">Rs. ${c.total_sales.toLocaleString()}</td>
                                <td style="text-align:right;" class="text-success">Rs. ${c.total_collected.toLocaleString()}</td>
                                <td style="text-align:right;" class="${c.total_outstanding > 0 ? 'text-danger' : 'text-success'}">${c.total_outstanding > 0 ? 'Rs. ' + c.total_outstanding.toLocaleString() : '✓ Clear'}</td>
                            </tr>
                        `).join('') || ''}
                    </tbody>
                </table>
            </div>
            
            ${activity_lists?.all_time_buyers_with_dues?.length > 0 ? `
            <div class="premium-table-wrap" style="border-color:#eab308;">
                <h3 style="background:#fefce8; color:#ca8a04;">&#x26A0;&#xFE0F; Customers with Outstanding Dues (All-Time)</h3>
                <table class="premium-table">
                    <thead><tr><th>Customer Name</th><th>Phone Number</th><th style="text-align:right;">Total Remaining</th></tr></thead>
                    <tbody>
                        ${activity_lists?.all_time_buyers_with_dues?.map(b => `
                            <tr>
                                <td>${b.name}</td>
                                <td>${b.phone}</td>
                                <td style="text-align:right;" class="text-danger">Rs. ${b.remaining_due.toLocaleString()}</td>
                            </tr>
                        `).join('') || ''}
                    </tbody>
                </table>
            </div>
            ` : ''}
        `;
    } else {
        dailySummaryHtml = `
            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead>
                        <tr><th>Date</th><th style="text-align:right;">Sales (#)</th><th style="text-align:right;">Total Sale Value</th><th style="text-align:right;">&#x1F4B5; Cash</th><th style="text-align:right;">&#x1F4F1; Online</th><th style="text-align:right;">New Credit</th><th style="text-align:right;">Returns</th><th style="text-align:right;">Expenses</th><th style="text-align:right;">Profit</th></tr>
                    </thead>
                    <tbody>
                        ${daily_breakdown?.map(day => `
                            <tr>
                                <td><strong>${new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</strong></td>
                                <td style="text-align:right;">${day.num_new_sales || '-'}</td>
                                <td style="text-align:right; color:#0ea5e9;">${day.total_sales ? 'Rs. ' + day.total_sales.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="text-success">${(day.cash_received || 0) > 0 ? 'Rs. ' + day.cash_received.toLocaleString() : '-'}</td>
                                <td style="text-align:right; color:#38bdf8;">${(day.online_received || 0) > 0 ? 'Rs. ' + day.online_received.toLocaleString() : '-'}</td>
                                <td style="text-align:right; color:#f59e0b;">${day.credit_given ? 'Rs. ' + day.credit_given.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="text-danger">${day.returned_sales_value ? 'Rs. ' + day.returned_sales_value.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="text-danger">${day.expenses ? 'Rs. ' + day.expenses.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="${(day.daily_profit || 0) >= 0 ? 'text-success' : 'text-danger'}"><strong>${(day.daily_profit || 0) !== 0 ? 'Rs. ' + (day.daily_profit || 0).toLocaleString() : '-'}</strong></td>
                            </tr>
                        `).join('') || ''}
                    </tbody>
                    <tfoot><tr>
                        <td><strong>Month Total</strong></td>
                        <td style="text-align:right;"><strong>${daily_breakdown?.reduce((s, d) => s + d.num_new_sales, 0) || 0}</strong></td>
                        <td style="text-align:right; color:#0ea5e9;"><strong>Rs. ${daily_breakdown?.reduce((s, d) => s + Number(d.total_sales || 0), 0).toLocaleString() || 0}</strong></td>
                        <td style="text-align:right;" class="text-success"><strong>Rs. ${daily_breakdown?.reduce((s, d) => s + (d.cash_received || 0), 0).toLocaleString() || 0}</strong></td>
                        <td style="text-align:right; color:#38bdf8;"><strong>Rs. ${daily_breakdown?.reduce((s, d) => s + (d.online_received || 0), 0).toLocaleString() || 0}</strong></td>
                        <td style="text-align:right; color:#f59e0b;"><strong>Rs. ${daily_breakdown?.reduce((s, d) => s + d.credit_given, 0).toLocaleString() || 0}</strong></td>
                        <td style="text-align:right;" class="text-danger"><strong>Rs. ${daily_breakdown?.reduce((s, d) => s + Number(d.returned_sales_value || 0), 0).toLocaleString() || 0}</strong></td>
                        <td style="text-align:right;" class="text-danger"><strong>Rs. ${daily_breakdown?.reduce((s, d) => s + d.expenses, 0).toLocaleString() || 0}</strong></td>
                        <td style="text-align:right;" class="text-success"><strong>Rs. ${daily_breakdown?.reduce((s, d) => s + (d.daily_profit || 0), 0).toLocaleString() || 0}</strong></td>
                    </tr></tfoot>
                </table>
            </div>
        `;
    }

    const htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <style>${PDF_CSS} .pdf-mode-active { zoom: 0.8; }</style>
        </head>
        <body class="pdf-mode-active">
            <h1>${shopSettings.name}</h1>
            <p style="text-align:center; font-size:16px; margin:0 0 5px 0; font-weight:bold; color:#1e3a8a;">${isDailySummary ? 'Day-by-Day Monthly Summary' : 'Monthly Financial Overview'}</p>
            <p style="text-align:center; font-size:14px; margin-top:0px; color:#475569;">Period: <strong>${filterMonth}/${filterYear}</strong></p>

            ${isDailySummary ? dailySummaryHtml : overviewHtml}

            <div class="footer">
                <h3 style="margin-bottom: 4px;">Software Developed by Hassan Ali Abrar</h3>
                <p style="margin: 0;">Instagram: <strong>hassan.secure</strong> | WhatsApp: <strong>+92 348 5055098</strong></p>
            </div>
        </body>
        </html>
    `;

    const yyyymm = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
    const fileName = isDailySummary
        ? `InventoryPro_MonthlyFinancial_DayByDay_${yyyymm}.pdf`
        : `InventoryPro_MonthlyFinancial_Overview_${yyyymm}.pdf`;
    return sharePdf(htmlContent, fileName);
};

    let overviewHtml = ``;
    let dailySummaryHtml = ``;

    if (!isDailySummary) {
        overviewHtml = `
            <div class="report-hero-stats">
                <div class="stat-card-premium ${summary.cash_flow_profit >= 0 ? 'green' : 'red'}">
                    <div class="stat-header"><div class="stat-icon-wrapper">N</div><h3 class="stat-title">Cash Flow Profit (In hand)</h3></div>
                    <div class="stat-row highlight"><span>Net Difference:</span><span class="stat-value ${summary.cash_flow_profit >= 0 ? 'text-success' : 'text-danger'}">Rs. ${(summary.cash_flow_profit || 0).toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium blue">
                    <div class="stat-header"><div class="stat-icon-wrapper">M</div><h3 class="stat-title">Gross Business Margin</h3></div>
                    <div class="stat-row highlight"><span>Estimated Margin:</span><span class="stat-value">Rs. ${(summary.accrual_profit || 0).toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium red">
                    <div class="stat-header"><div class="stat-icon-wrapper">R</div><h3 class="stat-title">Total Returns</h3></div>
                    <div class="stat-row highlight"><span>Refunded:</span><span class="stat-value">Rs. ${(summary.total_returns_this_month || 0).toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium orange">
                    <div class="stat-header"><div class="stat-icon-wrapper">E</div><h3 class="stat-title">Total Shop Expenses</h3></div>
                    <div class="stat-row highlight"><span>Outflow:</span><span class="stat-value">Rs. ${(summary.total_expenses || 0).toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium purple">
                    <div class="stat-header"><div class="stat-icon-wrapper">D</div><h3 class="stat-title">Pending Customer Dues</h3></div>
                    <div class="stat-row highlight"><span>All-Time:</span><span class="stat-value">Rs. ${(summary.total_all_time_dues_from_buyers || 0).toLocaleString()}</span></div>
                </div>
            </div>

            <div style="display:flex; gap: 20px;">
                <div style="flex:1;">
                    <h2 style="color:#38bdf8;">Income & Receivables</h2>
                    <div class="premium-list-container">
                        <div class="stat-row"><span>Total Sales Invoices Made:</span><span class="stat-value">Rs. ${(summary.total_sales_created_value || 0).toLocaleString()}</span></div>
                        <div class="stat-row"><span>Cash Sales (Fully Paid):</span><span class="stat-value text-success">Rs. ${(summary.total_cash_sales_this_month || 0).toLocaleString()}</span></div>
                        <div class="stat-row"><span>Credit Installments Received:</span><span class="stat-value" style="color:#0ea5e9;">Rs. ${(summary.total_sales_collected_this_month || 0).toLocaleString()}</span></div>
                        <div class="stat-row highlight"><span>New Credit Given This Month:</span><span class="stat-value" style="color:#f59e0b;">Rs. ${(summary.total_credit_given_this_month || 0).toLocaleString()}</span></div>
                    </div>
                    
                    <div class="premium-table-wrap">
                        <h3>Cash Collected (by Salesman)</h3>
                        <table class="premium-table">
                            <thead><tr><th>Salesman</th><th style="text-align:center;">Bills</th><th style="text-align:right;">Collected</th></tr></thead>
                            <tbody>
                                ${activity_lists?.cash_sales_by_salesman?.map(s => `
                                    <tr>
                                        <td>${s.salesman_name}</td>
                                        <td style="text-align:center;">${s.num_cash_bills}</td>
                                        <td style="text-align:right;" class="text-success">+Rs. ${(s.total_cash_collected || 0).toLocaleString()}</td>
                                    </tr>
                                `).join('') || ''}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style="flex:1;">
                    <h2 style="color:#ef4444;">Expenses & Payables</h2>
                    <div class="premium-list-container">
                        <div class="stat-row"><span>Total Purchase Invoices Made:</span><span class="stat-value">Rs. ${(summary.total_purchases_created_value || 0).toLocaleString()}</span></div>
                        <div class="stat-row"><span>Actual Cash Paid to Suppliers:</span><span class="stat-value text-danger">Rs. ${(summary.total_purchases_paid_this_month || 0).toLocaleString()}</span></div>
                        <div class="stat-row highlight"><span>Total Shop Expenses:</span><span class="stat-value" style="color:#f59e0b;">Rs. ${(summary.total_expenses || 0).toLocaleString()}</span></div>
                        <div class="stat-row highlight"><span>New Credit Taken This Month:</span><span class="stat-value" style="color:#0ea5e9;">Rs. ${(summary.total_credit_taken_this_month || 0).toLocaleString()}</span></div>
                    </div>

                    <div class="premium-table-wrap">
                        <h3>Expense Breakdown</h3>
                        <table class="premium-table">
                            <tbody>
                                ${Object.entries(expense_breakdown || {}).map(([category, amount]) => `
                                    <tr>
                                        <td>${category}</td>
                                        <td style="text-align:right;">Rs. ${Number(amount).toLocaleString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="premium-table-wrap">
                <h3>Company-Wise Sales Summary (This Month)</h3>
                <table class="premium-table">
                    <thead><tr><th>Company Name</th><th style="text-align:center;">Txns</th><th style="text-align:right;">Total Sales</th><th style="text-align:right;">Collected</th><th style="text-align:right;">Outstanding</th></tr></thead>
                    <tbody>
                        ${company_wise_summary?.map(c => `
                            <tr>
                                <td>${c.company_name}</td>
                                <td style="text-align:center;">${c.num_transactions}</td>
                                <td style="text-align:right;">Rs. ${c.total_sales.toLocaleString()}</td>
                                <td style="text-align:right;" class="text-success">Rs. ${c.total_collected.toLocaleString()}</td>
                                <td style="text-align:right;" class="${c.total_outstanding > 0 ? 'text-danger' : 'text-success'}">${c.total_outstanding > 0 ? 'Rs. ' + c.total_outstanding.toLocaleString() : '✓ Clear'}</td>
                            </tr>
                        `).join('') || ''}
                    </tbody>
                </table>
            </div>
            
            ${activity_lists?.all_time_buyers_with_dues?.length > 0 ? `
            <div class="premium-table-wrap" style="border-color:#eab308;">
                <h3 style="background:#fefce8; color:#ca8a04;">⚠️ Customers with Outstanding Dues (All-Time)</h3>
                <table class="premium-table">
                    <thead><tr><th>Customer Name</th><th>Phone Number</th><th style="text-align:right;">Total Remaining Amount to Recover</th></tr></thead>
                    <tbody>
                        ${activity_lists?.all_time_buyers_with_dues?.map(b => `
                            <tr>
                                <td>${b.name}</td>
                                <td>${b.phone}</td>
                                <td style="text-align:right;" class="text-danger">Rs. ${b.remaining_due.toLocaleString()}</td>
                            </tr>
                        `).join('') || ''}
                    </tbody>
                </table>
            </div>
            ` : ''}
        `;
    } else {
        dailySummaryHtml = `
            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead>
                        <tr><th>Date</th><th style="text-align:right;">Sales (#)</th><th style="text-align:right;">Total Sale Value</th><th style="text-align:right;">Cash Received</th><th style="text-align:right;">New Credit</th><th style="text-align:right;">Returns Value</th><th style="text-align:right;">Expenses</th></tr>
                    </thead>
                    <tbody>
                        ${daily_breakdown?.map(day => `
                            <tr>
                                <td><strong>${new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</strong></td>
                                <td style="text-align:right;">${day.num_new_sales || '-'}</td>
                                <td style="text-align:right; color:#0ea5e9;">${day.total_sales ? 'Rs. ' + day.total_sales.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="text-success">${day.cash_in ? 'Rs. ' + day.cash_in.toLocaleString() : '-'}</td>
                                <td style="text-align:right; color:#f59e0b;">${day.credit_given ? 'Rs. ' + day.credit_given.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="text-danger">${day.returned_sales_value ? 'Rs. ' + day.returned_sales_value.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="text-danger">${day.expenses ? 'Rs. ' + day.expenses.toLocaleString() : '-'}</td>
                            </tr>
                        `).join('') || ''}
                    </tbody>
                </table>
            </div>
        `;
    }

    const htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <style>${PDF_CSS} .pdf-mode-active { zoom: 0.8; }</style>
        </head>
        <body class="pdf-mode-active">
            <h1>${shopSettings.name}</h1>
            <p style="text-align:center; font-size:16px; margin:0 0 5px 0; font-weight:bold; color:#1e3a8a;">${isDailySummary ? 'Day-by-Day Monthly Summary' : 'Monthly Financial Overview'}</p>
            <p style="text-align:center; font-size:14px; margin-top:0px; color:#475569;">Period: <strong>${filterMonth}/${filterYear}</strong></p>
            <p style="text-align:center; font-size:12px; margin-top:4px; color:#64748b;">${isDailySummary ? 'Daily roll-up table only (mobile Daily Summaries tab).' : 'Full month overview: income, payables, expenses, company summary (mobile Overview tab).'}</p>

            ${isDailySummary ? dailySummaryHtml : overviewHtml}

            <div class="footer">
                <h3 style="margin-bottom: 4px;">Software Developed by Hassan Ali Abrar</h3>
                <p style="margin: 0;">Instagram: <strong>hassan.secure</strong> | WhatsApp: <strong>+92 348 5055098</strong></p>
            </div>
        </body>
        </html>
    `;

    const yyyymm = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
    const fileName = isDailySummary
        ? `InventoryPro_MonthlyFinancial_DayByDay_${yyyymm}.pdf`
        : `InventoryPro_MonthlyFinancial_Overview_${yyyymm}.pdf`;
    return sharePdf(htmlContent, fileName);
};

function escapeHtmlSales(s) {
    if (s == null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Same rollup logic as web salesAnalyticsPdf.js */
export function computeSalesAnalytics(sales) {
    const byProduct = new Map();

    for (const s of sales) {
        const pid = s.product_id;
        const name = s.products?.name || `Product #${pid}`;
        const qty = Number(s.quantity || 0);
        const rev = Number(s.total_amount || 0);
        const rate = Number(s.products?.purchase_rate ?? 0);
        const cost = rate * qty;
        const profit = rev - cost;

        if (!byProduct.has(pid)) {
            byProduct.set(pid, {
                productId: pid,
                name,
                totalQty: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalProfit: 0,
                saleCount: 0,
            });
        }
        const a = byProduct.get(pid);
        a.totalQty += qty;
        a.totalRevenue += rev;
        a.totalCost += cost;
        a.totalProfit += profit;
        a.saleCount += 1;
    }

    const rows = Array.from(byProduct.values());
    const totalRevenue = sales.reduce((sum, x) => sum + Number(x.total_amount || 0), 0);
    const totalPaid = sales.reduce((sum, x) => sum + Number(x.paid_amount || 0), 0);
    const totalPending = totalRevenue - totalPaid;

    if (rows.length === 0) {
        return {
            rows: [],
            totalRevenue,
            totalPaid,
            totalPending,
            transactionCount: sales.length,
        };
    }

    const byQty = [...rows].sort((a, b) => b.totalQty - a.totalQty);
    const byProfit = [...rows].sort((a, b) => b.totalProfit - a.totalProfit);
    const byRev = [...rows].sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
        rows,
        totalRevenue,
        totalPaid,
        totalPending,
        transactionCount: sales.length,
        topByQty: byQty[0],
        lowestByQty: byQty[byQty.length - 1],
        topByProfit: byProfit[0],
        lowestByProfit: byProfit[byProfit.length - 1],
        topByRevenue: byRev[0],
        lowestByRevenue: byRev[byRev.length - 1],
    };
}

function salesAnalyticsInnerHtml(sales, analytics, periodLabel) {
    const gen = new Date().toLocaleString('en-GB');
    const {
        rows,
        totalRevenue,
        totalPaid,
        totalPending,
        transactionCount,
        topByQty,
        lowestByQty,
        topByProfit,
        lowestByProfit,
        topByRevenue,
        lowestByRevenue,
    } = analytics;

    const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

    const insight = (label, inner) =>
        `<tr>
            <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;color:#334155;width:42%;">${escapeHtmlSales(label)}</td>
            <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#0f172a;">${inner}</td>
        </tr>`;

    let insightsBody = '';
    if (rows.length > 0) {
        insightsBody =
            insight(
                'Most units sold',
                `<strong>${escapeHtmlSales(topByQty.name)}</strong> — ${topByQty.totalQty} pcs · ${fmtRs(topByQty.totalRevenue)} revenue`
            ) +
            insight(
                'Lowest selling (by quantity)',
                `<strong>${escapeHtmlSales(lowestByQty.name)}</strong> — ${lowestByQty.totalQty} pcs · ${fmtRs(lowestByQty.totalRevenue)} revenue`
            ) +
            insight(
                'Highest total profit',
                `<strong>${escapeHtmlSales(topByProfit.name)}</strong> — ${fmtRs(topByProfit.totalProfit)} profit · cost ${fmtRs(topByProfit.totalCost)}`
            ) +
            insight(
                'Lowest total profit',
                `<strong>${escapeHtmlSales(lowestByProfit.name)}</strong> — ${fmtRs(lowestByProfit.totalProfit)} profit · cost ${fmtRs(lowestByProfit.totalCost)}`
            ) +
            insight(
                'Highest revenue (product)',
                `<strong>${escapeHtmlSales(topByRevenue.name)}</strong> — ${fmtRs(topByRevenue.totalRevenue)}`
            ) +
            insight(
                'Lowest revenue (product)',
                `<strong>${escapeHtmlSales(lowestByRevenue.name)}</strong> — ${fmtRs(lowestByRevenue.totalRevenue)}`
            );
    } else {
        insightsBody = `<tr><td colspan="2" style="padding:16px;text-align:center;color:#64748b;">No product-level data for this period.</td></tr>`;
    }

    const productRows = rows
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .map(
            (r) => `<tr>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtmlSales(r.name)} <span style="color:#64748b;font-size:11px;">(${escapeHtmlSales(formatProductId(r.productId))})</span></td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${r.totalQty}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(r.totalRevenue)}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(r.totalCost)}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;color:${r.totalProfit >= 0 ? '#15803d' : '#b91c1c'};">${fmtRs(r.totalProfit)}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">${r.saleCount}</td>
            </tr>`
        )
        .join('');

    const detailRows = sales
        .map((sale, idx) => {
            const pending = Number(sale.total_amount || 0) - Number(sale.paid_amount || 0);
            const rate = Number(sale.products?.purchase_rate ?? 0);
            const qty = Number(sale.quantity || 0);
            const lineProfit = Number(sale.total_amount || 0) - rate * qty;
            return `<tr>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${idx + 1}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">#${sale.id}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${sale.purchase_date ? escapeHtmlSales(new Date(sale.purchase_date).toLocaleDateString('en-GB')) : '—'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${escapeHtmlSales(sale.products?.name || '—')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;">${escapeHtmlSales(sale.buyers?.name || 'Walk-in')}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${qty}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(sale.total_amount)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmtRs(sale.paid_amount)}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;">${pending > 0 ? fmtRs(pending) : '—'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:11px;">${fmtRs(lineProfit)}</td>
            </tr>`;
        })
        .join('');

    return `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
            <h1 style="margin:0 0 6px;font-size:22px;color:#1e3a8a;text-align:center;">Sales analytics report</h1>
            <p style="margin:0 0 4px;text-align:center;font-size:13px;color:#475569;">Period: <strong>${escapeHtmlSales(periodLabel)}</strong></p>
            <p style="margin:0 0 18px;text-align:center;font-size:11px;color:#64748b;">Generated ${escapeHtmlSales(gen)}</p>

            <div class="report-hero-stats" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:18px;justify-content:center;">
                <div class="stat-card-premium green" style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">TOTAL REVENUE</div>
                    <div style="font-size:18px;font-weight:700;color:#15803d;">${fmtRs(totalRevenue)}</div>
                </div>
                <div class="stat-card-premium purple" style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">TOTAL PAID</div>
                    <div style="font-size:18px;font-weight:700;color:#6d28d9;">${fmtRs(totalPaid)}</div>
                </div>
                <div class="stat-card-premium red" style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">PENDING (CREDIT)</div>
                    <div style="font-size:18px;font-weight:700;color:#b91c1c;">${fmtRs(totalPending)}</div>
                </div>
                <div style="flex:1;min-width:140px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fff;border-top:3px solid #3b82f6;">
                    <div style="font-size:10px;color:#64748b;font-weight:700;">TRANSACTIONS</div>
                    <div style="font-size:18px;font-weight:700;color:#1d4ed8;">${transactionCount}</div>
                </div>
            </div>

            <h2 style="font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:20px 0 10px;">Product insights</h2>
            <p style="font-size:11px;color:#64748b;margin:-4px 0 10px;">Profit = sale amount − (purchase rate × qty). Uses current product purchase rate.</p>
            <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:22px;">${insightsBody}</table>

            <h2 style="font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:20px 0 10px;">Summary by product</h2>
            <table class="premium-table" style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:22px;">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th style="text-align:right;">Qty</th>
                        <th style="text-align:right;">Revenue</th>
                        <th style="text-align:right;">Est. cost</th>
                        <th style="text-align:right;">Profit</th>
                        <th style="text-align:center;">Bills</th>
                    </tr>
                </thead>
                <tbody>${productRows || '<tr><td colspan="6" style="padding:12px;text-align:center;">—</td></tr>'}</tbody>
            </table>

            <h2 style="font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:20px 0 10px;">All transactions</h2>
            <table class="premium-table" style="width:100%;border-collapse:collapse;font-size:9px;">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Inv</th>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Customer</th>
                        <th style="text-align:right;">Qty</th>
                        <th style="text-align:right;">Total</th>
                        <th style="text-align:right;">Paid</th>
                        <th style="text-align:right;">Due</th>
                        <th style="text-align:right;">Profit</th>
                    </tr>
                </thead>
                <tbody>${detailRows || '<tr><td colspan="10" style="padding:12px;text-align:center;">—</td></tr>'}</tbody>
            </table>

            <div class="footer" style="margin-top:36px;padding-top:18px;border-top:2px solid #e2e8f0;">
                <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a;">Software Developed by Hassan Ali Abrar</h3>
                <p style="margin:0 0 6px;font-size:11px;color:#475569;">
                    Instagram: <strong style="color:#7c3aed;">hassan.secure</strong>
                    <span style="margin:0 10px;color:#cbd5e1;">|</span>
                    WhatsApp: <strong style="color:#059669;">+92 348 5055098</strong>
                </p>
                <p style="margin:0;font-size:10px;color:#64748b;">Contact for custom software development &amp; business automation</p>
                <p style="margin:10px 0 0;font-size:10px;color:#94a3b8;">Inventory Pro — Sales report</p>
            </div>
        </div>
    `;
}

/** Filtered sales list = same scope as on Sales screen */
export async function generateSalesAnalyticsPdf(filteredSales, periodLabel, activeFilterKey) {
    if (!filteredSales?.length) {
        throw new Error('No sales in this period to export.');
    }
    const analytics = computeSalesAnalytics(filteredSales);
    const inner = salesAnalyticsInnerHtml(filteredSales, analytics, periodLabel);
    const periodSeg = pdfNamePart(periodLabel || activeFilterKey || 'All', 28);
    const exportedOn = new Date().toISOString().split('T')[0];
    const fileName = `InventoryPro_SalesReport_${periodSeg}_${exportedOn}.pdf`;
    const htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>${PDF_CSS}</style>
        </head>
        <body>
            ${inner}
        </body>
        </html>
    `;
    return sharePdf(htmlContent, fileName);
}
