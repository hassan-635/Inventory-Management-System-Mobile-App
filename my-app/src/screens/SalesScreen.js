import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { salesService } from '../api/sales';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';
import Icon from 'react-native-vector-icons/Ionicons';

const TIME_FILTERS = [
    { key: '1d', label: '1D' },
    { key: '1w', label: '1W' },
    { key: '1m', label: '1M' },
    { key: '6m', label: '6M' },
    { key: '1y', label: '1Y' },
    { key: '5y', label: '5Y' },
    { key: 'all', label: 'All' },
];

const getDateThreshold = (key) => {
    const now = new Date();
    switch (key) {
        case '1d': return new Date(now - 1 * 24 * 60 * 60 * 1000);
        case '1w': return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case '1m': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        case '6m': return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case '5y': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        default: return new Date(0);
    }
};

export default function SalesScreen() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('1m');
    const [search, setSearch] = useState('');

    const fetchSales = async () => {
        try {
            const data = await salesService.getAll();
            setSales(data);
        } catch (error) {
            console.error('Failed to fetch sales:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchSales(); }, []);
    const onRefresh = () => { setRefreshing(true); fetchSales(); };

    const threshold = getDateThreshold(activeFilter);

    const filteredSales = useMemo(() => sales.filter(s => {
        const saleDate = new Date(s.purchase_date);
        const withinDate = saleDate >= threshold;
        const matchSearch =
            (s.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (s.buyers?.name || '').toLowerCase().includes(search.toLowerCase());
        return withinDate && matchSearch;
    }), [sales, activeFilter, search]);

    const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Recent Sales</Text>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Revenue</Text>
                <Text style={styles.summaryValue}>Rs. {totalRevenue.toLocaleString()}</Text>
                <Text style={styles.summaryCount}>{filteredSales.length} transaction(s)</Text>
            </View>

            {/* Time Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
                {TIME_FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.filterBtn, activeFilter === f.key && styles.filterBtnActive]}
                        onPress={() => setActiveFilter(f.key)}
                    >
                        <Text style={[styles.filterBtnText, activeFilter === f.key && styles.filterBtnTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Search */}
            <View style={styles.searchRow}>
                <Icon name="search-outline" size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by product or buyer..."
                    placeholderTextColor={COLORS.text.muted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList
                data={filteredSales}
                keyExtractor={(item, index) => (item.id || index).toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                    const remaining = Number(item.total_amount || 0) - Number(item.paid_amount || 0);
                    return (
                        <ExpandableItem
                            title={item.products?.name || 'Unknown Product'}
                            subtitle={null}
                            rightText={`Rs. ${item.total_amount}`}
                            iconName="receipt-outline"
                            detailsData={{
                                'Txn ID': `#${item.id}`,
                                'Buyer': item.buyers?.name || 'Walk-in',
                                'Quantity': item.quantity,
                                'Price/Unit': `Rs. ${item.products?.price || '-'}`,
                                'Paid Amount': `Rs. ${item.paid_amount || 0}`,
                                'Remaining': remaining > 0 ? `Rs. ${remaining}` : '✓ Fully Paid',
                                'Date': new Date(item.purchase_date).toLocaleDateString()
                            }}
                        />
                    );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No sales in this period.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary },
    headerTitle: {
        fontSize: 24, color: COLORS.text.primary, fontFamily: FONTS.bold,
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    },
    summaryCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: COLORS.background.secondary,
        borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    summaryLabel: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12 },
    summaryValue: { color: COLORS.accent.primary, fontFamily: FONTS.bold, fontSize: 22, marginVertical: 2 },
    summaryCount: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12 },
    filterScroll: { flexGrow: 0, marginBottom: 8 },
    filterRow: { paddingHorizontal: 16, gap: 8 },
    filterBtn: {
        paddingHorizontal: 16, paddingVertical: 6,
        borderRadius: 20, borderWidth: 1, borderColor: COLORS.border.color,
        backgroundColor: COLORS.background.secondary,
    },
    filterBtnActive: { backgroundColor: COLORS.accent.primary, borderColor: COLORS.accent.primary },
    filterBtnText: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    filterBtnTextActive: { color: '#fff' },
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginBottom: 10,
        backgroundColor: COLORS.background.secondary,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    searchInput: { flex: 1, color: COLORS.text.primary, fontFamily: FONTS.regular, fontSize: 14 },
    listContainer: { padding: 16, paddingBottom: 40 },
    emptyText: { color: COLORS.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },
});
