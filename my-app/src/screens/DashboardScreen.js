import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import api from '../api/apiClient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '../store/authStore';
import { useAppTheme } from '../theme/useAppTheme';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";


const screenWidth = Dimensions.get("window").width;

export default function DashboardScreen() {
    const { colors, FONTS } = useAppTheme();
    const styles = useMemo(() => getStyles(colors, FONTS), [colors, FONTS]);

    const { token } = useAuthStore();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const fetchDashboardData = useCallback(async () => {
        try {
            const formattedMonth = currentMonth.toString().padStart(2, '0');
            const res = await api.get(`/reports/monthly?year=${currentYear}&month=${formattedMonth}`);
            setReportData(res.data);
        } catch (error) {
            console.error('Fetch dashboard error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentYear, currentMonth, token]);

    useEffect(() => {
        setLoading(true);
        fetchDashboardData();
    }, [fetchDashboardData]);

    useRefetchOnFocus(fetchDashboardData, [currentYear, currentMonth, token]);

    const onRefresh = () => { setRefreshing(true); fetchDashboardData(); };

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
                <Text style={{ color: colors.text.secondary }}>Failed to load dashboard data.</Text>
            </View>
        );
    }

    const { summary, daily_breakdown } = reportData;

    // Process data for charts
    let labels = [];
    let salesData = [];
    let expensesData = [];
    let profitData = [];

    if (daily_breakdown && daily_breakdown.length > 0) {
        daily_breakdown.forEach((day) => {
            labels.push(new Date(day.date).getDate().toString());
            salesData.push(day.total_sales || 0);
            expensesData.push(day.expenses || 0);
            profitData.push(day.daily_profit || 0);
        });
    } else {
        labels = ['1', '2'];
        salesData = [0, 0];
        expensesData = [0, 0];
        profitData = [0, 0];
    }

    // Pie Chart Data mapping
    const expenseBreakdown = reportData.expense_breakdown || {};
    const E_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#3b82f6', '#ec4899'];
    const pieExpenseData = Object.keys(expenseBreakdown).map((key, index) => ({
        name: key,
        population: expenseBreakdown[key],
        color: E_COLORS[index % E_COLORS.length],
        legendFontColor: colors.text.secondary,
        legendFontSize: 12
    }));

    const paymentSplit = summary.payment_split || { cash: 0, online: 0 };
    const piePaymentData = [
        { name: "Cash", population: paymentSplit.cash || 0, color: "#22c55e", legendFontColor: colors.text.secondary, legendFontSize: 12 },
        { name: "Online", population: paymentSplit.online || 0, color: "#38bdf8", legendFontColor: colors.text.secondary, legendFontSize: 12 }
    ].filter(p => p.population > 0);

    const dynamicChartWidth = Math.max(screenWidth - 32, labels.length * 50);

    const chartConfig = {
        backgroundGradientFrom: colors.background.secondary,
        backgroundGradientTo: colors.background.secondary,
        decimalPlaces: 0, 
        color: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`, // default axis color
        labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
        style: {
            borderRadius: 16
        },
        propsForDots: {
            r: "4",
            strokeWidth: "2",
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Overview Dashboard</Text>
                    <Text style={styles.headerSubtitle}>Real-time analytics for this month</Text>
                </View>
            </View>

            <ScrollView 
                style={styles.scrollContainer}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
            >
                {/* Quick Stats Grid */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, paddingLeft: 16, gap: 12, marginBottom: 20 }}>
                    <View style={[styles.statCard, { borderBottomColor: '#38bdf8', borderBottomWidth: 4 }]}>
                        <Icon name="trending-up" size={22} color="#38bdf8" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Total Sales</Text>
                        <Text style={[styles.statValue, { color: '#38bdf8' }]}>Rs. {summary.total_sales_created_value.toLocaleString()}</Text>
                    </View>

                    <View style={[styles.statCard, { borderBottomColor: '#22c55e', borderBottomWidth: 4 }]}>
                        <Icon name="wallet" size={22} color="#22c55e" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Net Profit</Text>
                        <Text style={[styles.statValue, { color: '#22c55e' }]}>Rs. {summary.net_real_profit.toLocaleString()}</Text>
                    </View>

                    <View style={[styles.statCard, { borderBottomColor: '#ef4444', borderBottomWidth: 4 }]}>
                        <Icon name="cash" size={22} color="#ef4444" style={styles.statIcon} />
                        <Text style={styles.statTitle}>Expenses</Text>
                        <Text style={[styles.statValue, { color: '#ef4444' }]}>Rs. {summary.total_expenses.toLocaleString()}</Text>
                    </View>
                </ScrollView>

                {/* Line Chart */}
                <View style={styles.chartContainer}>
                    <View style={styles.chartHeaderRow}>
                        <Icon name="analytics" size={18} color={colors.text.primary} />
                        <Text style={styles.chartTitle}>Daily Sales vs Expenses</Text>
                    </View>
                    <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 10 }}>Swap horizontally to see all dates</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <LineChart
                            data={{
                                labels: labels,
                                datasets: [
                                    {
                                        data: salesData,
                                        color: (opacity = 1) => `rgba(56, 189, 248, ${opacity})`, 
                                        strokeWidth: 2
                                    },
                                    {
                                        data: expensesData,
                                        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, 
                                        strokeWidth: 2
                                    }
                                ],
                                legend: ["Sales", "Expenses"]
                            }}
                            width={dynamicChartWidth} 
                            height={240}
                            yAxisLabel="Rs."
                            yAxisInterval={1}
                            chartConfig={chartConfig}
                            bezier
                            style={{
                                marginVertical: 8,
                                borderRadius: 16
                            }}
                        />
                    </ScrollView>
                </View>

                {/* Bar Chart */}
                <View style={styles.chartContainer}>
                    <View style={styles.chartHeaderRow}>
                        <Icon name="bar-chart" size={18} color="#22c55e" />
                        <Text style={styles.chartTitle}>Daily Profit Trend</Text>
                    </View>
                    <Text style={{ color: colors.text.muted, fontSize: 11, marginBottom: 10 }}>Swap horizontally to see all dates</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <BarChart
                            data={{
                                labels: labels,
                                datasets: [
                                    {
                                        data: profitData
                                    }
                                ]
                            }}
                            width={dynamicChartWidth}
                            height={240}
                            yAxisLabel="Rs."
                            chartConfig={{
                                ...chartConfig,
                                color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                            }}
                            verticalLabelRotation={0}
                            style={{
                                marginVertical: 8,
                                borderRadius: 16
                            }}
                        />
                    </ScrollView>
                </View>

                {/* Pie Charts */}
                {piePaymentData.length > 0 && (
                    <View style={styles.chartContainer}>
                        <View style={styles.chartHeaderRow}>
                            <Icon name="card" size={18} color="#f59e0b" />
                            <Text style={styles.chartTitle}>Payment Method Match</Text>
                        </View>
                        <PieChart
                            data={piePaymentData}
                            width={screenWidth - 32}
                            height={220}
                            chartConfig={chartConfig}
                            accessor={"population"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            center={[10, 0]}
                            absolute
                        />
                    </View>
                )}

                {pieExpenseData.length > 0 && (
                    <View style={styles.chartContainer}>
                        <View style={styles.chartHeaderRow}>
                            <Icon name="pie-chart" size={18} color="#ec4899" />
                            <Text style={styles.chartTitle}>Expense Breakdown</Text>
                        </View>
                        <PieChart
                            data={pieExpenseData}
                            width={screenWidth - 32}
                            height={220}
                            chartConfig={chartConfig}
                            accessor={"population"}
                            backgroundColor={"transparent"}
                            paddingLeft={"15"}
                            center={[10, 0]}
                            absolute
                        />
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const getStyles = (colors, FONTS) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, paddingBottom: 10 },
    headerTitle: { fontSize: 22, color: colors.text.primary, fontFamily: FONTS.bold },
    headerSubtitle: { fontSize: 13, color: colors.text.secondary, fontFamily: FONTS.regular, marginTop: 4 },
    scrollContainer: { },

    statCard: { 
        backgroundColor: colors.background.secondary, 
        padding: 16, 
        borderRadius: 16,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
        minWidth: 140,
    },
    statIcon: { marginBottom: 8 },
    statTitle: { color: colors.text.secondary, fontSize: 13, fontFamily: FONTS.medium, marginBottom: 5 },
    statValue: { fontSize: 18, fontFamily: FONTS.bold },

    chartContainer: { 
        backgroundColor: colors.background.secondary, 
        marginHorizontal: 16, 
        borderRadius: 16, 
        padding: 16, 
        marginBottom: 20,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 
    },
    chartHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    chartTitle: { color: colors.text.primary, fontSize: 16, fontFamily: FONTS.bold },
});
