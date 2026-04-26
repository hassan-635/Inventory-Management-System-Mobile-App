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

const SORT_OPTIONS = [
    { key: 'dateDesc', label: 'Newest First' },
    { key: 'dateAsc', label: 'Oldest First' },
    { key: 'amountDesc', label: 'Highest Amount' },
    { key: 'amountAsc', label: 'Lowest Amount' },
];

const CATEGORY_FILTERS = [
    { key: 'all', label: 'All Sales' },
    { key: 'credit', label: 'Credit (Udhar)' },
    { key: 'paid', label: 'Fully Paid' },
    { key: 'method_cash', label: 'Cash Sales' },
    { key: 'method_online', label: 'Online Sales' },
    { key: 'method_split', label: 'Split Sales' },
];

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
    const [sortOption, setSortOption] = useState('dateDesc');
    const [categoryFilterOption, setCategoryFilterOption] = useState('all');
    const [showSortPicker, setShowSortPicker] = useState(false);
    const [showFilterPicker, setShowFilterPicker] = useState(false);
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
        let list = sales.filter(s => {
            const saleDate = new Date(s.purchase_date);
            const withinDate = saleDate >= threshold;
            const matchSearch =
                (s.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.buyers?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                (s.product_id && String(s.product_id).toLowerCase().includes(search.toLowerCase()));
            return withinDate && matchSearch;
        });

        if (categoryFilterOption === 'credit') {
            list = list.filter(s => Number(s.total_amount || 0) > Number(s.paid_amount || 0));
        } else if (categoryFilterOption === 'paid') {
            list = list.filter(s => Number(s.total_amount || 0) <= Number(s.paid_amount || 0));
        } else if (categoryFilterOption === 'method_cash') {
            list = list.filter(s => s.payment_method === 'Cash');
        } else if (categoryFilterOption === 'method_online') {
            list = list.filter(s => s.payment_method === 'Online');
        } else if (categoryFilterOption === 'method_split') {
            list = list.filter(s => s.payment_method === 'Split');
        }

        return list.sort((a,b) => {
            if (sortOption === 'dateDesc') {
                const dA = a.purchase_date ? new Date(a.purchase_date) : new Date(0);
                const dB = b.purchase_date ? new Date(b.purchase_date) : new Date(0);
                if(dA.getTime() === dB.getTime()) return b.id - a.id;
                return dB - dA;
            }
            if (sortOption === 'dateAsc') {
                const dA = a.purchase_date ? new Date(a.purchase_date) : new Date(0);
                const dB = b.purchase_date ? new Date(b.purchase_date) : new Date(0);
                if(dA.getTime() === dB.getTime()) return a.id - b.id;
                return dA - dB;
            }
            if (sortOption === 'amountDesc') return Number(b.total_amount || 0) - Number(a.total_amount || 0);
            if (sortOption === 'amountAsc') return Number(a.total_amount || 0) - Number(b.total_amount || 0);
            return 0;
        });

    }, [sales, activeFilter, search, categoryFilterOption, sortOption]);

    const groupedSales = useMemo(() => {
        // 1. Sort the raw filtered list by date first to group chronologically
        const sortedList = [...filteredSales].sort((a, b) => {
            const dA = a.purchase_date ? new Date(a.purchase_date).getTime() : 0;
            const dB = b.purchase_date ? new Date(b.purchase_date).getTime() : 0;
            if (dA === dB) return b.id - a.id;
            return dB - dA;
        });

        // 2. Group adjacent sales
        const groups = [];
        let currentGroup = null;

        sortedList.forEach((sale) => {
            const saleTime = sale.purchase_date ? new Date(sale.purchase_date).getTime() : 0;
            const buyerName = sale.buyers?.name || sale.buyer_name || 'Walk-in';
            const salesman = sale.users?.name || '-';
            
            if (!currentGroup) {
                currentGroup = {
                    id: sale.invoice_id || sale.id,
                    invoice_id: sale.invoice_id,
                    buyerName,
                    phone: sale.buyers?.phone || '',
                    date: sale.purchase_date,
                    time: saleTime,
                    salesman,
                    items: [sale],
                    totalAmount: Number(sale.total_amount || 0)
                };
            } else {
                const timeDiff = Math.abs(currentGroup.time - saleTime);
                const isSameBuyer = currentGroup.buyerName === buyerName;
                const isSameSalesman = currentGroup.salesman === salesman;
                
                const shouldGroup = (sale.invoice_id && currentGroup.invoice_id)
                    ? (sale.invoice_id === currentGroup.invoice_id)
                    : (isSameBuyer && isSameSalesman && timeDiff <= 120000);

                if (shouldGroup) {
                    currentGroup.items.push(sale);
                    currentGroup.totalAmount += Number(sale.total_amount || 0);
                    if (!currentGroup.invoice_id && sale.id < currentGroup.id) {
                        currentGroup.id = sale.id;
                    }
                } else {
                    groups.push(currentGroup);
                    currentGroup = {
                        id: sale.invoice_id || sale.id,
                        invoice_id: sale.invoice_id,
                        buyerName,
                        phone: sale.buyers?.phone || '',
                        date: sale.purchase_date,
                        time: saleTime,
                        salesman,
                        items: [sale],
                        totalAmount: Number(sale.total_amount || 0)
                    };
                }
            }
        });
        if (currentGroup) groups.push(currentGroup);

        // 3. Sort groups based on user sort option
        groups.sort((a, b) => {
            if (sortOption === 'dateDesc') {
                if (b.time === a.time) return b.id - a.id;
                return b.time - a.time;
            }
            if (sortOption === 'dateAsc') {
                if (a.time === b.time) return a.id - b.id;
                return a.time - b.time;
            }
            if (sortOption === 'amountDesc') return b.totalAmount - a.totalAmount;
            if (sortOption === 'amountAsc') return a.totalAmount - b.totalAmount;
            return 0;
        });

        return groups;
    }, [filteredSales, sortOption]);

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
            <View style={[styles.searchSortRow, { paddingHorizontal: 16, marginBottom: 10 }]}>
                <View style={[styles.searchRow, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
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

            {/* Filter and Sort Dropdowns */}
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 }}>
                <TouchableOpacity
                    style={[styles.sortDropdown, { flex: 1, backgroundColor: colors.background.secondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border.color, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setShowFilterPicker(true)}
                >
                    <Text style={{ color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 13 }} numberOfLines={1}>
                        {CATEGORY_FILTERS.find(o => o.key === categoryFilterOption)?.label || 'All Sales'}
                    </Text>
                    <Icon name="chevron-down" size={16} color={colors.text.secondary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.sortDropdown, { flex: 1, backgroundColor: colors.background.secondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border.color, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setShowSortPicker(true)}
                >
                    <Text style={{ color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 13 }} numberOfLines={1}>
                        {SORT_OPTIONS.find(o => o.key === sortOption)?.label || 'Arrange by'}
                    </Text>
                    <Icon name="chevron-down" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
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
                data={groupedSales}
                keyExtractor={(item, index) => (item.id != null ? String(item.id) : `g-${index}`)}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
                contentContainerStyle={[styles.listContainer, isTablet && { paddingHorizontal: 32 }]}
                ListHeaderComponent={<ListHeader />}
                renderItem={({ item }) => {
                    const groupTotalAmount = item.items.reduce((s, x) => s + Number(x.total_amount || 0), 0);
                    const groupPaidAmount = item.items.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
                    const remaining = groupTotalAmount - groupPaidAmount;
                    const hasBalance = remaining > 0;
                    const groupMethod = item.items[0]?.payment_method || 'Cash';
                    const groupCash = item.items.reduce((s, x) => s + Number(x.cash_amount || 0), 0);
                    const groupOnline = item.items.reduce((s, x) => s + Number(x.online_amount || 0), 0);

                    return (
                        <ExpandableItem
                            title={item.invoice_id ? `Invoice #${item.invoice_id}` : `Invoice #${item.id}`}
                            subtitle={item.buyerName ? `Customer · ${item.buyerName}` : 'Walk-in'}
                            rightText={hasBalance ? `Rs. ${remaining.toLocaleString()}` : '✓ Clear'}
                            rightSubText={`Total: Rs. ${groupTotalAmount.toLocaleString()}`}
                            rightTextColor={hasBalance ? colors.status.danger : colors.status.success}
                            summaryBoxes={[
                                { label: 'Total Sale', value: `Rs. ${groupTotalAmount.toLocaleString()}` },
                                {
                                    label: 'Paid',
                                    value: `Rs. ${groupPaidAmount.toLocaleString()}`,
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
                                'Date': new Date(item.date).toLocaleDateString(),
                                'Items Count': `${item.items.length} Product(s)`,
                                'Method': groupMethod === 'Split' ? `Split (C: ${groupCash} | O: ${groupOnline})` : groupMethod,
                                'Salesman': item.salesman
                            }}
                            renderExtra={() => (
                                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border.color, paddingTop: 12 }}>
                                    <Text style={{ color: colors.text.primary, fontFamily: FONTS.bold, marginBottom: 8, fontSize: 13 }}>Products in this Invoice:</Text>
                                    {item.items.map((sale, idx) => (
                                        <View key={sale.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: idx === item.items.length - 1 ? 0 : 1, borderBottomColor: colors.border.color }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ color: colors.text.primary, fontFamily: FONTS.medium, flex: 1, fontSize: 13 }}>{sale.products?.name}</Text>
                                                <Text style={{ color: colors.text.secondary, fontFamily: FONTS.bold, fontSize: 13 }}>Rs. {Number(sale.total_amount).toLocaleString()}</Text>
                                            </View>
                                            <Text style={{ color: colors.text.muted, fontSize: 12, fontFamily: FONTS.regular }}>
                                                Qty: {sale.quantity} {sale.quantity_unit} | Price: Rs. {Number(sale.products?.price || 0).toLocaleString()}
                                            </Text>
                                            
                                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                                <TouchableOpacity style={[styles.actionBtn, { flex: 1, justifyContent: 'center', paddingVertical: 8, borderWidth: 1, borderColor: colors.border.color }]} onPress={() => openPartialReturnModal(sale)}>
                                                    <Icon name="swap-vertical-outline" size={14} color={colors.accent.primary} />
                                                    <Text style={[styles.actionBtnTxt, { color: colors.accent.primary, fontSize: 12 }]}>Return</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger, { flex: 1, justifyContent: 'center', paddingVertical: 8 }]} onPress={() => handleFullUndo(sale)}>
                                                    <Icon name="arrow-undo-outline" size={14} color={colors.status.danger} />
                                                    <Text style={[styles.actionBtnTxt, { color: colors.status.danger, fontSize: 12 }]}>Undo</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
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

            {/* Filter Modal */}
            <Modal visible={showFilterPicker} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 18 }}>Filter by</Text>
                            <TouchableOpacity onPress={() => setShowFilterPicker(false)}>
                                <Icon name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={CATEGORY_FILTERS}
                            keyExtractor={(item) => item.key}
                            renderItem={({ item }) => {
                                const selected = categoryFilterOption === item.key;
                                return (
                                    <TouchableOpacity
                                        style={[{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.color, flexDirection: 'row', justifyContent: 'space-between' }, selected && { backgroundColor: 'rgba(56, 189, 248, 0.05)' }]}
                                        onPress={() => { setCategoryFilterOption(item.key); setShowFilterPicker(false); }}
                                    >
                                        <Text style={[{ fontFamily: FONTS.medium, color: colors.text.primary }, selected && { color: colors.accent.primary }]}>{item.label}</Text>
                                        {selected && <Icon name="checkmark-circle" size={20} color={colors.accent.primary} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Sort Modal */}
            <Modal visible={showSortPicker} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: colors.background.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 18 }}>Arrange by</Text>
                            <TouchableOpacity onPress={() => setShowSortPicker(false)}>
                                <Icon name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={SORT_OPTIONS}
                            keyExtractor={(item) => item.key}
                            renderItem={({ item }) => {
                                const selected = sortOption === item.key;
                                return (
                                    <TouchableOpacity
                                        style={[{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.color, flexDirection: 'row', justifyContent: 'space-between' }, selected && { backgroundColor: 'rgba(56, 189, 248, 0.05)' }]}
                                        onPress={() => { setSortOption(item.key); setShowSortPicker(false); }}
                                    >
                                        <Text style={[{ fontFamily: FONTS.medium, color: colors.text.primary }, selected && { color: colors.accent.primary }]}>{item.label}</Text>
                                        {selected && <Icon name="checkmark-circle" size={20} color={colors.accent.primary} />}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
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
