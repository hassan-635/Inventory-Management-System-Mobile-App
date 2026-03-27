import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, useWindowDimensions } from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '../store/authStore';
import { useAppTheme } from '../theme/useAppTheme';

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

    const fetchReport = async () => {
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
    };

    useEffect(() => {
        setLoading(true);
        fetchReport();
    }, [selectedYear, selectedMonth]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchReport();
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

    const { summary, expense_breakdown, activity_lists, company_wise_summary } = reportData;
    const cashSalesList = activity_lists?.cash_sales_by_salesman || [];
    const udhaarList = activity_lists?.udhaar_payments_received || [];
    const supplierPayments = activity_lists?.payments_made_to_suppliers || [];
    const companySummary = company_wise_summary || [];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Report</Text>
            </View>

            {/* Date Selector */}
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

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
            >
                {/* Key Metrics */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderLeftColor: summary.cash_flow_profit >= 0 ? '#22c55e' : '#ef4444', borderLeftWidth: 4 }]}>
                        <Icon name={summary.cash_flow_profit >= 0 ? "trending-up" : "trending-down"} size={22} color={summary.cash_flow_profit >= 0 ? '#22c55e' : '#ef4444'} style={styles.statIcon} />
                        <Text style={styles.statTitle}>Cash Flow Profit</Text>
                        <Text style={[styles.statValue, { color: summary.cash_flow_profit >= 0 ? '#22c55e' : '#ef4444' }]}>
                            Rs. {summary.cash_flow_profit.toLocaleString()}
                        </Text>
                    </View>

                    <View style={[styles.statCard, { borderLeftColor: '#f97316', borderLeftWidth: 4 }]}>
                        <Icon name="wallet" size={22} color="#f97316" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Total Expenses</Text>
                        <Text style={[styles.statValue, { color: '#f97316' }]}>Rs. {summary.total_expenses.toLocaleString()}</Text>
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
                            <Text style={styles.ledgerText}>Udhaar Installments Received</Text>
                            <Text style={[styles.ledgerAmt, { color: '#a78bfa' }]}>Rs. {summary.total_sales_collected_this_month.toLocaleString()}</Text>
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
                        <Text style={styles.alertTitle}>All-Time Pending Dues (Buyers)</Text>
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

                {/* Udhaar Installments Received */}
                {udhaarList.length > 0 && (
                    <View style={styles.whiteCard}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="people" size={18} color="#a78bfa" />
                            <Text style={[styles.cardHeader, { color: '#a78bfa' }]}>Udhaar Installments Received</Text>
                        </View>
                        <View style={[styles.tableRow, styles.tableHeaderRow]}>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Name</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Phone</Text>
                            <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Received</Text>
                        </View>
                        {udhaarList.map((b) => (
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
                        {/* Grand Total */}
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
    header: { padding: 16, paddingBottom: 5 },
    headerTitle: { fontSize: 24, color: colors.text.primary, fontFamily: FONTS.bold },

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
