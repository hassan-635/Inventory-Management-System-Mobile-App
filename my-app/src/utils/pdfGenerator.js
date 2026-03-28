import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
        const { uri } = await Print.printToFileAsync({
            html: htmlContent,
            base64: false
        });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: defaultFileName });
    } catch (error) {
        console.error("PDF Generation Error: ", error);
        throw error;
    }
};

export const generateDailyReportPdf = async (reportDate, salesToday, returnsToday, productsToday, supplierTxns, buyersToday, suppliersToday) => {
    const totalSalesAmount = salesToday.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const totalCashPaid = salesToday.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
    const totalUdhaarGiven = totalSalesAmount - totalCashPaid;
    
    const totalReturnsAmount = returnsToday.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const totalReturnsQty = returnsToday.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    
    const supplierTotalAmount = supplierTxns.reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const supplierTotalPaid = supplierTxns.reduce((sum, t) => sum + Number(t.paid_amount || 0), 0);
    const totalUdhaarToSuppliers = supplierTotalAmount - supplierTotalPaid;

    const htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <style>${PDF_CSS}</style>
        </head>
        <body>
            <h1>Store Daily Report</h1>
            <p style="text-align:center; font-size:14px; margin-top:-5px; color:#475569;">Date: <strong>${new Date(reportDate).toLocaleDateString('en-GB')}</strong></p>

            <div class="report-hero-stats">
                <div class="stat-card-premium blue">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper">T</div>
                        <h3 class="stat-title">Total Sales Overview</h3>
                    </div>
                    <div class="stat-row"><span>Total Selling Amount:</span><span class="stat-value">Rs. ${totalSalesAmount.toLocaleString()}</span></div>
                    <div class="stat-row"><span>Cash Received:</span><span class="stat-value text-success">Rs. ${totalCashPaid.toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>Given on Udhaar:</span><span class="stat-value ${totalUdhaarGiven > 0 ? 'text-danger' : ''}">Rs. ${totalUdhaarGiven.toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium purple">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper">S</div>
                        <h3 class="stat-title">Supplier Payables (Today)</h3>
                    </div>
                    <div class="stat-row"><span>Total Bill (Purchases):</span><span class="stat-value">Rs. ${supplierTotalAmount.toLocaleString()}</span></div>
                    <div class="stat-row"><span>Cash Paid:</span><span class="stat-value text-success">Rs. ${supplierTotalPaid.toLocaleString()}</span></div>
                    <div class="stat-row highlight"><span>Owed to Suppliers:</span><span class="stat-value ${totalUdhaarToSuppliers > 0 ? 'text-danger' : ''}">Rs. ${totalUdhaarToSuppliers.toLocaleString()}</span></div>
                </div>

                <div class="stat-card-premium red">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper">R</div>
                        <h3 class="stat-title">Returns Overview</h3>
                    </div>
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

            <h2>Detailed Sales Log (${salesToday.length} records)</h2>
            ${salesToday.length === 0 ? '<p class="text-muted">No sales recorded today.</p>' : `
            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead><tr><th>Customer</th><th>Product Info</th><th>Qty</th><th>Total Amount</th><th>Paid Amount</th><th>Condition</th></tr></thead>
                    <tbody>
                        ${salesToday.map(sale => {
                            const t = Number(sale.total_amount || 0); const p = Number(sale.paid_amount || 0); const u = t - p;
                            return `<tr>
                                <td>${sale.buyer_name || (sale.buyers && sale.buyers.name) || 'Walk-in Customer'}</td>
                                <td><strong>${(sale.products && sale.products.name) || ('Product ID ' + sale.product_id)}</strong></td>
                                <td>${sale.quantity}</td>
                                <td><strong>Rs. ${t.toLocaleString()}</strong></td>
                                <td class="text-success"><strong>Rs. ${p.toLocaleString()}</strong></td>
                                <td>${u > 0 ? '<span class="text-danger">Udhaar: Rs.' + u.toLocaleString() + '</span>' : '<span class="text-success">Clear</span>'}</td>
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

    return sharePdf(htmlContent, `Daily_Report_${reportDate}.pdf`);
};

export const generateInvoicePdf = async (transactionInfo, cartItems, customerName, totalBill, discount, finalAmount, customPaymentDate) => {
    let htmlContent = `
        <html>
        <head>
            <meta charset="utf-8">
            <style>${PDF_CSS}</style>
            <style>
                .invoice-header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
                .shop-details { flex: 1;}
                .shop-name { font-size: 24px; font-weight: 900; color: #1e3a8a; margin: 0 0 5px 0;}
                .invoice-details { text-align: right; }
                .invoice-details p { margin: 2px 0; font-size: 13px; }
            </style>
        </head>
        <body>
            <div class="invoice-header">
                <div class="shop-details">
                    <h1 class="shop-name" style="text-align:left;">JELLANI HARDWARE, PAINT AND ELECTRIC STORE</h1>
                    <p style="margin:2px 0; font-size:13px;">Main Kallar Syedan Road, Near DHA Phase 7 Gate 1</p>
                    <p style="margin:2px 0; font-size:13px;">📞 0329-5749291</p>
                </div>
                <div class="invoice-details">
                    <h2 style="margin:0 !important; font-size:20px !important; border:none !important;">INVOICE</h2>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
                    <p><strong>Billed To:</strong> ${customerName || 'Walk-In Customer'}</p>
                    ${customPaymentDate ? `<p><strong>Due Date:</strong> ${new Date(customPaymentDate).toLocaleDateString('en-GB')}</p>` : ''}
                </div>
            </div>

            <div class="premium-table-wrap">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th style="text-align:center;">Qty</th>
                            <th style="text-align:center;">Unit Price</th>
                            <th style="text-align:right;">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cartItems.map(item => `
                            <tr>
                                <td>${item.name} <span class="text-muted">(${item.selectedUnit || 'Piece'})</span></td>
                                <td style="text-align:center;">${item.quantity}</td>
                                <td style="text-align:center;">Rs. ${item.unitPrice.toLocaleString()}</td>
                                <td style="text-align:right;"><strong>Rs. ${(item.quantity * item.unitPrice).toLocaleString()}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        ${discount > 0 ? `
                        <tr><td colspan="3" style="text-align:right;">Subtotal:</td><td style="text-align:right;">Rs. ${totalBill.toLocaleString()}</td></tr>
                        <tr><td colspan="3" style="text-align:right;">Discount:</td><td style="text-align:right; color:#dc2626;">- Rs. ${discount.toLocaleString()}</td></tr>
                        ` : ''}
                        <tr><td colspan="3" style="text-align:right; font-size:14px;"><strong>GRAND TOTAL:</strong></td><td style="text-align:right; font-size:14px;"><strong>Rs. ${finalAmount.toLocaleString()}</strong></td></tr>
                        <tr><td colspan="3" style="text-align:right; color:#16a34a;"><strong>PAID AMOUNT:</strong></td><td style="text-align:right; color:#16a34a;"><strong>Rs. ${Number(transactionInfo?.amount || 0).toLocaleString()}</strong></td></tr>
                        ${Number(finalAmount) - Number(transactionInfo?.amount || 0) > 0 ? `
                            <tr><td colspan="3" style="text-align:right; color:#dc2626;"><strong>REMAINING (UDHAAR):</strong></td><td style="text-align:right; color:#dc2626;"><strong>Rs. ${(Number(finalAmount) - Number(transactionInfo?.amount || 0)).toLocaleString()}</strong></td></tr>
                        ` : ''}
                    </tfoot>
                </table>
            </div>

            <div class="footer">
                <h3 style="margin-bottom: 4px;">Thank you for your business!</h3>
                <p style="margin: 0;">Software Developed by Hassan Ali Abrar (Insta: hassan.secure | WhatsApp: +92 348 5055098)</p>
            </div>
        </body>
        </html>
    `;

    return sharePdf(htmlContent, `Invoice_${customerName || 'WalkIn'}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateMonthlyReportPdf = async (reportData, filterMonth, filterYear, isDailySummary) => {
    const { summary, expense_breakdown, activity_lists, company_wise_summary, daily_breakdown } = reportData;

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
                        <div class="stat-row"><span>Udhaar Installments Received:</span><span class="stat-value" style="color:#0ea5e9;">Rs. ${(summary.total_sales_collected_this_month || 0).toLocaleString()}</span></div>
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
                        <tr><th>Date</th><th style="text-align:right;">Sales (#)</th><th style="text-align:right;">Total Sale Value</th><th style="text-align:right;">Cash Received</th><th style="text-align:right;">New Udhaar</th><th style="text-align:right;">Returns Value</th><th style="text-align:right;">Expenses</th></tr>
                    </thead>
                    <tbody>
                        ${daily_breakdown?.map(day => `
                            <tr>
                                <td><strong>${new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</strong></td>
                                <td style="text-align:right;">${day.num_new_sales || '-'}</td>
                                <td style="text-align:right; color:#0ea5e9;">${day.total_sales ? 'Rs. ' + day.total_sales.toLocaleString() : '-'}</td>
                                <td style="text-align:right;" class="text-success">${day.cash_in ? 'Rs. ' + day.cash_in.toLocaleString() : '-'}</td>
                                <td style="text-align:right; color:#f59e0b;">${day.udhaar_given ? 'Rs. ' + day.udhaar_given.toLocaleString() : '-'}</td>
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
            <h1>${isDailySummary ? 'Day-by-Day Monthly Summary' : 'Monthly Summary'}</h1>
            <p style="text-align:center; font-size:14px; margin-top:-5px; color:#475569;">Period: <strong>${filterMonth}/${filterYear}</strong></p>

            ${isDailySummary ? dailySummaryHtml : overviewHtml}

            <div class="footer">
                <h3 style="margin-bottom: 4px;">Software Developed by Hassan Ali Abrar</h3>
                <p style="margin: 0;">Instagram: <strong>hassan.secure</strong> | WhatsApp: <strong>+92 348 5055098</strong></p>
            </div>
        </body>
        </html>
    `;

    return sharePdf(htmlContent, `Monthly_Report_${filterYear}_${filterMonth}_${isDailySummary ? 'Daily' : 'Overview'}.pdf`);
};
