import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TextInput, TouchableOpacity, Modal, Alert, ScrollView, Platform, useWindowDimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { suppliersService } from '../api/suppliers';
import apiClient from '../api/apiClient';
import { useAppTheme } from '../theme/useAppTheme';
import ExpandableItem from '../components/ExpandableItem';
import { flatListPerformanceProps } from '../utils/listPerf';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';
import GenericSideList from '../components/GenericSideList';

const SORT_OPTIONS = [
    { key: 'balanceDesc', label: 'Highest Payable' },
    { key: 'balanceAsc', label: 'Lowest Payable' },
    { key: 'nameAsc', label: 'Name (A-Z)' },
    { key: 'nameDesc', label: 'Name (Z-A)' },
    { key: 'dateDesc', label: 'Newest First' },
    { key: 'dateAsc', label: 'Oldest First' },
];

const FILTER_OPTIONS = [
    { key: 'all', label: 'All Suppliers' },
    { key: 'pending', label: 'Pending Payables' },
    { key: 'cleared', label: 'All Cleared' },
    { key: 'method_cash', label: 'Cash Suppliers' },
    { key: 'method_online', label: 'Online Suppliers' },
    { key: 'method_split', label: 'Split Suppliers' },
];

export default function SuppliersScreen() {
    const { colors, FONTS } = useAppTheme();
    const styles = useMemo(() => getStyles(colors, FONTS), [colors, FONTS]);
    const { width } = useWindowDimensions();
    const isTablet = width > 768;

    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [sortOption, setSortOption] = useState('balanceDesc');
    const [filterOption, setFilterOption] = useState('all');
    const [showSortPicker, setShowSortPicker] = useState(false);
    const [showFilterPicker, setShowFilterPicker] = useState(false);

    // Side List State
    const [isSideListVisible, setIsSideListVisible] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // CRUD State
    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPurchaseDatePicker, setShowPurchaseDatePicker] = useState(false);
    const [formItem, setFormItem] = useState({
        id: null, name: '', phone: '', company_name: '',
        payment_amount: '', txn_due: 0, payment_date: new Date(),
        payment_method: 'Cash', cash_amount: '', online_amount: '',
        product_name: '', quantity: '', unit_price: '', total_amount: '',
        purchase_paid_amount: '0', purchase_date: new Date(),
        purchase_payment_method: 'Cash', purchase_cash_amount: '', purchase_online_amount: ''
    });

    const fetchSuppliers = useCallback(async () => {
        try {
            const data = await suppliersService.getAll();
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to fetch suppliers:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useRefetchOnFocus(fetchSuppliers);
    const onRefresh = () => { setRefreshing(true); fetchSuppliers(); };

    // CRUD Functions
    const openModal = (supplier = null) => {
        const extra = {
            product_name: '', quantity: '', unit_price: '', total_amount: '',
            purchase_paid_amount: '0', purchase_date: new Date(),
            purchase_payment_method: 'Cash', purchase_cash_amount: '', purchase_online_amount: ''
        };
        if (supplier) {
            const txnDue = (supplier.supplier_transactions || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);
            setFormItem({
                id: supplier.id,
                name: supplier.name || '',
                phone: supplier.phone || '',
                company_name: supplier.company_name || '',
                payment_amount: '',
                payment_date: new Date(),
                txn_due: txnDue,
                payment_method: 'Cash',
                cash_amount: '',
                online_amount: '',
                ...extra
            });
        } else {
            setFormItem({ id: null, name: '', phone: '', company_name: '', payment_amount: '', txn_due: 0, payment_date: new Date(), payment_method: 'Cash', cash_amount: '', online_amount: '', ...extra });
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formItem.name || !String(formItem.name).trim()) {
            useToastStore.getState().showToast('Error', 'Supplier name is required.', 'error'); return;
        }

        if (!formItem.id) {
            if (isSupplierIdInPendingList(formItem.name.trim())) {
                useToastStore.getState().showToast('Error', 'This supplier is already in the pending list.', 'error'); return;
            }
            const payload = { name: String(formItem.name).trim(), phone: String(formItem.phone || '').trim(), company_name: String(formItem.company_name || '').trim() };
            
            const newItem = { action: 'add', name: formItem.name.trim(), data: payload };

            // Check if user entered total_amount (opening balance OR product purchase)
            const totalAmt = Number(formItem.total_amount || 0);
            const hasProduct = String(formItem.product_name || '').trim() !== '' && Number(formItem.quantity) > 0;
            const isOpeningBalance = !hasProduct && totalAmt > 0;

            if (isOpeningBalance || hasProduct) {
                const paidAmt = Number(formItem.purchase_paid_amount || 0);
                if (paidAmt > totalAmt) {
                    useToastStore.getState().showToast('Error', 'Paid amount cannot exceed total amount.', 'error'); return;
                }
                const pm = formItem.purchase_payment_method || 'Cash';
                if (pm === 'Split' && paidAmt > 0) {
                    const pc = Number(formItem.purchase_cash_amount || 0);
                    const po = Number(formItem.purchase_online_amount || 0);
                    if (Math.abs((pc + po) - paidAmt) > 0.01) {
                        useToastStore.getState().showToast('Error', `Split amounts (${pc}+${po}) must equal paid amount (${paidAmt}).`, 'error'); return;
                    }
                }
                newItem.purchaseData = {
                    product_name: hasProduct ? String(formItem.product_name).trim() : 'Opening Balance',
                    quantity: hasProduct ? Number(formItem.quantity) : 1,
                    total_amount: totalAmt,
                    paid_amount: paidAmt,
                    purchase_date: formItem.purchase_date.toISOString().split('T')[0],
                    payment_method: pm,
                    cash_amount: Number(formItem.purchase_cash_amount || 0),
                    online_amount: Number(formItem.purchase_online_amount || 0),
                };
            }

            setPendingItems(prev => [...prev, newItem]);
            setIsSideListVisible(true);
            setModalVisible(false);
            useToastStore.getState().showToast('Added to Pending', 'Supplier added to pending list.', 'success');
            return;
        }

        // --- Existing supplier ---
        const payStr = String(formItem.payment_amount || '').trim();
        const hasPayment = payStr !== '' && Number(payStr) > 0;
        const hasProduct = String(formItem.product_name || '').trim() !== '' && Number(formItem.quantity) > 0;

        // Validate payment
        if (hasPayment) {
            const payAmt = Number(payStr);
            if (!Number.isFinite(payAmt) || payAmt <= 0) {
                useToastStore.getState().showToast('Error', 'Enter a valid payment amount.', 'error'); return;
            }
            if (payAmt > formItem.txn_due) {
                useToastStore.getState().showToast('Error', 'Payment cannot exceed remaining amount: Rs. ' + formItem.txn_due, 'error'); return;
            }
            if (formItem.payment_method === 'Split') {
                const pc = Number(formItem.cash_amount || 0);
                const po = Number(formItem.online_amount || 0);
                if (pc < 0 || po < 0) { useToastStore.getState().showToast('Error', 'Split amounts cannot be negative.', 'error'); return; }
                if (Math.abs((pc + po) - payAmt) > 0.01) { useToastStore.getState().showToast('Error', `Split amounts (${pc}+${po}) must equal paid amount (${payAmt}).`, 'error'); return; }
            }
        }

        // Validate product
        if (hasProduct) {
            const pPaid = Number(formItem.purchase_paid_amount || 0);
            const pTotal = Number(formItem.total_amount || 0);
            if (pPaid > pTotal) { useToastStore.getState().showToast('Error', 'Paid amount cannot exceed total amount.', 'error'); return; }
            if (formItem.purchase_payment_method === 'Split') {
                const pc = Number(formItem.purchase_cash_amount || 0);
                const po = Number(formItem.purchase_online_amount || 0);
                if (pc < 0 || po < 0) { useToastStore.getState().showToast('Error', 'Split amounts cannot be negative.', 'error'); return; }
                if (pPaid > 0 && Math.abs((pc + po) - pPaid) > 0.01) { useToastStore.getState().showToast('Error', `Split amounts (${pc}+${po}) must equal paid amount (${pPaid}).`, 'error'); return; }
            }
        }

        setIsSaving(true);
        try {
            const basicPayload = {
                name: String(formItem.name).trim(),
                phone: String(formItem.phone || '').trim(),
                company_name: String(formItem.company_name || '').trim(),
            };
            if (hasPayment) {
                basicPayload.payment_amount = Number(payStr);
                basicPayload.date = formItem.payment_date.toISOString().split('T')[0];
                basicPayload.payment_method = formItem.payment_method;
                basicPayload.cash_amount = Number(formItem.cash_amount || 0);
                basicPayload.online_amount = Number(formItem.online_amount || 0);
            }
            await suppliersService.update(formItem.id, basicPayload);

            const totalAmt = Number(formItem.total_amount || 0);
            const isOpeningBalance = !hasProduct && totalAmt > 0;

            if (hasProduct || isOpeningBalance) {
                await apiClient.post('/purchases', {
                    supplier_id: formItem.id,
                    product_name: hasProduct ? String(formItem.product_name).trim() : 'Opening Balance',
                    quantity: hasProduct ? Number(formItem.quantity) : 1,
                    total_amount: Number(formItem.total_amount || 0),
                    paid_amount: Number(formItem.purchase_paid_amount || 0),
                    purchase_date: formItem.purchase_date.toISOString().split('T')[0],
                    payment_method: formItem.purchase_payment_method,
                    cash_amount: Number(formItem.purchase_cash_amount || 0),
                    online_amount: Number(formItem.purchase_online_amount || 0)
                });
            }

            setModalVisible(false);
            useToastStore.getState().showToast('Saved', 'Supplier saved successfully!', 'success');
            fetchSuppliers();
        } catch (error) {
            console.error('Save supplier error', error);
            useToastStore.getState().showToast('Error', error.response?.data?.error || 'Could not save supplier.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = (id) => {
        const supplier = suppliers.find(s => s.id === id);
        if (!supplier) return;
        
        // Check if supplier is already in pending list
        if (isSupplierIdInPendingList(id)) {
            useToastStore.getState().showToast('Error', 'This supplier is already in the pending list.', 'error');
            return;
        }
        
        Alert.alert("Delete Supplier", `Add "${supplier.name}" to pending deletions?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Add to Pending",
                style: "default",
                onPress: () => {
                    const newItem = {
                        action: 'delete',
                        name: supplier.name,
                        data: supplier
                    };
                    
                    setPendingItems(prev => [...prev, newItem]);
                    setIsSideListVisible(true);
                    useToastStore.getState().showToast('Added to Pending', 'Supplier added to pending deletions.', 'success');
                }
            }
        ]);
    };


    // Check if supplier ID already exists in pending list
    const isSupplierIdInPendingList = (supplierId) => {
        return pendingItems.some(item => {
            if (item.action === 'add') {
                // For new items, check by name
                return item.name.toLowerCase().trim() === supplierId.toLowerCase().trim();
            } else if (item.action === 'delete') {
                // For deletions, check by actual ID
                return item.data.id === supplierId;
            }
            return false;
        });
    };

    // Side List Handlers
    const handleRemovePendingItem = (index) => {
        setPendingItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleClearAllPending = () => {
        Alert.alert('Clear All', 'Clear all pending changes?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear All',
                style: 'destructive',
                onPress: () => setPendingItems([])
            }
        ]);
    };

    const handleProcessPendingItems = async () => {
        if (pendingItems.length === 0) return;
        
        Alert.alert('Process Changes', `Process ${pendingItems.length} pending changes? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Process',
                style: 'default',
                onPress: async () => {
                    setIsProcessing(true);
                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];

                    try {
                        // Process items in order
                        for (const item of pendingItems) {
                            try {
                                if (item.action === 'add') {
                                    const res = await suppliersService.create(item.data);
                                    // suppliersService.create returns response.data which is { message, data: [supplier] }
                                    const newSupplier = Array.isArray(res?.data) ? res.data[0] : (res?.data || res);
                                    if (newSupplier?.id && item.purchaseData) {
                                        await apiClient.post('/purchases', { ...item.purchaseData, supplier_id: newSupplier.id });
                                    }
                                    successCount++;
                                } else if (item.action === 'delete') {
                                    await suppliersService.delete(item.data.id);
                                    successCount++;
                                }
                            } catch (err) {
                                errorCount++;
                                errors.push(`${item.action === 'add' ? 'Adding' : 'Deleting'} "${item.name}": ${err.response?.data?.error || err.message}`);
                            }
                        }

                        // Show results
                        if (errorCount > 0) {
                            Alert.alert('Partial Success', `Processed ${successCount} items successfully. ${errorCount} items failed:\n\n${errors.join('\n')}`);
                        } else {
                            useToastStore.getState().showToast('Success', `Successfully processed ${successCount} items!`, 'success');
                        }

                        // Clear pending items and refresh suppliers
                        setPendingItems([]);
                        setIsSideListVisible(false);
                        fetchSuppliers();
                    } catch (err) {
                        console.error('Error processing pending items:', err);
                        useToastStore.getState().showToast('Error', 'An unexpected error occurred while processing items.', 'error');
                    } finally {
                        setIsProcessing(false);
                    }
                }
            }
        ]);
    };

    const computeDue = useCallback((txns) =>
        (txns || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0), []);

    const computePaid = useCallback((txns) =>
        (txns || []).reduce((acc, t) => acc + Number(t.paid_amount || 0), 0), []);

    const filteredSuppliers = useMemo(() => {
        let list = suppliers.filter(s => {
            const q = search.toLowerCase();
            return (
                (s.name || '').toLowerCase().includes(q) ||
                (s.company_name || '').toLowerCase().includes(q) ||
                (s.phone || '').includes(search)
            );
        });

        if (filterOption === 'pending') {
            list = list.filter(b => computeDue(b.supplier_transactions) > 0);
        } else if (filterOption === 'cleared') {
            list = list.filter(b => computeDue(b.supplier_transactions) <= 0);
        } else if (filterOption === 'method_cash') {
            list = list.filter(b => (b.supplier_transactions || []).some(t => t.payment_method === 'Cash'));
        } else if (filterOption === 'method_online') {
            list = list.filter(b => (b.supplier_transactions || []).some(t => t.payment_method === 'Online'));
        } else if (filterOption === 'method_split') {
            list = list.filter(b => (b.supplier_transactions || []).some(t => t.payment_method === 'Split'));
        }

        return list.sort((a, b) => {
            const dueA = computeDue(a.supplier_transactions);
            const dueB = computeDue(b.supplier_transactions);

            if (sortOption === 'balanceDesc') {
                if (dueA === 0 && dueB === 0) return (a.name || '').localeCompare(b.name || '');
                return dueB - dueA;
            }
            if (sortOption === 'balanceAsc') {
                if (dueA === 0 && dueB === 0) return (a.name || '').localeCompare(b.name || '');
                return dueA - dueB;
            }
            if (sortOption === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
            if (sortOption === 'nameDesc') return (b.name || '').localeCompare(a.name || '');
            if (sortOption === 'dateDesc') return (b.id || 0) - (a.id || 0);
            if (sortOption === 'dateAsc') return (a.id || 0) - (b.id || 0);

            return 0;
        });
    }, [suppliers, search, filterOption, sortOption, computeDue]);

    const filteredPending = useMemo(
        () => filteredSuppliers.reduce((sum, s) => sum + computeDue(s.supplier_transactions), 0),
        [filteredSuppliers]
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
            <Text style={styles.headerTitle}>Suppliers Directory</Text>

            <View style={[styles.searchSortRow, { paddingHorizontal: 16, marginBottom: 10 }]}>
                <View style={[styles.searchRow, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
                    <Icon name="search-outline" size={18} color={colors.text.secondary} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search name, company, phone..."
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
                        {FILTER_OPTIONS.find(o => o.key === filterOption)?.label || 'All Suppliers'}
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
                            data={FILTER_OPTIONS}
                            keyExtractor={(item) => item.key}
                            renderItem={({ item }) => {
                                const selected = filterOption === item.key;
                                return (
                                    <TouchableOpacity
                                        style={[{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.color, flexDirection: 'row', justifyContent: 'space-between' }, selected && { backgroundColor: 'rgba(56, 189, 248, 0.05)' }]}
                                        onPress={() => { setFilterOption(item.key); setShowFilterPicker(false); }}
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

            <View style={styles.summaryBar}>
                <Text style={styles.summaryBarText}>
                    {filteredSuppliers.length} suppliers •{' '}
                    <Text style={{ color: colors.status.danger }}>
                        Rs. {filteredPending.toLocaleString()} pending
                    </Text>
                </Text>
            </View>

            <FlatList
                {...flatListPerformanceProps}
                data={filteredSuppliers}
                keyExtractor={(item) => String(item.id)}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
                contentContainerStyle={[styles.listContainer, isTablet && { paddingHorizontal: 32 }]}
                renderItem={({ item }) => {
                    const due = computeDue(item.supplier_transactions);
                    const paid = computePaid(item.supplier_transactions);
                    const txns = item.supplier_transactions || [];
                    const totalVol = txns.reduce((s, t) => s + Number(t.total_amount || 0), 0);
                    const hasDue = due > 0;
                    return (
                        <ExpandableItem
                            title={item.name}
                            subtitle={item.company_name || item.phone || null}
                            rightText={hasDue ? `Rs. ${due.toLocaleString()}` : '✓ Clear'}
                            rightSubText={`Total: Rs. ${totalVol.toLocaleString()}`}
                            rightTextColor={hasDue ? colors.status.danger : colors.status.success}
                            summaryBoxes={[
                                { label: 'Purchases', value: `Rs. ${totalVol.toLocaleString()}` },
                                {
                                    label: 'Paid',
                                    value: `Rs. ${paid.toLocaleString()}`,
                                    valueColor: colors.status.success,
                                    borderColor: colors.status.success,
                                },
                                {
                                    label: 'Pending',
                                    value: `Rs. ${due.toLocaleString()}`,
                                    valueColor: hasDue ? colors.status.danger : colors.status.success,
                                    borderColor: hasDue ? colors.status.danger : colors.status.success,
                                },
                            ]}
                            iconName="storefront-outline"
                            containerStyle={hasDue ? { borderColor: 'rgba(239,68,68,0.3)' } : undefined}
                            detailsData={{
                                'Phone': item.phone || 'N/A',
                                'Company': item.company_name || 'N/A',
                            }}
                            renderExtra={() => (
                                <>
                                    {(item.supplier_transactions || []).length > 0 && (
                                        <View style={{ marginTop: 10 }}>
                                            <Text style={[styles.inputLabel, { marginBottom: 6, fontSize: 12, letterSpacing: 0.5 }]}>📦 PURCHASE HISTORY</Text>
                                            {item.supplier_transactions.map((txn, idx) => {
                                                const isOpeningBalance = txn.products?.name === '__opening_balance__';
                                                const displayProductName = isOpeningBalance ? '💰 Opening Balance' : (txn.products?.name || `Product #${txn.product_id}`);
                                                const purchaseRate = txn.quantity > 0 ? Math.round(Number(txn.total_amount) / Number(txn.quantity)) : 0;
                                                const remaining = Number(txn.total_amount || 0) - Number(txn.paid_amount || 0);
                                                return (
                                                    <View key={txn.id || idx} style={styles.txnCard}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                                <Text style={styles.txnProduct}>{displayProductName}</Text>
                                                                {txn.payment_method && (
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                                                                        <View style={[{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
                                                                            txn.payment_method === 'Cash' ? { backgroundColor: 'rgba(74,222,128,0.15)' } :
                                                                            txn.payment_method === 'Online' ? { backgroundColor: 'rgba(56,189,248,0.15)' } :
                                                                            { backgroundColor: 'rgba(251,191,36,0.15)' }
                                                                        ]}>
                                                                            <Text style={[{ fontSize: 10, fontFamily: FONTS.bold },
                                                                                txn.payment_method === 'Cash' ? { color: '#4ade80' } :
                                                                                txn.payment_method === 'Online' ? { color: '#38bdf8' } :
                                                                                { color: '#fbbf24' }
                                                                            ]}>{txn.payment_method}</Text>
                                                                        </View>
                                                                        {txn.payment_method === 'Split' && (
                                                                            <Text style={{ fontSize: 10, color: colors.text.muted, fontFamily: FONTS.regular }}>
                                                                                C:{txn.cash_amount} | O:{txn.online_amount}
                                                                            </Text>
                                                                        )}
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text style={[styles.txnRemaining, { color: remaining > 0 ? colors.status.danger : colors.status.success }]}>
                                                                {remaining > 0 ? `Due: Rs. ${remaining.toLocaleString()}` : '✓ Paid'}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.txnRow}>
                                                            {!isOpeningBalance && (
                                                                <>
                                                                    <View style={styles.txnCell}>
                                                                        <Text style={styles.txnLabel}>Qty</Text>
                                                                        <Text style={styles.txnValue}>{txn.quantity}</Text>
                                                                    </View>
                                                                    <View style={styles.txnCell}>
                                                                        <Text style={styles.txnLabel}>Rate/Unit</Text>
                                                                        <Text style={styles.txnValue}>Rs. {purchaseRate.toLocaleString()}</Text>
                                                                    </View>
                                                                </>
                                                            )}
                                                            <View style={styles.txnCell}>
                                                                <Text style={styles.txnLabel}>Total</Text>
                                                                <Text style={styles.txnValue}>Rs. {Number(txn.total_amount).toLocaleString()}</Text>
                                                            </View>
                                                            <View style={styles.txnCell}>
                                                                <Text style={styles.txnLabel}>Paid</Text>
                                                                <Text style={[styles.txnValue, { color: colors.status.success }]}>Rs. {Number(txn.paid_amount).toLocaleString()}</Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </>
                            )}
                            renderActions={() => (
                                <>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => openModal(item)}>
                                        <Icon name="create-outline" size={18} color={colors.text.primary} />
                                        <Text style={styles.actionBtnTxt}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => confirmDelete(item.id)}>
                                        <Icon name="trash-outline" size={18} color={colors.status.danger} />
                                        <Text style={[styles.actionBtnTxt, { color: colors.status.danger }]}>Delete</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        />
                    );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No suppliers found.</Text>}
            />

            {/* Floating Action Button */}
            <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
                <Icon name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Pending Items Indicator */}
            {pendingItems.length > 0 && (
                <TouchableOpacity 
                    style={[styles.pendingIndicator, { backgroundColor: colors.accent.primary }]}
                    onPress={() => setIsSideListVisible(true)}
                >
                    <Icon name="list-outline" size={20} color="#fff" />
                    <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>{pendingItems.length}</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Add / Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isTablet && { width: '60%', alignSelf: 'center' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{formItem.id ? 'Edit Supplier' : 'Add Supplier'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Supplier Name *</Text>
                            <TextInput style={styles.input} value={formItem.name} onChangeText={t => setFormItem({...formItem, name: t})} placeholder="Enter name" placeholderTextColor={colors.text.muted} />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput style={styles.input} value={formItem.phone} onChangeText={t => setFormItem({...formItem, phone: t})} keyboardType="phone-pad" placeholder="Enter phone (optional)" placeholderTextColor={colors.text.muted} />

                            <Text style={styles.inputLabel}>Company Name</Text>
                            <TextInput style={styles.input} value={formItem.company_name} onChangeText={t => setFormItem({...formItem, company_name: t})} placeholder="Company Name (optional)" placeholderTextColor={colors.text.muted} />
                            
                            {!!formItem.id && formItem.txn_due > 0 && (
                                <>
                                    <View style={{ height: 1, backgroundColor: colors.border.color, marginVertical: 10 }} />
                                    <Text style={[styles.inputLabel, { color: colors.accent.primary, fontFamily: FONTS.bold }]}>Pay supplier (Rs) <Text style={{color: colors.text.muted, fontSize: 12, fontFamily: FONTS.regular}}>(max: {formItem.txn_due})</Text></Text>
                                    <Text style={{ fontSize: 11, color: colors.text.muted, marginBottom: 8 }}>Aap supplier ko pay karte hain — sab se purani unpaid entries pehle clear hoti hain.</Text>
                                    <TextInput style={styles.input} value={formItem.payment_amount} onChangeText={t => setFormItem({...formItem, payment_amount: t})} keyboardType="numeric" placeholder="Enter amount..." placeholderTextColor={colors.text.muted} />

                                    {formItem.payment_amount > 0 && (
                                        <View style={{ marginBottom: 16 }}>
                                            <Text style={styles.inputLabel}>Payment Method</Text>
                                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                                {['Cash', 'Online', 'Split'].map(pm => (
                                                    <TouchableOpacity
                                                        key={pm}
                                                        style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.background.primary, borderWidth: 1, borderColor: colors.border.color }, formItem.payment_method === pm && { backgroundColor: 'rgba(56,189,248,0.1)', borderColor: '#38bdf8' }]}
                                                        onPress={() => setFormItem({...formItem, payment_method: pm})}
                                                    >
                                                        <Text style={[{ fontFamily: FONTS.medium, color: colors.text.primary }, formItem.payment_method === pm && { color: '#38bdf8', fontFamily: FONTS.bold }]}>{pm === 'Online' ? '📱 Online' : (pm === 'Cash' ? '💵 Cash' : '🔀 Split')}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                            
                                            {formItem.payment_method === 'Split' && (
                                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.inputLabel, { fontSize: 11 }]}>Cash Amount</Text>
                                                        <TextInput style={[styles.input, { marginBottom: 0 }]} value={formItem.cash_amount} onChangeText={t => setFormItem({...formItem, cash_amount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.inputLabel, { fontSize: 11 }]}>Online Amount</Text>
                                                        <TextInput style={[styles.input, { marginBottom: 0 }]} value={formItem.online_amount} onChangeText={t => setFormItem({...formItem, online_amount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    <Text style={styles.inputLabel}>Payment Date</Text>
                                    <TouchableOpacity 
                                        style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={{ color: colors.text.primary, fontFamily: FONTS.regular }}>
                                            {formItem.payment_date.toLocaleDateString()}
                                        </Text>
                                        <Icon name="calendar-outline" size={18} color={colors.text.secondary} />
                                    </TouchableOpacity>

                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={formItem.payment_date}
                                            mode="date"
                                            display="default"
                                            onChange={(event, selectedDate) => {
                                                setShowDatePicker(Platform.OS === 'ios');
                                                if (selectedDate) setFormItem({...formItem, payment_date: selectedDate});
                                            }}
                                        />
                                    )}
                                </>
                            )}

                            {true && (
                                <>
                                    <View style={{ height: 1, backgroundColor: colors.border.color, marginVertical: 10 }} />
                                    <Text style={[styles.inputLabel, { color: colors.accent.primary, fontFamily: FONTS.bold, marginBottom: 4 }]}>{formItem.id ? '📦 Add New Purchase (Optional)' : '💰 Balance / Purchase Details (Optional)'}</Text>

                                    <Text style={styles.inputLabel}>Product Name (Optional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formItem.product_name}
                                        onChangeText={t => setFormItem({...formItem, product_name: t})}
                                        placeholder="Leave blank for Opening Balance"
                                        placeholderTextColor={colors.text.muted}
                                    />

                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.inputLabel, { fontSize: 12 }]}>Quantity</Text>
                                            <TextInput
                                                style={[styles.input, { marginBottom: 0 }]}
                                                value={formItem.quantity}
                                                onChangeText={t => {
                                                    const qty = Number(t);
                                                    const price = Number(formItem.unit_price || 0);
                                                    setFormItem({...formItem, quantity: t, total_amount: qty > 0 && price > 0 ? String(qty * price) : formItem.total_amount});
                                                }}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={colors.text.muted}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.inputLabel, { fontSize: 12 }]}>Unit Price (Rs)</Text>
                                            <TextInput
                                                style={[styles.input, { marginBottom: 0 }]}
                                                value={formItem.unit_price}
                                                onChangeText={t => {
                                                    const price = Number(t);
                                                    const qty = Number(formItem.quantity || 0);
                                                    setFormItem({...formItem, unit_price: t, total_amount: qty > 0 && price > 0 ? String(qty * price) : formItem.total_amount});
                                                }}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={colors.text.muted}
                                            />
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.inputLabel, { fontSize: 12 }]}>Total Amount (Rs)</Text>
                                            <TextInput
                                                style={[styles.input, { marginBottom: 0 }]}
                                                value={formItem.total_amount}
                                                onChangeText={t => setFormItem({...formItem, total_amount: t})}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={colors.text.muted}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.inputLabel, { fontSize: 12 }]}>Paid Amount (Rs)</Text>
                                            <TextInput
                                                style={[styles.input, { marginBottom: 0 }]}
                                                value={formItem.purchase_paid_amount}
                                                onChangeText={t => setFormItem({...formItem, purchase_paid_amount: t})}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={colors.text.muted}
                                            />
                                        </View>
                                    </View>

                                    {Number(formItem.purchase_paid_amount) > 0 && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={styles.inputLabel}>Payment Method</Text>
                                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                                {['Cash', 'Online', 'Split'].map(pm => (
                                                    <TouchableOpacity
                                                        key={pm}
                                                        style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.background.primary, borderWidth: 1, borderColor: colors.border.color }, formItem.purchase_payment_method === pm && { backgroundColor: 'rgba(56,189,248,0.1)', borderColor: '#38bdf8' }]}
                                                        onPress={() => setFormItem({...formItem, purchase_payment_method: pm})}
                                                    >
                                                        <Text style={[{ fontFamily: FONTS.medium, color: colors.text.primary, fontSize: 12 }, formItem.purchase_payment_method === pm && { color: '#38bdf8', fontFamily: FONTS.bold }]}>
                                                            {pm === 'Online' ? '📱 Online' : pm === 'Cash' ? '💵 Cash' : '🔀 Split'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            {formItem.purchase_payment_method === 'Split' && (
                                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.inputLabel, { fontSize: 11 }]}>Cash Amount</Text>
                                                        <TextInput style={[styles.input, { marginBottom: 0 }]} value={formItem.purchase_cash_amount} onChangeText={t => setFormItem({...formItem, purchase_cash_amount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.inputLabel, { fontSize: 11 }]}>Online Amount</Text>
                                                        <TextInput style={[styles.input, { marginBottom: 0 }]} value={formItem.purchase_online_amount} onChangeText={t => setFormItem({...formItem, purchase_online_amount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>Purchase Date</Text>
                                    <TouchableOpacity
                                        style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                                        onPress={() => setShowPurchaseDatePicker(true)}
                                    >
                                        <Text style={{ color: colors.text.primary, fontFamily: FONTS.regular }}>{formItem.purchase_date.toLocaleDateString()}</Text>
                                        <Icon name="calendar-outline" size={18} color={colors.text.secondary} />
                                    </TouchableOpacity>
                                    {showPurchaseDatePicker && (
                                        <DateTimePicker
                                            value={formItem.purchase_date}
                                            mode="date"
                                            display="default"
                                            onChange={(event, selectedDate) => {
                                                setShowPurchaseDatePicker(Platform.OS === 'ios');
                                                if (selectedDate) setFormItem({...formItem, purchase_date: selectedDate});
                                            }}
                                        />
                                    )}
                                </>
                            )}

                                    <View style={{ height: 20 }} />
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={isSaving}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Supplier Side List */}
            <GenericSideList
                visible={isSideListVisible}
                onClose={() => setIsSideListVisible(false)}
                pendingItems={pendingItems}
                onRemoveItem={handleRemovePendingItem}
                onClearAll={handleClearAllPending}
                onProcessItems={handleProcessPendingItems}
                isProcessing={isProcessing}
                colors={colors}
                FONTS={FONTS}
                entityType="supplier"
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
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginBottom: 10,
        backgroundColor: colors.background.secondary,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.border.color,
    },
    searchInput: { flex: 1, color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 14 },
    summaryBar: {
        marginHorizontal: 16,
        marginBottom: 10,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.2)',
    },
    summaryBarText: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    listContainer: { padding: 16, paddingBottom: 100 },
    emptyText: { color: colors.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },
    
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.tertiary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 6 },
    actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    actionBtnTxt: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 13 },
    
    fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    
    // Pending List Styles
    pendingIndicator: { 
        position: 'absolute', 
        bottom: 24, 
        left: 24, 
        width: 50, 
        height: 50, 
        borderRadius: 25, 
        justifyContent: 'center', 
        alignItems: 'center', 
        elevation: 5, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.3, 
        shadowRadius: 4 
    },
    pendingBadge: { 
        position: 'absolute', 
        top: -4, 
        right: -4, 
        backgroundColor: colors.status.danger, 
        borderRadius: 10, 
        minWidth: 20, 
        height: 20, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    pendingBadgeText: { 
        color: '#fff', 
        fontSize: 10, 
        fontFamily: FONTS.bold, 
        paddingHorizontal: 4 
    },
    
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { backgroundColor: colors.background.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, color: colors.text.primary, fontFamily: FONTS.bold },
    modalBody: { marginBottom: 20 },
    inputLabel: { color: colors.text.secondary, fontSize: 13, marginBottom: 6, fontFamily: FONTS.medium },
    input: { backgroundColor: colors.background.primary, color: colors.text.primary, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border.color, fontFamily: FONTS.regular },
    
    modalFooter: { flexDirection: 'row', gap: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border.color },
    cancelBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: colors.background.primary, alignItems: 'center' },
    cancelBtnText: { color: colors.text.secondary, fontFamily: FONTS.bold, fontSize: 16 },
    saveBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: colors.accent.primary, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },

    txnCard: {
        backgroundColor: colors.background.primary,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border.color,
    },
    txnProduct: { color: colors.text.primary, fontFamily: FONTS.semibold, fontSize: 13 },
    txnRemaining: { fontSize: 12, fontFamily: FONTS.medium },
    txnRow: { flexDirection: 'row', marginTop: 4, gap: 4 },
    txnCell: { flex: 1, alignItems: 'center', backgroundColor: colors.background.secondary, borderRadius: 6, padding: 6 },
    txnLabel: { color: colors.text.muted, fontSize: 10, fontFamily: FONTS.regular, marginBottom: 2 },
    txnValue: { color: colors.text.primary, fontSize: 12, fontFamily: FONTS.medium },
});
