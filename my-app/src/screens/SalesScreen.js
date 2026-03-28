import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, Alert, useWindowDimensions } from 'react-native';
import { salesService } from '../api/sales';
import { useAppTheme } from '../theme/useAppTheme';
import { useToastStore } from '../store/toastStore';
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

const formatProductId = (id) => {
    if (!id) return '';
    return `AB${String(id).padStart(2, '0')}`;
};

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
    const { colors, FONTS } = useAppTheme();
    const styles = useMemo(() => getStyles(colors, FONTS), [colors, FONTS]);
    const { width } = useWindowDimensions();
    const isTablet = width > 768;

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

    const handleUndoSale = (id) => {
        Alert.alert(
            "Undo Sale",
            "Are you sure you want to undo this sale? This will restore the stock and clear associated debt and payments.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Return Items",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await salesService.delete(id);
                            useToastStore.getState().showToast('Reversed', 'Sale Reversed Successfully!', 'success');
                            fetchSales();
                        } catch (err) {
                            console.error('Error undoing sale:', err);
                            useToastStore.getState().showToast('Error', 'Failed to undo sale. Please try again.', 'error');
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const filteredSales = useMemo(() => {
        const threshold = getDateThreshold(activeFilter);
        return sales.filter(s => {
            const saleDate = new Date(s.purchase_date);
            const withinDate = saleDate >= threshold;
            const matchSearch =
                (s.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.buyers?.name || '').toLowerCase().includes(search.toLowerCase());
            return withinDate && matchSearch;
        });
    }, [sales, activeFilter, search]);

    const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

    const ListHeader = () => (
        <View>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Total Revenue ({activeFilter.toUpperCase()})</Text>
                <Text style={styles.summaryValue}>Rs. {totalRevenue.toLocaleString()}</Text>
                <Text style={styles.summaryCount}>{filteredSales.length} transaction(s)</Text>
            </View>

            {/* Time Filter Tabs — horizontal scroll in a fixed-height row */}
            <View style={styles.filterWrapper}>
                <FlatList
                    data={TIME_FILTERS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={f => f.key}
                    contentContainerStyle={styles.filterRow}
                    renderItem={({ item: f }) => (
                        <TouchableOpacity
                            style={[styles.filterBtn, activeFilter === f.key && styles.filterBtnActive]}
                            onPress={() => setActiveFilter(f.key)}
                        >
                            <Text style={[styles.filterBtnText, activeFilter === f.key && styles.filterBtnTextActive]}>{f.label}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Icon name="search-outline" size={18} color={colors.text.secondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by product or customer..."
                    placeholderTextColor={colors.text.muted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>
        </View>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Recent Sales</Text>
            <FlatList
                data={filteredSales}
                keyExtractor={(item, index) => (item.id || index).toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
                contentContainerStyle={[styles.listContainer, isTablet && { paddingHorizontal: 32 }]}
                ListHeaderComponent={<ListHeader />}
                renderItem={({ item }) => {
                    const total = Number(item.total_amount || 0);
                    const paid = Number(item.paid_amount || 0);
                    const remaining = total - paid;
                    const hasBalance = remaining > 0;
                    return (
                        <ExpandableItem
                            title={item.products?.name || 'Unknown Product'}
                            subtitle={item.buyers?.name ? `Customer · ${item.buyers.name}` : 'Walk-in'}
                            rightText={hasBalance ? `Rs. ${remaining.toLocaleString()}` : '✓ Clear'}
                            rightSubText={`Total: Rs. ${total.toLocaleString()}`}
                            rightTextColor={hasBalance ? colors.status.danger : colors.status.success}
                            summaryBoxes={[
                                { label: 'Total Sale', value: `Rs. ${total.toLocaleString()}` },
                                {
                                    label: 'Paid',
                                    value: `Rs. ${paid.toLocaleString()}`,
                                    valueColor: colors.status.success,
                                    borderColor: colors.status.success,
                                },
                                {
                                    label: 'Balance',
                                    value: hasBalance ? `Rs. ${remaining.toLocaleString()}` : '—',
                                    valueColor: hasBalance ? colors.status.danger : colors.status.success,
                                    borderColor: hasBalance ? colors.status.danger : colors.status.success,
                                },
                            ]}
                            iconName="receipt-outline"
                            containerStyle={hasBalance ? { borderColor: 'rgba(239,68,68,0.3)' } : undefined}
                            detailsData={{
                                'Txn ID': `#${item.id}`,
                                'Product ID': formatProductId(item.product_id),
                                'Customer': item.buyers?.name || 'Walk-in',
                                'Quantity': `${item.quantity} ${item.quantity_unit ? `(${item.quantity_unit})` : ''}`,
                                'Price/Unit': `Rs. ${item.products?.price || '-'}`,
                                'Date': new Date(item.purchase_date).toLocaleDateString()
                            }}
                            renderActions={() => (
                                <View style={{ flexDirection: 'row', flex: 1, minWidth: '100%' }}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.actionBtnDanger, { flex: 1, justifyContent: 'center' }]}
                                        onPress={() => handleUndoSale(item.id)}
                                    >
                                        <Icon name="arrow-undo-outline" size={18} color={colors.status.danger} />
                                        <Text style={[styles.actionBtnTxt, { color: colors.status.danger }]}>Return Items & Undo</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No sales in this period.</Text>}
            />
        </View>
    );
}

const getStyles = (colors, FONTS) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
    headerTitle: {
        fontSize: 24, color: colors.text.primary, fontFamily: FONTS.bold,
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    },
    summaryCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: colors.background.secondary,
        borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: colors.border.color,
    },
    summaryLabel: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12 },
    summaryValue: { color: colors.accent.primary, fontFamily: FONTS.bold, fontSize: 22, marginVertical: 2 },
    summaryCount: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12 },
    filterWrapper: { height: 44, marginBottom: 10 },
    filterRow: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
    filterBtn: {
        paddingHorizontal: 16, paddingVertical: 7,
        borderRadius: 20, borderWidth: 1, borderColor: colors.border.color,
        backgroundColor: colors.background.secondary,
    },
    filterBtnActive: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    filterBtnText: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    filterBtnTextActive: { color: '#fff' },
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginBottom: 10,
        backgroundColor: colors.background.secondary,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.border.color,
    },
    searchInput: { flex: 1, color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 14 },
    listContainer: { paddingHorizontal: 16, paddingBottom: 40 },
    emptyText: { color: colors.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },

    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.tertiary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
    actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    actionBtnTxt: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 13 },
});
