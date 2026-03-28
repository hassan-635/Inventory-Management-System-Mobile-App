import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
    TouchableOpacity, RefreshControl, Alert, useWindowDimensions
} from 'react-native';
import api from '../api/apiClient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../theme/useAppTheme';
import { generateDailyReportPdf } from '../utils/pdfGenerator';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function DailyReportScreen() {
    const { colors, FONTS } = useAppTheme();
    const { width } = useWindowDimensions();
    const isTablet = width > 768;
    const styles = useMemo(() => getStyles(colors, FONTS, isTablet), [colors, FONTS, isTablet]);

    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const fetchReport = useCallback(async () => {
        try {
            const [salesRes, productsRes, suppliersRes, buyersRes, returnsRes] = await Promise.all([
                api.get('/sales'),
                api.get('/products'),
                api.get('/suppliers'),
                api.get('/buyers'),
                api.get('/sales/returns').catch(() => ({ data: [] }))
            ]);

            // Filter sales for selected date
            const salesToday = (salesRes.data || []).filter(s => {
                const d = s.date || s.purchase_date || s.created_at || '';
                return d.startsWith(reportDate);
            });

            // Filter returns for selected date
            const returnsToday = (returnsRes.data || []).filter(r => {
                const d = r.returned_at ? r.returned_at.split('T')[0] : '';
                return d === reportDate;
            });

            // Filter products added on selected date
            const productsToday = (productsRes.data || []).filter(p => {
                const d = p.created_at || p.date || '';
                return d.startsWith(reportDate);
            });

            // Filter supplier transactions & new suppliers
            const supplierTxnsToday = [];
            const newSuppliers = [];
            (suppliersRes.data || []).forEach(supplier => {
                (supplier.supplier_transactions || []).forEach(txn => {
                    const d = txn.purchase_date || txn.date || txn.created_at || '';
                    if (d.startsWith(reportDate)) {
                        supplierTxnsToday.push({ ...txn, supplierName: supplier.name });
                    }
                });
                const d = supplier.created_at || supplier.date || '';
                if (d.startsWith(reportDate)) newSuppliers.push(supplier);
            });

            // Filter buyers added today
            const buyersToday = (buyersRes.data || []).filter(b => {
                const d = b.created_at || b.date || '';
                return d.startsWith(reportDate);
            });

            setReportData({
                sales_today: salesToday,
                returns_today: returnsToday,
                products_added_today: productsToday,
                supplier_transactions_today: supplierTxnsToday,
                suppliers_added_today: newSuppliers,
                buyers_added_today: buyersToday,
            });
        } catch (error) {
            console.error('Daily report fetch error:', error);
            Alert.alert('Error', 'Failed to load daily report data. Check your connection.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [reportDate]);

    useEffect(() => {
        setLoading(true);
        fetchReport();
    }, [fetchReport]);

    useRefetchOnFocus(fetchReport, [reportDate]);

    const onRefresh = () => { setRefreshing(true); fetchReport(); };

    const changeDate = (days) => {
        const d = new Date(reportDate);
        d.setDate(d.getDate() + days);
        setReportDate(d.toISOString().split('T')[0]);
    };

    const handleDownloadPdf = async () => {
        if (!reportData) return;
        setGeneratingPdf(true);
        try {
            await generateDailyReportPdf(
                reportDate,
                reportData.sales_today || [],
                reportData.returns_today || [],
                reportData.products_added_today || [],
                reportData.supplier_transactions_today || [],
                reportData.buyers_added_today || [],
                reportData.suppliers_added_today || []
            );
        } catch (e) {
            Alert.alert('Error', 'Could not generate PDF. Please try again.');
        } finally {
            setGeneratingPdf(false);
        }
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
                <Icon name="document-text-outline" size={48} color={colors.text.secondary} />
                <Text style={{ color: colors.text.secondary, marginTop: 12, fontSize: 16 }}>No data available.</Text>
            </View>
        );
    }

    const sales = reportData.sales_today || [];
    const returns = reportData.returns_today || [];
    const productsAdded = reportData.products_added_today || [];
    const buyersAdded = reportData.buyers_added_today || [];
    const suppliersAdded = reportData.suppliers_added_today || [];
    const supplierTxns = reportData.supplier_transactions_today || [];

    const totalSales = sales.reduce((s, x) => s + Number(x.total_amount || 0), 0);
    const totalCash = sales.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
    const totalUdhaar = totalSales - totalCash;
    const totalReturns = returns.reduce((s, x) => s + Number(x.total_amount || 0), 0);
    const supplierTotal = supplierTxns.reduce((s, x) => s + Number(x.total_amount || 0), 0);
    const supplierPaid = supplierTxns.reduce((s, x) => s + Number(x.paid_amount || 0), 0);

    const displayDate = new Date(reportDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const isToday = reportDate === new Date().toISOString().split('T')[0];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Daily Report</Text>
                    <Text style={styles.headerSub}>
                        {displayDate}{isToday ? ' (Today)' : ''}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.pdfBtn, generatingPdf && { opacity: 0.6 }]}
                    onPress={handleDownloadPdf}
                    disabled={generatingPdf}
                >
                    {generatingPdf
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Icon name="download-outline" size={18} color="#fff" />
                    }
                    <Text style={styles.pdfBtnText}>{generatingPdf ? 'Generating...' : 'Download PDF'}</Text>
                </TouchableOpacity>
            </View>

            {/* Date Selector */}
            <View style={styles.dateSelectorRow}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(-1)}>
                    <Icon name="chevron-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateSelectorCenter}>
                    <Icon name="calendar-outline" size={16} color={colors.accent.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.dateLabel}>{displayDate}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(1)} disabled={isToday}>
                    <Icon name="chevron-forward" size={24} color={isToday ? colors.text.secondary : colors.text.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
            >
                {/* Key Metrics */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderTopColor: '#38bdf8', borderTopWidth: 3 }]}>
                        <Icon name="storefront-outline" size={20} color="#38bdf8" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Total Sales</Text>
                        <Text style={[styles.statValue, { color: '#38bdf8' }]}>Rs. {totalSales.toLocaleString()}</Text>
                        <Text style={styles.statSub}>({sales.length} transactions)</Text>
                    </View>

                    <View style={[styles.statCard, { borderTopColor: '#22c55e', borderTopWidth: 3 }]}>
                        <Icon name="cash-outline" size={20} color="#22c55e" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Cash Received</Text>
                        <Text style={[styles.statValue, { color: '#22c55e' }]}>Rs. {totalCash.toLocaleString()}</Text>
                        <Text style={[styles.statSub, { color: totalUdhaar > 0 ? '#ef4444' : colors.text.secondary }]}>
                            Udhaar: Rs. {totalUdhaar.toLocaleString()}
                        </Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderTopColor: '#a855f7', borderTopWidth: 3 }]}>
                        <Icon name="cube-outline" size={20} color="#a855f7" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Supplier Bills</Text>
                        <Text style={[styles.statValue, { color: '#a855f7' }]}>Rs. {supplierTotal.toLocaleString()}</Text>
                        <Text style={[styles.statSub, { color: supplierTotal - supplierPaid > 0 ? '#ef4444' : colors.text.secondary }]}>
                            Owed: Rs. {(supplierTotal - supplierPaid).toLocaleString()}
                        </Text>
                    </View>

                    <View style={[styles.statCard, { borderTopColor: '#ef4444', borderTopWidth: 3 }]}>
                        <Icon name="return-down-back-outline" size={20} color="#ef4444" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Returns</Text>
                        <Text style={[styles.statValue, { color: '#ef4444' }]}>Rs. {totalReturns.toLocaleString()}</Text>
                        <Text style={styles.statSub}>({returns.length} items)</Text>
                    </View>
                </View>

                {/* Activity Lists */}
                <View style={styles.activityRow}>
                    <View style={[styles.activityCard, { flex: 1 }]}>
                        <View style={styles.activityHeader}>
                            <Icon name="add-circle-outline" size={16} color="#0ea5e9" />
                            <Text style={[styles.activityTitle, { color: '#0ea5e9' }]}>New Products ({productsAdded.length})</Text>
                        </View>
                        {productsAdded.length === 0
                            ? <Text style={styles.emptyText}>None today</Text>
                            : productsAdded.map((p, i) => <Text key={i} style={styles.activityItem}>• {p.name}</Text>)
                        }
                    </View>

                    <View style={[styles.activityCard, { flex: 1 }]}>
                        <View style={styles.activityHeader}>
                            <Icon name="person-add-outline" size={16} color="#22c55e" />
                            <Text style={[styles.activityTitle, { color: '#22c55e' }]}>New Customers ({buyersAdded.length})</Text>
                        </View>
                        {buyersAdded.length === 0
                            ? <Text style={styles.emptyText}>None today</Text>
                            : buyersAdded.map((b, i) => <Text key={i} style={styles.activityItem}>• {b.name}</Text>)
                        }
                    </View>

                    <View style={[styles.activityCard, { flex: 1 }]}>
                        <View style={styles.activityHeader}>
                            <Icon name="business-outline" size={16} color="#f59e0b" />
                            <Text style={[styles.activityTitle, { color: '#f59e0b' }]}>New Suppliers ({suppliersAdded.length})</Text>
                        </View>
                        {suppliersAdded.length === 0
                            ? <Text style={styles.emptyText}>None today</Text>
                            : suppliersAdded.map((s, i) => <Text key={i} style={styles.activityItem}>• {s.name}</Text>)
                        }
                    </View>
                </View>

                {/* Returns List */}
                {returns.length > 0 && (
                    <View style={[styles.whiteCard, { borderColor: 'rgba(239,68,68,0.3)', borderWidth: 1 }]}>
                        <View style={styles.cardHeaderRow}>
                            <Icon name="return-down-back-outline" size={18} color="#ef4444" />
                            <Text style={[styles.cardHeader, { color: '#ef4444' }]}>Returns Today ({returns.length})</Text>
                        </View>
                        {returns.map((r, i) => (
                            <View key={i} style={styles.tableRow}>
                                <View style={{ flex: 2 }}>
                                    <Text style={[styles.tableCell, { fontFamily: FONTS.medium }]}>{r.product_name}</Text>
                                    {r.buyer_name && <Text style={[styles.tableCell, { fontSize: 11, color: colors.text.secondary }]}>from {r.buyer_name}</Text>}
                                </View>
                                <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', color: colors.text.secondary }]}>Qty: {r.quantity}</Text>
                                <Text style={[styles.tableCell, { flex: 1.5, textAlign: 'right', color: '#ef4444', fontFamily: FONTS.bold }]}>
                                    Rs. {Number(r.total_amount).toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Sales Log */}
                <View style={styles.whiteCard}>
                    <View style={styles.cardHeaderRow}>
                        <Icon name="receipt-outline" size={18} color="#38bdf8" />
                        <Text style={[styles.cardHeader, { color: '#38bdf8' }]}>Detailed Sales Log ({sales.length})</Text>
                    </View>
                    {sales.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Icon name="receipt-outline" size={36} color={colors.text.secondary} />
                            <Text style={styles.emptyStateText}>No sales recorded today</Text>
                        </View>
                    ) : (
                        <>
                            <View style={[styles.tableRow, styles.tableHeaderRow]}>
                                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Customer</Text>
                                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Product</Text>
                                <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>Qty</Text>
                                <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Total</Text>
                                <Text style={[styles.tableHeaderText, { flex: 2, textAlign: 'right' }]}>Status</Text>
                            </View>
                            {sales.map((sale, i) => {
                                const t = Number(sale.total_amount || 0);
                                const p = Number(sale.paid_amount || 0);
                                const u = t - p;
                                return (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                                            {sale.buyer_name || (sale.buyers && sale.buyers.name) || 'Walk-in'}
                                        </Text>
                                        <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>
                                            {(sale.products && sale.products.name) || 'Product'}
                                        </Text>
                                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', color: colors.text.secondary }]}>
                                            {sale.quantity}
                                        </Text>
                                        <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', fontFamily: FONTS.medium }]}>
                                            Rs. {t.toLocaleString()}
                                        </Text>
                                        <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', color: u > 0 ? '#ef4444' : '#22c55e', fontFamily: FONTS.bold }]}>
                                            {u > 0 ? `Udhaar` : '✓ Clear'}
                                        </Text>
                                    </View>
                                );
                            })}
                        </>
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const getStyles = (colors, FONTS, isTablet) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 22, color: colors.text.primary, fontFamily: FONTS.bold },
    headerSub: { fontSize: 13, color: colors.text.secondary, fontFamily: FONTS.regular, marginTop: 2 },
    pdfBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: colors.accent.primary, paddingHorizontal: 14, paddingVertical: 9,
        borderRadius: 10, shadowColor: colors.accent.primary, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3, shadowRadius: 5, elevation: 4
    },
    pdfBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 13 },

    dateSelectorRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 8, marginHorizontal: 16, backgroundColor: colors.background.secondary,
        borderRadius: 12, marginBottom: 15, paddingHorizontal: 10
    },
    dateSelectorCenter: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
    dateBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
    dateLabel: { fontSize: 15, color: colors.text.primary, fontFamily: FONTS.medium },

    scrollContainer: { paddingHorizontal: 16, ...(isTablet && { paddingHorizontal: 32 }) },

    statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    statCard: {
        flex: 1, backgroundColor: colors.background.secondary, padding: 16, borderRadius: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
    },
    statIcon: { marginBottom: 8 },
    statTitle: { color: colors.text.secondary, fontSize: 12, fontFamily: FONTS.medium, marginBottom: 4 },
    statValue: { fontSize: 18, fontFamily: FONTS.bold, marginBottom: 2 },
    statSub: { fontSize: 11, color: colors.text.secondary, fontFamily: FONTS.regular },

    activityRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    activityCard: {
        backgroundColor: colors.background.secondary, padding: 14, borderRadius: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2
    },
    activityHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', paddingBottom: 6 },
    activityTitle: { fontSize: 11, fontFamily: FONTS.bold },
    activityItem: { color: colors.text.secondary, fontSize: 12, fontFamily: FONTS.regular, marginTop: 3 },
    emptyText: { color: colors.text.secondary, fontSize: 11, fontFamily: FONTS.regular, fontStyle: 'italic' },

    whiteCard: {
        backgroundColor: colors.background.secondary, padding: 20, borderRadius: 16, marginBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, borderBottomColor: 'rgba(255,255,255,0.07)', borderBottomWidth: 1, paddingBottom: 10 },
    cardHeader: { color: colors.text.primary, fontSize: 15, fontFamily: FONTS.bold },

    tableHeaderRow: { marginBottom: 4 },
    tableHeaderText: { color: colors.text.secondary, fontSize: 10, fontFamily: FONTS.medium, textTransform: 'uppercase', letterSpacing: 0.4 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    tableCell: { color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 12 },

    emptyState: { alignItems: 'center', paddingVertical: 30 },
    emptyStateText: { color: colors.text.secondary, fontSize: 14, fontFamily: FONTS.regular, marginTop: 10 },
});
