import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, Alert, useWindowDimensions, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { salesService } from '../api/sales';
import { useAppTheme } from '../theme/useAppTheme';
import { useToastStore } from '../store/toastStore';
import ExpandableItem from '../components/ExpandableItem';
import Icon from 'react-native-vector-icons/Ionicons';
import { generateSalesAnalyticsPdf } from '../utils/pdfGenerator';
import { formatProductId } from '../utils/formatProductId';
import { flatListPerformanceProps } from '../utils/listPerf';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useDataRefreshStore } from '../store/dataRefreshStore';

const TIME_FILTERS = [
    { key: '1d', label: '1D' },
    { key: '1w', label: '1W' },
    { key: '1m', label: '1M' },
    { key: '6m', label: '6M' },
    { key: '1y', label: '1Y' },
    { key: '5y', label: '5Y' },
    { key: 'all', label: 'All' },
];

const TIME_FILTER_LABELS = {
    '1d': 'Last Day',
    '1w': 'Last Week',
    '1m': 'Last Month',
    '6m': 'Last 6 Months',
    '1y': 'Last Year',
    '5y': 'Last 5 Years',
    'all': 'All time',
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
    const [pdfLoading, setPdfLoading] = useState(false);
    const inventoryTick = useDataRefreshStore((s) => s.inventoryTick);

    const [returnModalSale, setReturnModalSale] = useState(null);
    const [returnQtyInput, setReturnQtyInput] = useState('');
    const [returnSubmitting, setReturnSubmitting] = useState(false);

    const periodLabel = TIME_FILTER_LABELS[activeFilter] || activeFilter;

    const fetchSales = useCallback(async () => {
        try {
            const data = await salesService.getAll();
            setSales(data);
        } catch (error) {
            console.error('Failed to fetch sales:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useRefetchOnFocus(fetchSales);

    useEffect(() => {
        if (inventoryTick === 0) return;
        fetchSales();
    }, [inventoryTick, fetchSales]);

    const onRefresh = () => { setRefreshing(true); fetchSales(); };

    const openPartialReturnModal = (sale) => {
        const max = Number(sale.quantity);
        setReturnQtyInput(max > 1 ? '' : String(max));
        setReturnModalSale(sale);
    };

    const submitPartialReturn = async () => {
        if (!returnModalSale) return;
        const max = Number(returnModalSale.quantity);
        const raw = String(returnQtyInput).trim();
        const q = raw === '' ? max : Number(raw);
        if (!Number.isFinite(q) || q <= 0 || q > max) {
            useToastStore.getState().showToast('Error', `Quantity 1 se ${max} tak honi chahiye.`, 'error');
            return;
        }
        setReturnSubmitting(true);
        try {
            if (q >= max) {
                await salesService.delete(returnModalSale.id);
                useToastStore.getState().showToast('Done', 'Poori line return / undo ho gayi.', 'success');
            } else {
                await salesService.returnQty(returnModalSale.id, q);
                useToastStore.getState().showToast('Done', `${q} returned — stock and credit proportionally updated.`, 'success');
            }
            useDataRefreshStore.getState().bumpInventory();
            setReturnModalSale(null);
            setReturnQtyInput('');
            await fetchSales();
        } catch (err) {
            console.error('Return failed:', err);
            useToastStore.getState().showToast('Error', err.response?.data?.error || 'Return save nahi ho saka.', 'error');
        } finally {
            setReturnSubmitting(false);
        }
    };

    const handleFullUndo = (sale) => {
        Alert.alert(
            'Full return',
            'The entire sold quantity will be returned to the stock, and this line credit/payments will be cleared.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Full return',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await salesService.delete(sale.id);
                            useToastStore.getState().showToast('Done', 'Full return ho gaya.', 'success');
                            useDataRefreshStore.getState().bumpInventory();
                            await fetchSales();
                        } catch (err) {
                            console.error('Error undoing sale:', err);
                            useToastStore.getState().showToast('Error', 'Undo fail. Dobara try karein.', 'error');
                            setLoading(false);
                        }
                    },
                },
            ],
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

    const handleDownloadPdf = async () => {
        if (!filteredSales.length) {
            useToastStore.getState().showToast('Nothing to export', 'No sales in this period.', 'error');
            return;
        }
        setPdfLoading(true);
        try {
            await generateSalesAnalyticsPdf(filteredSales, periodLabel, activeFilter);
            useToastStore.getState().showToast('PDF ready', 'Share or save the sales report.', 'success');
        } catch (e) {
            console.error(e);
            useToastStore.getState().showToast('PDF failed', e?.message || 'Could not create PDF.', 'error');
        } finally {
            setPdfLoading(false);
        }
    };

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

            <TouchableOpacity
                style={[styles.pdfBtn, { opacity: pdfLoading || !filteredSales.length ? 0.55 : 1 }]}
                onPress={handleDownloadPdf}
                disabled={pdfLoading || !filteredSales.length}
            >
                {pdfLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Icon name="download-outline" size={20} color="#fff" />
                )}
                <Text style={styles.pdfBtnText}>Download PDF report</Text>
            </TouchableOpacity>
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
                {...flatListPerformanceProps}
                data={filteredSales}
                keyExtractor={(item, index) => (item.id != null ? String(item.id) : `s-${index}`)}
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
                                'Method': item.payment_method === 'Split' ? `Split (C: ${item.cash_amount} | O: ${item.online_amount})` : (item.payment_method || 'Cash'),
                                'Price/Unit': `Rs. ${item.products?.price || '-'}`,
                                'Date': new Date(item.purchase_date).toLocaleDateString()
                            }}
                            renderActions={() => (
                                <View style={{ flexDirection: 'row', flex: 1, minWidth: '100%', gap: 8 }}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { flex: 1, justifyContent: 'center', borderWidth: 1, borderColor: colors.border.color }]}
                                        onPress={() => openPartialReturnModal(item)}
                                    >
                                        <Icon name="swap-vertical-outline" size={18} color={colors.accent.primary} />
                                        <Text style={[styles.actionBtnTxt, { color: colors.accent.primary, fontSize: 12 }]} numberOfLines={2}>
                                            Partial return
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.actionBtnDanger, { flex: 1, justifyContent: 'center' }]}
                                        onPress={() => handleFullUndo(item)}
                                    >
                                        <Icon name="arrow-undo-outline" size={18} color={colors.status.danger} />
                                        <Text style={[styles.actionBtnTxt, { color: colors.status.danger, fontSize: 12 }]} numberOfLines={2}>
                                            Full return
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No sales in this period.</Text>}
            />

            <Modal visible={!!returnModalSale} transparent animationType="slide" onRequestClose={() => !returnSubmitting && setReturnModalSale(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.returnModalOverlay}>
                    <View style={[styles.returnModalBox, { backgroundColor: colors.background.secondary, borderColor: colors.border.color }]}>
                        <Text style={[styles.returnModalTitle, { color: colors.text.primary, fontFamily: FONTS.bold }]}>
                            Return kitni qty?
                        </Text>
                        {returnModalSale && (
                            <Text style={{ color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 13, marginBottom: 12 }}>
                                Max {returnModalSale.quantity} ({returnModalSale.products?.name || 'Product'})
                                {'\n'}
                                Partial quantity = proportionally returned to stock, and credit is reduced for this line.
                            </Text>
                        )}
                        <TextInput
                            style={[styles.returnModalInput, { color: colors.text.primary, borderColor: colors.border.color, backgroundColor: colors.background.primary }]}
                            placeholder={returnModalSale ? `1 – ${returnModalSale.quantity}` : ''}
                            placeholderTextColor={colors.text.muted}
                            keyboardType="number-pad"
                            value={returnQtyInput}
                            onChangeText={setReturnQtyInput}
                            editable={!returnSubmitting}
                        />
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                            <TouchableOpacity
                                style={[styles.returnModalBtn, { flex: 1, backgroundColor: colors.background.primary }]}
                                onPress={() => !returnSubmitting && setReturnModalSale(null)}
                                disabled={returnSubmitting}
                            >
                                <Text style={{ color: colors.text.secondary, fontFamily: FONTS.bold }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.returnModalBtn, { flex: 1, backgroundColor: colors.accent.primary }]}
                                onPress={submitPartialReturn}
                                disabled={returnSubmitting}
                            >
                                {returnSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontFamily: FONTS.bold }}>Save return</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.accent.primary,
    },
    pdfBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 14 },
    listContainer: { paddingHorizontal: 16, paddingBottom: 40 },
    emptyText: { color: colors.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },

    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.tertiary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
    actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    actionBtnTxt: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 13 },

    returnModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    returnModalBox: { borderRadius: 16, padding: 20, borderWidth: 1 },
    returnModalTitle: { fontSize: 18, marginBottom: 8 },
    returnModalInput: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 8 },
    returnModalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
