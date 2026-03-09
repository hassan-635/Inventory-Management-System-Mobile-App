import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '../store/authStore';
import { COLORS, FONTS } from '../theme/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function MonthlyReportScreen() {
    const { token } = useAuthStore();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Initial Date State
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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

        if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
        } else if (newMonth < 1) {
            newMonth = 12;
            newYear -= 1;
        }

        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    if (!reportData) {
        return (
            <View style={styles.centerContainer}>
                <Text style={{ color: COLORS.text.secondary }}>Failed to load report data.</Text>
            </View>
        );
    }

    const { summary, expense_breakdown, activity_lists } = reportData;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Report</Text>
            </View>

            {/* Date Selector */}
            <View style={styles.dateSelectorRow}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => changeMonth(-1)}>
                    <Icon name="chevron-back" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>
                <Text style={styles.dateLabel}>{monthNames[selectedMonth - 1]} {selectedYear}</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => changeMonth(1)}>
                    <Icon name="chevron-forward" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
            >
                {/* Key Metrics */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderLeftColor: summary.cash_flow_profit >= 0 ? '#22c55e' : '#ef4444', borderLeftWidth: 4 }]}>
                        <Icon name={summary.cash_flow_profit >= 0 ? "trending-up" : "trending-down"} size={24} color={summary.cash_flow_profit >= 0 ? '#22c55e' : '#ef4444'} style={styles.statIcon} />
                        <Text style={styles.statTitle}>Cash Flow Profit</Text>
                        <Text style={[styles.statValue, { color: summary.cash_flow_profit >= 0 ? '#22c55e' : '#ef4444' }]}>
                            Rs. {summary.cash_flow_profit.toLocaleString()}
                        </Text>
                    </View>

                    <View style={[styles.statCard, { borderLeftColor: '#f97316', borderLeftWidth: 4 }]}>
                        <Icon name="wallet" size={24} color="#f97316" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Total Expenses</Text>
                        <Text style={[styles.statValue, { color: '#f97316' }]}>Rs. {summary.total_expenses.toLocaleString()}</Text>
                    </View>
                </View>

                {/* Ledger In/Out Cards */}
                <View style={styles.ledgerSection}>
                    {/* INFLOW */}
                    <View style={[styles.ledgerCard, { borderColor: 'rgba(34, 197, 94, 0.3)' }]}>
                        <View style={styles.ledgerHeader}>
                            <Icon name="arrow-down-circle" size={20} color="#22c55e" />
                            <Text style={[styles.ledgerTitle, { color: '#22c55e' }]}>Income (In)</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Sales Raised</Text>
                            <Text style={styles.ledgerAmt}>Rs. {summary.total_sales_created_value.toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Cash Collected</Text>
                            <Text style={[styles.ledgerAmt, { color: '#22c55e' }]}>Rs. {summary.total_sales_collected_this_month.toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Credit Given</Text>
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
                            <Text style={styles.ledgerText}>Purchases Raised</Text>
                            <Text style={styles.ledgerAmt}>Rs. {summary.total_purchases_created_value.toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
                            <Text style={styles.ledgerText}>Cash Paid</Text>
                            <Text style={[styles.ledgerAmt, { color: '#ef4444' }]}>Rs. {summary.total_purchases_paid_this_month.toLocaleString()}</Text>
                        </View>
                        <View style={styles.ledgerRow}>
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
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary },
    header: { padding: 16, paddingBottom: 5 },
    headerTitle: { fontSize: 24, color: COLORS.text.primary, fontFamily: FONTS.bold },

    dateSelectorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginHorizontal: 16, backgroundColor: COLORS.background.secondary, borderRadius: 12, marginBottom: 15 },
    dateBtn: { padding: 10 },
    dateLabel: { fontSize: 18, color: COLORS.text.primary, fontFamily: FONTS.bold, minWidth: 100, textAlign: 'center' },

    scrollContainer: { paddingHorizontal: 16 },

    statsGrid: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    statCard: { flex: 1, backgroundColor: COLORS.background.secondary, padding: 16, borderRadius: 12 },
    statIcon: { marginBottom: 10 },
    statTitle: { color: COLORS.text.secondary, fontSize: 13, fontFamily: FONTS.medium, marginBottom: 5 },
    statValue: { fontSize: 18, fontFamily: FONTS.bold },

    ledgerSection: { gap: 15, marginBottom: 20 },
    ledgerCard: { backgroundColor: COLORS.background.secondary, padding: 16, borderRadius: 12, borderWidth: 1 },
    ledgerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 8 },
    ledgerTitle: { fontSize: 16, fontFamily: FONTS.bold },
    ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    ledgerText: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 14 },
    ledgerAmt: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 14 },

    alertPanel: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(234, 179, 8, 0.1)', borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)', padding: 16, borderRadius: 12, marginBottom: 20 },
    alertTextWrapper: { marginLeft: 15 },
    alertTitle: { color: '#eab308', fontFamily: FONTS.bold, fontSize: 14, marginBottom: 2 },
    alertSub: { color: '#ca8a04', fontFamily: FONTS.medium, fontSize: 14 },

    whiteCard: { backgroundColor: COLORS.background.secondary, padding: 16, borderRadius: 12, marginBottom: 20 },
    cardHeader: { color: COLORS.text.primary, fontSize: 16, fontFamily: FONTS.bold, marginBottom: 15, borderBottomColor: COLORS.border.color, borderBottomWidth: 1, paddingBottom: 10 },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    breakdownCat: { color: COLORS.text.secondary, fontFamily: FONTS.regular },
    breakdownAmt: { color: COLORS.text.primary, fontFamily: FONTS.medium },
});
