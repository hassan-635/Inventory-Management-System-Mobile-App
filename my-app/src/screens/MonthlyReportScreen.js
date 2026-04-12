import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl, Modal, Alert, useWindowDimensions,
} from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '../store/authStore';
import { useAppTheme } from '../theme/useAppTheme';
import { generateMonthlyReportPdf } from '../utils/pdfGenerator';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlyReportScreen() {
    const { colors, FONTS } = useAppTheme();
    const { width } = useWindowDimensions();
    const isTablet = width > 768;
    const styles = useMemo(() => getStyles(colors, FONTS, isTablet), [colors, FONTS, isTablet]);

    const { token } = useAuthStore();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(currentYear);
    const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'daily_summary'
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const fetchReport = useCallback(async () => {
        try {
            const formattedMonth = selectedMonth.toString().padStart(2, '0');
            const res = await axios.get(`${API_URL}/reports/monthly?year=${selectedYear}&month=${formattedMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReportData(res.data);
        } catch (error) {
            console.error('Fetch report error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedYear, selectedMonth, token]);

    useEffect(() => {
        setLoading(true);
        fetchReport();
    }, [fetchReport]);

    useRefetchOnFocus(fetchReport, [selectedYear, selectedMonth, token]);

    const onRefresh = () => { setRefreshing(true); fetchReport(); };

    const handleDownloadPdf = async () => {
        if (!reportData) return;
        setGeneratingPdf(true);
        try {
            const formattedMonth = selectedMonth.toString().padStart(2, '0');
            await generateMonthlyReportPdf(
                reportData,
                formattedMonth,
                selectedYear,
                viewMode === 'daily_summary',
            );
        } catch (e) {
            Alert.alert('Error', 'Could not generate PDF. Please try again.');
        } finally {
            setGeneratingPdf(false);
        }
    };

    const changeMonth = (increment) => {
        let newMonth = selectedMonth + increment;
        let newYear = selectedYear;
        if (newMonth > 12) { newMonth = 1; newYear += 1; }
        else if (newMonth < 1) { newMonth = 12; newYear -= 1; }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    if (!reportData) {
        return (
            <View style={styles.centerContainer}>
                <Text style={{ color: colors.text.secondary }}>Failed to load report data.</Text>
            </View>
        );
    }

    const { summary, expense_breakdown, activity_lists, company_wise_summary, product_profit_list, supplier_purchase_summary } = reportData;
    const paymentSplit = summary.payment_split || { cash: 0, online: 0, split_count: 0 };
    const cashSalesList = activity_lists?.cash_sales_by_salesman || [];
    const creditList = activity_lists?.credit_payments_received || [];
    const supplierPayments = activity_lists?.payments_made_to_suppliers || [];
    const companySummary = company_wise_summary || [];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.headerTitle}>
                        {viewMode === 'overview' ? 'Monthly Report' : 'Day-by-Day Summary'}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {viewMode === 'overview'
                            ? 'Poora mahina — income, expenses, company summary'
                            : 'Roz ka chhota hisaab (overview jaisi detail yahan nahi)'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.pdfBtn, generatingPdf && { opacity: 0.6 }]}
                    onPress={handleDownloadPdf}
                    disabled={generatingPdf}
                >
                    {generatingPdf
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Icon name="download-outline" size={16} color="#fff" />
                    }
                    <Text style={styles.pdfBtnText}>
                        {generatingPdf
                            ? 'Generating...'
                            : viewMode === 'daily_summary'
                                ? 'Daily PDF'
                                : 'Overview PDF'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.dateSelectorRow}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => changeMonth(-1)}>
                    <Icon name="chevron-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateSelectorCenter} onPress={() => { setPickerYear(selectedYear); setShowMonthPicker(true); }}>
                    <Text style={styles.dateLabel}>{monthNames[selectedMonth - 1]} {selectedYear}</Text>
                    <Icon name="calendar-outline" size={16} color={colors.text.secondary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => changeMonth(1)}>
                    <Icon name="chevron-forward" size={24} color={colors.text.primary} />
                </TouchableOpacity>
            </View>

            {/* Overview / Daily Summary Toggle */}
            <View style={styles.toggleRow}>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'overview' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('overview')}
                >
                    <Icon name="pie-chart-outline" size={14} color={viewMode === 'overview' ? '#fff' : colors.text.secondary} />
                    <Text style={[styles.toggleBtnText, viewMode === 'overview' && { color: '#fff' }]}>Overview</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'daily_summary' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('daily_summary')}
                >
                    <Icon name="calendar-outline" size={14} color={viewMode === 'daily_summary' ? '#fff' : colors.text.secondary} />
                    <Text style={[styles.toggleBtnText, viewMode === 'daily_summary' && { color: '#fff' }]}>Daily Summaries</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
            >
                {viewMode === 'overview' && (
                <>
                {/* Key Metrics */}
                <View style={styles.statsGrid}>
                    {/* Net Real Profit */}
                    <View style={[styles.statCard, { borderLeftColor: (summary.net_real_profit || 0) >= 0 ? '#22c55e' : '#ef4444', borderLeftWidth: 4 }]}>
                        <Icon name={(summary.net_real_profit || 0) >= 0 ? 'trending-up' : 'trending-down'} size={22} color={(summary.net_real_profit || 0) >= 0 ? '#22c55e' : '#ef4444'} style={styles.statIcon} />
                        <Text style={styles.statTitle}>Net Real Profit</Text>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>Product Margin:</Text><Text style={[styles.ledgerAmt, { color: '#22c55e' }]}>Rs. {(summary.product_profit || 0).toLocaleString()}</Text></View>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>Less Expenses:</Text><Text style={[styles.ledgerAmt, { color: '#ef4444' }]}>- Rs. {summary.total_expenses.toLocaleString()}</Text></View>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>Less Returns:</Text><Text style={[styles.ledgerAmt, { color: '#ef4444' }]}>- Rs. {(summary.total_returns_this_month || 0).toLocaleString()}</Text></View>
                        <Text style={[styles.statValue, { color: (summary.net_real_profit || 0) >= 0 ? '#22c55e' : '#ef4444', marginTop: 8 }]}>
                            Rs. {(summary.net_real_profit || 0).toLocaleString()}
                        </Text>
                    </View>

                    {/* Payment Method Split */}
                    <View style={[styles.statCard, { borderLeftColor: '#38bdf8', borderLeftWidth: 4 }]}>
                        <Icon name="card-outline" size={22} color="#38bdf8" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Payment Received By Method</Text>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>💵 Cash:</Text><Text style={[styles.ledgerAmt, { color: '#22c55e' }]}>Rs. {(paymentSplit.cash || 0).toLocaleString()}</Text></View>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>📱 Online:</Text><Text style={[styles.ledgerAmt, { color: '#38bdf8' }]}>Rs. {(paymentSplit.online || 0).toLocaleString()}</Text></View>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>Split Txns:</Text><Text style={styles.ledgerAmt}>{paymentSplit.split_count || 0}</Text></View>
                        <Text style={[styles.statValue, { color: '#38bdf8', marginTop: 8 }]}>
                            Total: Rs. {((paymentSplit.cash || 0) + (paymentSplit.online || 0)).toLocaleString()}
                        </Text>
                    </View>

                    <View style={[styles.statCard, { borderLeftColor: '#f97316', borderLeftWidth: 4 }]}>
                        <Icon name="wallet" size={22} color="#f97316" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Total Expenses</Text>
                        <Text style={[styles.statValue, { color: '#f97316' }]}>Rs. {summary.total_expenses.toLocaleString()}</Text>
                    </View>

                    <View style={[styles.statCard, { borderLeftColor: '#a855f7', borderLeftWidth: 4 }]}>
                        <Icon name="cube-outline" size={22} color="#a855f7" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Stock Purchased</Text>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>Total Bills:</Text><Text style={styles.ledgerAmt}>Rs. {summary.total_purchases_created_value.toLocaleString()}</Text></View>
                        <View style={styles.ledgerRow}><Text style={styles.ledgerText}>Cash Paid:</Text><Text style={[styles.ledgerAmt, { color: '#22c55e' }]}>Rs. {summary.total_purchases_paid_this_month.toLocaleString()}</Text></View>
                        <Text style={[styles.statValue, { color: '#a855f7', marginTop: 8 }]}>Cr: Rs. {summary.total_credit_taken_this_month.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Ledger Cards */}
                <View style={styles.ledgerSection}>
                    {/* INFLOW */}
                    <View style={[styles.ledgerCard, { borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                        <View style={styles.ledgerHeader}>
                            <Icon name="arrow-down-circle" size={20} color="#22c55e" />
                            <Text style={[styles.ledgerTitle, { color: '#22c55e' }]}>Income (In)</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Sales Invoices Made</Text>
                            <Text style={styles.ledgerAmt}>Rs. {summary.total_sales_created_value.toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Cash Sales (Fully Paid)</Text>
                            <Text style={[styles.ledgerAmt, { color: '#22c55e' }]}>Rs. {(summary.total_cash_sales_this_month || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Credit Installments Received</Text>
                            <Text style={[styles.ledgerAmt, { color: '#a78bfa' }]}>Rs. {summary.total_sales_collected_this_month.toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>💵 Cash Received:</Text>
                            <Text style={[styles.ledgerAmt, { color: '#22c55e' }]}>Rs. {(paymentSplit.cash || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>📱 Online Received:</Text>
                            <Text style={[styles.ledgerAmt, { color: '#38bdf8' }]}>Rs. {(paymentSplit.online || 0).toLocaleString()}</Text>
                        </View>
                        <View style={[styles.ledgerRow, styles.ledgerRowBorder]}>
                            <Text style={styles.ledgerText}>New Credit Given</Text>
                            <Text style={[styles.ledgerAmt, { color: '#eab308' }]}>Rs. {summary.total_credit_given_this_month.toLocaleString()}</Text>
                        </View>
                    </View>

                    {/* OUTFLOW */}
                    <View style={[styles.ledgerCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                        <View style={styles.ledgerHeader}>
                            <Icon name="arrow-up-circle" size={20} color="#ef4444" />
                            <Text style={[styles.ledgerTitle, { color: '#ef4444' }]}>Payables (Out)</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Purchase Invoices Made</Text>
                            <Text style={styles.ledgerAmt}>Rs. {summary.total_purchases_created_value.toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Cash Paid to Suppliers</Text>
                            <Text style={[styles.ledgerAmt, { color: '#ef4444' }]}>Rs. {summary.total_purchases_paid_this_month.toLocaleString()}</Text>
                        </View>
                        <View style={[styles.ledgerRow, styles.ledgerRowBorder]}>
                            <Text style={styles.ledgerText}>Credit Taken</Text>
                            <Text style={[styles.ledgerAmt, { color: '#8b5cf6' }]}>Rs. {summary.total_credit_taken_this_month.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>

                {/* All-Time Pending Alert */}
                <View style={styles.alertPanel}>
                    <Icon name="warning" size={24} color="#eab308" />
                    <View style={styles.alertTextWrapper}>
                        <Text style={styles.alertTitle}>All-Time Pending Dues (Customers)</Text>
                        <Text style={styles.alertSub}>Total: Rs. {summary.total_all_time_dues_from_buyers.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Cash Sales by Salesman */}
                {cashSalesList.length > 0 && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="cash" size={18} color="#22c55e" />
                            <Text style={[styles.cardHeader, { color: '#22c55e' }]}>Cash Collected (by Salesman)</Text>
                        </View>
                        {/* Table Header */}
                        <View style={[styles.tableRow, styles.tableHeaderRow]}>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Salesman</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Bills</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Collected</Text>
                        </View>
                        {cashSalesList.map((s) => (
                            <View key={s.id} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{s.salesman_name}</Text>
                                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', color: colors.text.muted }]}>{s.num_cash_bills}</Text>
                                <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', color: '#22c55e', fontFamily: FONTS.bold }]}>
                                    Rs. {s.total_cash_collected.toLocaleString()}
                                </Text>
                            </View>
                        ))}
                        {/* Total row */}
                        <View style={[styles.tableRow, styles.totalRow]}>
                            <Text style={[styles.totalText, { flex: 2 }]}>Total</Text>
                            <Text style={[styles.totalText, { flex: 1, textAlign: 'center' }]}>
                                {cashSalesList.reduce((s, r) => s + r.num_cash_bills, 0)}
                            </Text>
                            <Text style={[styles.totalText, { flex: 2, textAlign: 'right', color: '#22c55e' }]}>
                                Rs. {(summary.total_cash_sales_this_month || 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Credit Installments Received */}
                {creditList.length > 0 && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="people" size={18} color="#a78bfa" />
                            <Text style={[styles.cardHeader, { color: '#a78bfa' }]}>Credit Installments Received</Text>
                        </View>
                        <View style={[styles.tableRow, styles.tableHeaderRow]}>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Phone</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Received</Text>
                        </View>
                        {creditList.map((b) => (
                            <View key={b.id} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{b.name}</Text>
                                <Text style={[styles.tableCell, { flex: 2, color: colors.text.muted }]} numberOfLines={1}>{b.phone}</Text>
                                <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', color: '#a78bfa', fontFamily: FONTS.bold }]}>
                                    Rs. {b.amount_paid_this_month.toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Supplier Payments */}
                {supplierPayments.length > 0 && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="cube" size={18} color="#ef4444" />
                            <Text style={[styles.cardHeader, { color: '#ef4444' }]}>Payments to Suppliers</Text>
                        </View>
                        <View style={[styles.tableRow, styles.tableHeaderRow]}>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Supplier</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Paid</Text>
                        </View>
                        {supplierPayments.map((s) => (
                            <View key={s.id} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{s.name}</Text>
                                <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', color: '#ef4444', fontFamily: FONTS.bold }]}>
                                    Rs. {s.amount_paid_this_month.toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Expense Breakdown */}
                {Object.keys(expense_breakdown).length > 0 && (
                    <View style={styles.whiteCard}>
                        <Text style={styles.cardHeader}>Expense Breakdown</Text>
                        {Object.entries(expense_breakdown).map(([cat, amt]) => (
                            <View key={cat} style={styles.breakdownRow}>
                                <Text style={styles.breakdownCat}>{cat}</Text>
                                <Text style={styles.breakdownAmt}>Rs. {amt.toLocaleString()}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Product-Wise Profit */}
                {product_profit_list && product_profit_list.length > 0 && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="trending-up" size={18} color="#10b981" />
                            <Text style={[styles.cardHeader, { color: '#10b981' }]}>Product-Wise Profit</Text>
                        </View>
                        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
                            <View>
                                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                                    <Text style={[styles.tableHeaderText, { width: 120 }]}>Product</Text>
                                    <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'center' }]}>Qty</Text>
                                    <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Sale Rate</Text>
                                    <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Buy Rate</Text>
                                    <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Profit/Unit</Text>
                                    <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'right' }]}>Total Profit</Text>
                                </View>
                                {product_profit_list.map((p, i) => (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { width: 120, fontFamily: FONTS.medium }]} numberOfLines={1}>{p.product_name}</Text>
                                        <Text style={[styles.tableCell, { width: 50, textAlign: 'center', color: colors.text.secondary }]}>{p.total_qty_sold}</Text>
                                        <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>Rs.{p.sale_rate.toLocaleString()}</Text>
                                        <Text style={[styles.tableCell, { width: 80, textAlign: 'right', color: '#ef4444' }]}>Rs.{p.purchase_rate.toLocaleString()}</Text>
                                        <Text style={[styles.tableCell, { width: 80, textAlign: 'right', color: (p.sale_rate - p.purchase_rate) >= 0 ? '#22c55e' : '#ef4444', fontFamily: FONTS.medium }]}>Rs.{(p.sale_rate - p.purchase_rate).toLocaleString()}</Text>
                                        <Text style={[styles.tableCell, { width: 90, textAlign: 'right', color: p.total_profit >= 0 ? '#22c55e' : '#ef4444', fontFamily: FONTS.bold }]}>Rs.{p.total_profit.toLocaleString()}</Text>
                                    </View>
                                ))}
                                <View style={[styles.tableRow, styles.totalRow]}>
                                    <Text style={[styles.totalText, { width: 120 }]}>Total</Text>
                                    <Text style={[styles.totalText, { width: 50, textAlign: 'center' }]}>{product_profit_list.reduce((s, p) => s + p.total_qty_sold, 0)}</Text>
                                    <Text style={[styles.totalText, { width: 80 }]}></Text>
                                    <Text style={[styles.totalText, { width: 80 }]}></Text>
                                    <Text style={[styles.totalText, { width: 80 }]}></Text>
                                    <Text style={[styles.totalText, { width: 90, textAlign: 'right', color: '#22c55e' }]}>Rs.{product_profit_list.reduce((s, p) => s + p.total_profit, 0).toLocaleString()}</Text>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* Supplier Purchase Summary */}
                {supplier_purchase_summary && supplier_purchase_summary.length > 0 && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="cube" size={18} color="#a855f7" />
                            <Text style={[styles.cardHeader, { color: '#a855f7' }]}>Supplier-Wise Purchases</Text>
                        </View>
                        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
                            <View>
                                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                                    <Text style={[styles.tableHeaderText, { width: 110 }]}>Supplier</Text>
                                    <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'right' }]}>Total Bought</Text>
                                    <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Cash Paid</Text>
                                    <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Remaining</Text>
                                </View>
                                {supplier_purchase_summary.map((s, i) => (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { width: 110, fontFamily: FONTS.medium }]} numberOfLines={1}>{s.supplier_name}</Text>
                                        <Text style={[styles.tableCell, { width: 90, textAlign: 'right', fontFamily: FONTS.medium }]}>Rs.{s.total_purchased.toLocaleString()}</Text>
                                        <Text style={[styles.tableCell, { width: 80, textAlign: 'right', color: '#22c55e' }]}>Rs.{s.total_paid.toLocaleString()}</Text>
                                        <Text style={[styles.tableCell, { width: 80, textAlign: 'right', color: s.total_outstanding > 0 ? '#ef4444' : '#22c55e', fontFamily: FONTS.bold }]}>
                                            {s.total_outstanding > 0 ? `Rs.${s.total_outstanding.toLocaleString()}` : '✓'}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* Company-Wise Summary */}
                {companySummary.length > 0 && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="business" size={18} color="#38bdf8" />
                            <Text style={[styles.cardHeader, { color: '#38bdf8' }]}>Company-Wise Summary</Text>
                        </View>
                        <View style={[styles.tableRow, styles.tableHeaderRow]}>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Company</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Sales</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Pending</Text>
                        </View>
                        {companySummary.map((c, idx) => (
                            <View key={idx} style={styles.tableRow}>
                                <Text style={[styles.tableCell, { flex: 2, fontFamily: FONTS.medium }]} numberOfLines={1}>
                                    {c.company_name === 'Walk-in / No Company' ? 'Walk-in' : c.company_name}
                                </Text>
                                <Text style={[styles.tableCell, { flex: 2, textAlign: 'right' }]}>
                                    Rs. {c.total_sales.toLocaleString()}
                                </Text>
                                <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', color: c.total_outstanding > 0 ? '#ef4444' : '#22c55e', fontFamily: FONTS.bold }]}>
                                    {c.total_outstanding > 0 ? `Rs. ${c.total_outstanding.toLocaleString()}` : '✓ Clear'}
                                </Text>
                            </View>
                        ))}
                        <View style={[styles.tableRow, styles.totalRow]}>
                            <Text style={[styles.totalText, { flex: 2 }]}>Total</Text>
                            <Text style={[styles.totalText, { flex: 2, textAlign: 'right' }]}>
                                Rs. {companySummary.reduce((s, c) => s + c.total_sales, 0).toLocaleString()}
                            </Text>
                            <Text style={[styles.totalText, { flex: 2, textAlign: 'right', color: '#ef4444' }]}>
                                Rs. {companySummary.reduce((s, c) => s + c.total_outstanding, 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                )}
                </>
                )}

                {/* Daily summaries only — same columns as web + PDF */}
                {viewMode === 'daily_summary' && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="calendar-outline" size={18} color={colors.accent.primary} />
                            <Text style={[styles.cardHeader, { color: colors.accent.primary }]}>Month day-by-day breakdown</Text>
                        </View>
                        <Text style={styles.dailyHelperText}>
                            Daily: sales count, total invoice value, cash received, new credit, returns, expenses.
                        </Text>
                        {(!reportData.daily_breakdown || reportData.daily_breakdown.length === 0) ? (
                            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                                <Icon name="calendar-outline" size={36} color={colors.text.secondary} />
                                <Text style={{ color: colors.text.secondary, marginTop: 10, fontFamily: FONTS.regular }}>No activity recorded this month.</Text>
                            </View>
                        ) : (
                            <ScrollView
                                horizontal
                                nestedScrollEnabled
                                showsHorizontalScrollIndicator
                                style={styles.dailyTableScroll}
                                contentContainerStyle={styles.dailyTableScrollContent}
                            >
                                <View style={{ minWidth: Math.max(width - 32, 720) }}>
                                    <View style={[styles.tableRow, styles.tableHeaderRow]}>
                                        <Text style={[styles.tableHeaderText, styles.dailyColDate]}>Date</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColNum]}>Sales</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColMoney]}>Total Sale</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColMoney]}>💵 Cash</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColMoney]}>📱 Online</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColMoney]}>Credit</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColMoney]}>Returns</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColMoney]}>Expenses</Text>
                                        <Text style={[styles.tableHeaderText, styles.dailyColMoney]}>Profit</Text>
                                    </View>
                                    {reportData.daily_breakdown.map((day, idx) => (
                                        <View key={idx} style={styles.tableRow}>
                                            <Text style={[styles.tableCell, styles.dailyColDate, { fontFamily: FONTS.medium }]}>
                                                {new Date(day.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColNum, { textAlign: 'right', color: colors.text.secondary }]}>
                                                {day.num_new_sales > 0 ? day.num_new_sales : '-'}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColMoney, { textAlign: 'right', color: '#38bdf8' }]}>
                                                {Number(day.total_sales || 0) > 0 ? `Rs.${Number(day.total_sales).toLocaleString()}` : '-'}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColMoney, { textAlign: 'right', color: '#22c55e' }]}>
                                                {(day.cash_received || 0) > 0 ? `Rs.${(day.cash_received).toLocaleString()}` : '-'}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColMoney, { textAlign: 'right', color: '#38bdf8' }]}>
                                                {(day.online_received || 0) > 0 ? `Rs.${(day.online_received).toLocaleString()}` : '-'}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColMoney, { textAlign: 'right', color: day.credit_given > 0 ? '#f59e0b' : colors.text.secondary }]}>
                                                {day.credit_given > 0 ? `Rs.${day.credit_given.toLocaleString()}` : '-'}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColMoney, { textAlign: 'right', color: Number(day.returned_sales_value || 0) > 0 ? '#ef4444' : colors.text.secondary }]}>
                                                {Number(day.returned_sales_value || 0) > 0 ? `Rs.${Number(day.returned_sales_value).toLocaleString()}` : '-'}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColMoney, { textAlign: 'right', color: day.expenses > 0 ? '#ef4444' : colors.text.secondary }]}>
                                                {day.expenses > 0 ? `Rs.${day.expenses.toLocaleString()}` : '-'}
                                            </Text>
                                            <Text style={[styles.tableCell, styles.dailyColMoney, { textAlign: 'right', color: (day.daily_profit || 0) >= 0 ? '#22c55e' : '#ef4444', fontFamily: FONTS.bold }]}>
                                                {(day.daily_profit || 0) !== 0 ? `Rs.${(day.daily_profit || 0).toLocaleString()}` : '-'}
                                            </Text>
                                        </View>
                                    ))}
                                    <View style={[styles.tableRow, styles.dailyTotalRow]}>
                                        <Text style={[styles.totalText, styles.dailyColDate]}>Month</Text>
                                        <Text style={[styles.totalText, styles.dailyColNum, { textAlign: 'right' }]}>
                                            {reportData.daily_breakdown.reduce((s, d) => s + d.num_new_sales, 0)}
                                        </Text>
                                        <Text style={[styles.totalText, styles.dailyColMoney, { textAlign: 'right', color: '#38bdf8' }]}>
                                            Rs.{reportData.daily_breakdown.reduce((s, d) => s + Number(d.total_sales || 0), 0).toLocaleString()}
                                        </Text>
                                        <Text style={[styles.totalText, styles.dailyColMoney, { textAlign: 'right', color: '#22c55e' }]}>
                                            Rs.{reportData.daily_breakdown.reduce((s, d) => s + (d.cash_received || 0), 0).toLocaleString()}
                                        </Text>
                                        <Text style={[styles.totalText, styles.dailyColMoney, { textAlign: 'right', color: '#38bdf8' }]}>
                                            Rs.{reportData.daily_breakdown.reduce((s, d) => s + (d.online_received || 0), 0).toLocaleString()}
                                        </Text>
                                        <Text style={[styles.totalText, styles.dailyColMoney, { textAlign: 'right', color: '#f59e0b' }]}>
                                            Rs.{reportData.daily_breakdown.reduce((s, d) => s + d.credit_given, 0).toLocaleString()}
                                        </Text>
                                        <Text style={[styles.totalText, styles.dailyColMoney, { textAlign: 'right', color: '#ef4444' }]}>
                                            Rs.{reportData.daily_breakdown.reduce((s, d) => s + Number(d.returned_sales_value || 0), 0).toLocaleString()}
                                        </Text>
                                        <Text style={[styles.totalText, styles.dailyColMoney, { textAlign: 'right', color: '#ef4444' }]}>
                                            Rs.{reportData.daily_breakdown.reduce((s, d) => s + d.expenses, 0).toLocaleString()}
                                        </Text>
                                        <Text style={[styles.totalText, styles.dailyColMoney, { textAlign: 'right', color: '#22c55e' }]}>
                                            Rs.{reportData.daily_breakdown.reduce((s, d) => s + (d.daily_profit || 0), 0).toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                )}

            </ScrollView>

            {/* Custom Month/Year Picker Modal */}
            <Modal visible={showMonthPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.monthPickerBox}>
                        <View style={styles.yearRow}>
                            <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={styles.yearBtn}>
                                <Icon name="chevron-back" size={20} color={colors.text.primary}/>
                            </TouchableOpacity>
                            <Text style={styles.yearText}>{pickerYear}</Text>
                            <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={styles.yearBtn}>
                                <Icon name="chevron-forward" size={20} color={colors.text.primary}/>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.monthsGrid}>
                            {monthNames.map((m, index) => {
                                const isActive = pickerYear === selectedYear && (index + 1) === selectedMonth;
                                return (
                                    <TouchableOpacity 
                                        key={m} 
                                        style={[styles.monthCell, isActive && styles.monthCellActive]}
                                        onPress={() => { 
                                            setSelectedYear(pickerYear);
                                            setSelectedMonth(index + 1);
                                            setShowMonthPicker(false); 
                                        }}
                                    >
                                        <Text style={[styles.monthCellText, isActive && { color: '#fff' }]}>{m}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowMonthPicker(false)}>
                            <Text style={styles.closePickerText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (colors, FONTS, isTablet) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 5 },
    headerTitle: { fontSize: 22, color: colors.text.primary, fontFamily: FONTS.bold },
    headerSubtitle: { fontSize: 12, color: colors.text.secondary, fontFamily: FONTS.regular, marginTop: 4, maxWidth: 260 },
    dailyHelperText: { fontSize: 12, color: colors.text.muted, fontFamily: FONTS.regular, marginBottom: 12, lineHeight: 18 },
    dailyTableScroll: { marginHorizontal: -4 },
    dailyTableScrollContent: { paddingBottom: 8 },
    dailyColDate: { width: 76, flexShrink: 0, fontSize: 12 },
    dailyColNum: { width: 48, flexShrink: 0, fontSize: 12 },
    dailyColMoney: { width: 88, flexShrink: 0, fontSize: 11 },
    dailyTotalRow: {
        borderTopWidth: 2,
        borderTopColor: colors.border.color || 'rgba(255,255,255,0.15)',
        borderBottomWidth: 0,
        marginTop: 6,
        paddingTop: 10,
    },

    pdfBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.accent.primary, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 10, shadowColor: colors.accent.primary, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 5, elevation: 4
    },
    pdfBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 12 },

    toggleRow: {
        flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 10,
        backgroundColor: colors.background.secondary, padding: 4, gap: 4
    },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8 },
    toggleBtnActive: { backgroundColor: colors.accent.primary },
    toggleBtnText: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },

    dateSelectorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginHorizontal: 16, backgroundColor: colors.background.secondary, borderRadius: 12, marginBottom: 15, paddingHorizontal: 16 },
    dateSelectorCenter: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
    dateBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
    dateLabel: { fontSize: 18, color: colors.text.primary, fontFamily: FONTS.bold, textAlign: 'center' },

    scrollContainer: { paddingHorizontal: 16, ...(isTablet && { paddingHorizontal: 32 }) },

    statsGrid: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    statCard: { 
        flex: 1, 
        backgroundColor: colors.background.secondary, 
        padding: 18, 
        borderRadius: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 
    },
    statIcon: { marginBottom: 12 },
    statTitle: { color: colors.text.secondary, fontSize: 13, fontFamily: FONTS.medium, marginBottom: 5 },
    statValue: { fontSize: 18, fontFamily: FONTS.bold },

    ledgerSection: { gap: 15, marginBottom: 20 },
    ledgerCard: { 
        backgroundColor: colors.background.secondary, padding: 20, borderRadius: 16, borderWidth: 1,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 
    },
    ledgerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 8 },
    ledgerTitle: { fontSize: 16, fontFamily: FONTS.bold },
    ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    ledgerRowBorder: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border.color || 'rgba(255,255,255,0.1)' },
    ledgerText: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 14 },
    ledgerAmt: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 14 },

    alertPanel: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(234, 179, 8, 0.1)', 
        borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)', padding: 18, borderRadius: 16, marginBottom: 20,
        shadowColor: "rgba(234, 179, 8, 0.2)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 
    },
    alertTextWrapper: { marginLeft: 15 },
    alertTitle: { color: '#eab308', fontFamily: FONTS.bold, fontSize: 15, marginBottom: 4 },
    alertSub: { color: '#ca8a04', fontFamily: FONTS.medium, fontSize: 14 },

    whiteCard: { 
        backgroundColor: colors.background.secondary, padding: 20, borderRadius: 16, marginBottom: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
        borderWidth: 1, borderColor: colors.border.color || 'transparent'
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, borderBottomColor: colors.border.color || 'rgba(255,255,255,0.1)', borderBottomWidth: 1, paddingBottom: 10 },
    cardHeader: { color: colors.text.primary, fontSize: 16, fontFamily: FONTS.bold },

    tableHeaderRow: { marginBottom: 6 },
    tableHeaderText: { color: colors.text.muted || colors.text.secondary, fontSize: 11, fontFamily: FONTS.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border.color || 'rgba(255,255,255,0.05)' },
    tableCell: { color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 13 },

    totalRow: { marginTop: 4, borderTopWidth: 2, borderTopColor: colors.border.color || 'rgba(255,255,255,0.15)', borderBottomWidth: 0, paddingTop: 8 },
    totalText: { color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 13 },

    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    breakdownCat: { color: colors.text.secondary, fontFamily: FONTS.regular },
    breakdownAmt: { color: colors.text.primary, fontFamily: FONTS.medium },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    monthPickerBox: { backgroundColor: colors.background.secondary, borderRadius: 16, padding: 20, width: '85%', alignItems: 'center', borderWidth: 1, borderColor: colors.border.color || 'rgba(255,255,255,0.05)' },
    yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 20 },
    yearBtn: { padding: 10, backgroundColor: colors.background.tertiary, borderRadius: 8, borderWidth: 1, borderColor: colors.border.color || 'rgba(255,255,255,0.05)' },
    yearText: { color: colors.text.primary, fontSize: 20, fontFamily: FONTS.bold },
    monthsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%', gap: 10 },
    monthCell: { width: '30%', paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border.color || 'rgba(255,255,255,0.05)', backgroundColor: colors.background.primary },
    monthCellActive: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    monthCellText: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 14 },
    closePickerBtn: { marginTop: 20, paddingVertical: 12, width: '100%', alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
    closePickerText: { color: colors.text.secondary, fontFamily: FONTS.bold, fontSize: 15 },
});
