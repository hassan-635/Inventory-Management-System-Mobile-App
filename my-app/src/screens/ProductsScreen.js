import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, ScrollView, Modal, Alert, useWindowDimensions, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { productsService } from '../api/products';
import { purchasesService } from '../api/purchases';
import { suppliersService } from '../api/suppliers';
import { useAppTheme } from '../theme/useAppTheme';
import { useToastStore } from '../store/toastStore';
import ExpandableItem from '../components/ExpandableItem';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatProductId } from '../utils/formatProductId';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'Paint', label: 'Paint' },
    { key: 'Electric', label: 'Electric' },
    { key: 'Hardware', label: 'Hardware' },
    { key: 'low', label: '⚠️ Low Stock' },
    { key: 'out', label: '❌ Out of Stock' },
];

/** Same options as web Products.jsx `CustomDropdown` arrange-by */
const SORT_OPTIONS = [
    { key: 'default', label: 'Default' },
    { key: 'nameAsc', label: 'Name (A-Z)' },
    { key: 'priceAsc', label: 'Price (Low to High)' },
    { key: 'stockAsc', label: 'Stock (Low to High)' },
];

const UNIT_OPTIONS = ['Per Piece', 'Per Kilo', 'Per Dozen', 'Per Liter', 'Per Ft', 'Per Meter'];
const CATEGORY_OPTIONS = ['Paint', 'Electric', 'Hardware'];

function productMatchesSearch(product, searchRaw) {
    const q = (searchRaw || '').trim();
    if (!q) return true;
    const qLower = q.toLowerCase();
    if ((product.name || '').toLowerCase().includes(qLower)) return true;
    const idStr = String(product.id ?? '');
    if (idStr.includes(q) || idStr.toLowerCase().includes(qLower)) return true;
    const idUpper = String(product.id ?? '').toUpperCase();
    const qCompact = qLower.replace(/\s/g, '');
    if (idUpper.toLowerCase().includes(qCompact)) return true;
    return false;
}

// A searchable modal picker for Dropdowns
const PickerModal = ({ visible, onClose, items, onSelect, title, allowCustom = false, customValue = '', onCustomChange = null, colors, FONTS }) => {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        return items.filter(i => i.toLowerCase().includes(q.toLowerCase()));
    }, [items, q]);

    const mStyles = useMemo(() => getModalStyles(colors, FONTS), [colors, FONTS]);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={mStyles.overlay}>
                <View style={[mStyles.sheet, { paddingBottom: 30 }]}>
                    <View style={mStyles.header}>
                        <Text style={mStyles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose}><Icon name="close" size={22} color={colors.text.secondary} /></TouchableOpacity>
                    </View>
                    <View style={mStyles.searchRow}>
                        <Icon name="search-outline" size={16} color={colors.text.secondary} style={{ marginRight: 8 }} />
                        <TextInput
                            style={mStyles.searchInput}
                            placeholder={`Search or type ${title.toLowerCase()}...`}
                            placeholderTextColor={colors.text.muted}
                            value={allowCustom ? customValue : q}
                            onChangeText={t => {
                                setQ(t);
                                if (allowCustom && onCustomChange) onCustomChange(t);
                            }}
                            autoFocus={allowCustom}
                        />
                    </View>
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, i) => i.toString()}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={mStyles.item} onPress={() => { onSelect(item); setQ(''); onClose(); }}>
                                <Text style={mStyles.itemName} numberOfLines={1}>{item}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={mStyles.empty}>{allowCustom ? "Press 'done' to use custom typed value" : "No results found"}</Text>}
                        keyboardShouldPersistTaps="handled"
                    />
                    {allowCustom && (
                        <TouchableOpacity style={{ padding: 15, borderRadius: 12, backgroundColor: colors.accent.primary, alignItems: 'center', marginTop: 10 }} onPress={() => { onSelect(customValue); setQ(''); onClose(); }}>
                            <Text style={{ color: '#fff', fontFamily: FONTS.bold, fontSize: 16 }}>Done</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default function ProductsScreen() {
    const { colors, FONTS } = useAppTheme();
    const styles = useMemo(() => getStyles(colors, FONTS), [colors, FONTS]);
    const { width } = useWindowDimensions();
    const isTablet = width > 768;

    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [sortBy, setSortBy] = useState('default');
    const [search, setSearch] = useState('');
    const [lowStockLimit, setLowStockLimit] = useState(10);
    const [showPurchaseRates, setShowPurchaseRates] = useState(false);
    const [showSortPicker, setShowSortPicker] = useState(false);

    // Picker State
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showSupplierPicker, setShowSupplierPicker] = useState(false);

    // CRUD State
    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formItem, setFormItem] = useState({ 
        id: null, name: '', category: 'Hardware', price: '', 
        purchase_rate: '', purchased_from: '', quantity_unit: 'Per Piece', 
        max_discount: '0', total_quantity: '0', purchase_date: new Date().toISOString().split('T')[0], paid_amount: '0',
        supplier_phone: '', supplier_company_name: ''
    });
    const [supplierTxnInfo, setSupplierTxnInfo] = useState(null);
    const [addPaymentAmount, setAddPaymentAmount] = useState('');
    const [showRestockDatePicker, setShowRestockDatePicker] = useState(false);

    const fetchProductsAndSuppliers = async () => {
        try {
            const [prodData, suppData] = await Promise.all([
                productsService.getAll(),
                suppliersService.getAll().catch(() => [])
            ]);
            
            const limitStr = await AsyncStorage.getItem('low_stock_limit');
            if (limitStr && !isNaN(limitStr)) {
                setLowStockLimit(Number(limitStr));
            }

            setProducts(prodData);
            setSuppliers(suppData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchProductsAndSuppliers(); }, []);

    const onRefresh = () => { setRefreshing(true); fetchProductsAndSuppliers(); };

    const supplierOptions = useMemo(() => {
        const supps = suppliers.map(s => s.name).filter(Boolean);
        return [...new Set(supps)];
    }, [suppliers]);

    const sortLabel = useMemo(
        () => SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? 'Default',
        [sortBy]
    );

    const sortModalStyles = useMemo(() => getModalStyles(colors, FONTS), [colors, FONTS]);

    const openModal = async (product = null) => {
        setAddPaymentAmount('');
        setSupplierTxnInfo(null);
        setShowRestockDatePicker(false);
        if (product) {
            setFormItem({
                id: product.id,
                name: product.name || '',
                category: product.category || 'Hardware',
                price: product.price?.toString() || '',
                purchase_rate: product.purchase_rate?.toString() || '',
                purchased_from: product.purchased_from || '',
                quantity_unit: product.quantity_unit || 'Per Piece',
                max_discount: product.max_discount?.toString() || '0',
                total_quantity: product.total_quantity?.toString() || '0',
                remaining_display: String(product.remaining_quantity ?? 0),
                purchase_date: product.purchase_date ? new Date(product.purchase_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                paid_amount: '0',
                supplier_phone: '',
                supplier_company_name: '',
                add_quantity: '',
                restock_paid_amount: '',
                restock_purchase_date: new Date(),
            });

            try {
                const allTxns = await purchasesService.getAll();
                const prodTxns = allTxns.filter(t => t.product_id === product.id);
                if (prodTxns.length > 0) {
                    const totalOwed = prodTxns.reduce((s, t) => s + Number(t.total_amount || 0), 0);
                    const totalPaid = prodTxns.reduce((s, t) => s + Number(t.paid_amount || 0), 0);
                    const latestTxn = prodTxns.sort((a, b) => b.id - a.id)[0];
                    setSupplierTxnInfo({ txn_id: latestTxn.id, total_amount: totalOwed, paid_amount: totalPaid, remaining: totalOwed - totalPaid });
                }
            } catch (_) {}
        } else {
            setFormItem({ 
                id: null, name: '', category: 'Hardware', price: '', 
                purchase_rate: '', purchased_from: '', quantity_unit: 'Per Piece', 
                max_discount: '0', total_quantity: '0', remaining_display: '',
                purchase_date: new Date().toISOString().split('T')[0], paid_amount: '0',
                supplier_phone: '', supplier_company_name: '',
                add_quantity: '', restock_paid_amount: '', restock_purchase_date: new Date(),
            });
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formItem.name || !formItem.price) {
            useToastStore.getState().showToast("Error", "Name and Sale Price are required.", "error");
            return;
        }
        setIsSaving(true);
        try {
            if (formItem.id) {
                const addQ = Number(formItem.add_quantity);
                const hasRestock = formItem.add_quantity != null && String(formItem.add_quantity).trim() !== '' && Number.isFinite(addQ) && addQ > 0;
                if (hasRestock) {
                    if (!formItem.purchased_from?.trim()) {
                        useToastStore.getState().showToast('Error', 'Supplier is required when adding stock.', 'error');
                        setIsSaving(false);
                        return;
                    }
                    const rate = Number(formItem.purchase_rate || 0);
                    const batchTotal = rate * addQ;
                    const paidRestock = Number(formItem.restock_paid_amount || 0);
                    if (paidRestock < 0 || paidRestock > batchTotal) {
                        useToastStore.getState().showToast('Error', `Payment cannot exceed this batch total (Rs. ${batchTotal.toLocaleString()}).`, 'error');
                        setIsSaving(false);
                        return;
                    }
                }

                const payload = {
                    name: formItem.name.trim(),
                    category: formItem.category,
                    price: Number(formItem.price),
                    purchase_rate: Number(formItem.purchase_rate || 0),
                    max_discount: Number(formItem.max_discount || 0),
                    purchased_from: formItem.purchased_from?.trim() || '',
                    purchase_date: formItem.purchase_date || new Date().toISOString().split('T')[0],
                    quantity_unit: formItem.quantity_unit || 'Per Piece',
                    supplier_phone: formItem.supplier_phone,
                    supplier_company_name: formItem.supplier_company_name,
                };
                if (hasRestock) {
                    payload.add_quantity = addQ;
                    payload.restock_paid_amount = Number(formItem.restock_paid_amount || 0);
                    payload.restock_purchase_date = formItem.restock_purchase_date instanceof Date
                        ? formItem.restock_purchase_date.toISOString().split('T')[0]
                        : String(formItem.restock_purchase_date || '').split('T')[0] || new Date().toISOString().split('T')[0];
                }

                await productsService.update(formItem.id, payload);
                if (addPaymentAmount && Number(addPaymentAmount) > 0 && supplierTxnInfo?.txn_id) {
                    const payAmt = Number(addPaymentAmount);
                    if (payAmt > supplierTxnInfo.remaining) {
                        useToastStore.getState().showToast('Error', `Payment cannot exceed remaining amount: Rs. ${supplierTxnInfo.remaining}`, 'error');
                        setIsSaving(false);
                        return;
                    }
                    await purchasesService.updatePayment(supplierTxnInfo.txn_id, payAmt);
                }
            } else {
                const payload = {
                    name: formItem.name.trim(),
                    category: formItem.category,
                    price: Number(formItem.price),
                    purchase_rate: Number(formItem.purchase_rate),
                    max_discount: Number(formItem.max_discount),
                    purchased_from: formItem.purchased_from,
                    total_quantity: Number(formItem.total_quantity),
                    purchase_date: formItem.purchase_date || new Date().toISOString().split('T')[0],
                    paid_amount: Number(formItem.paid_amount || 0),
                    quantity_unit: formItem.quantity_unit,
                    supplier_phone: formItem.supplier_phone,
                    supplier_company_name: formItem.supplier_company_name,
                };
                await productsService.create(payload);
            }
            setModalVisible(false);
            useToastStore.getState().showToast('Saved', formItem.id ? 'Product updated successfully.' : 'Product saved successfully.', 'success');
            fetchProductsAndSuppliers();
        } catch (error) {
            console.error("Save product error", error);
            useToastStore.getState().showToast("Error", error.response?.data?.error || "Could not save product.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = (id) => {
        Alert.alert("Delete Product", "Are you sure you want to delete this product?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await productsService.delete(id);
                        useToastStore.getState().showToast('Deleted', 'Product deleted successfully!', 'success');
                        fetchProductsAndSuppliers();
                    } catch (err) {
                        useToastStore.getState().showToast("Error", err.response?.data?.error || "Could not delete product", "error");
                    }
                }
            }
        ]);
    };

    const filteredProducts = useMemo(() => {
        const list = products.filter((p) => {
            if (!productMatchesSearch(p, search)) return false;

            const remaining = Number(p.remaining_quantity || 0);

            if (activeFilter === 'low') {
                return remaining > 0 && remaining <= lowStockLimit;
            }
            if (activeFilter === 'out') {
                return remaining === 0;
            }
            if (activeFilter !== 'all') {
                return p.category === activeFilter || p.name?.toLowerCase().includes(activeFilter.toLowerCase());
            }
            return true;
        });

        return [...list].sort((a, b) => {
            if (sortBy === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'priceAsc') return Number(a.price || 0) - Number(b.price || 0);
            if (sortBy === 'stockAsc') return Number(a.remaining_quantity || 0) - Number(b.remaining_quantity || 0);
            return 0;
        });
    }, [products, search, activeFilter, lowStockLimit, sortBy]);

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 }}>
                <Text style={styles.headerTitle}>Products Inventory</Text>
                <TouchableOpacity onPress={() => setShowPurchaseRates(!showPurchaseRates)} style={{ padding: 8, backgroundColor: colors.background.secondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border.color }}>
                    <Icon name={showPurchaseRates ? "eye-off-outline" : "eye-outline"} size={20} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>

            {/* Search (70%) + Arrange by (30%) — one row */}
            <View style={styles.searchSortRow}>
                <View style={styles.searchRow}>
                    <Icon name="search-outline" size={18} color={colors.text.secondary} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search name or ID…"
                        placeholderTextColor={colors.text.muted || colors.text.secondary}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <TouchableOpacity
                    style={styles.sortDropdown}
                    onPress={() => setShowSortPicker(true)}
                    activeOpacity={0.85}
                    accessibilityLabel={`Arrange by: ${sortLabel}`}
                >
                    <Text style={styles.sortDropdownText} numberOfLines={1} ellipsizeMode="tail">
                        {sortLabel}
                    </Text>
                    <Icon name="chevron-down" size={18} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>

            <Modal visible={showSortPicker} animationType="slide" transparent>
                <View style={sortModalStyles.overlay}>
                    <View style={[sortModalStyles.sheet, { paddingBottom: 24 }]}>
                        <View style={sortModalStyles.header}>
                            <Text style={sortModalStyles.title}>Arrange by</Text>
                            <TouchableOpacity onPress={() => setShowSortPicker(false)} accessibilityRole="button">
                                <Icon name="close" size={22} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={SORT_OPTIONS}
                            keyExtractor={(item) => item.key}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => {
                                const selected = sortBy === item.key;
                                return (
                                    <TouchableOpacity
                                        style={[
                                            sortModalStyles.item,
                                            styles.sortPickerItemRow,
                                            selected && { backgroundColor: colors.background.primary },
                                        ]}
                                        onPress={() => {
                                            setSortBy(item.key);
                                            setShowSortPicker(false);
                                        }}
                                    >
                                        <Text style={sortModalStyles.itemName} numberOfLines={2}>
                                            {item.label}
                                        </Text>
                                        {selected ? (
                                            <Icon name="checkmark-circle" size={22} color={colors.accent.primary} />
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Filter Tabs */}
            <View style={styles.filterWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {FILTERS.map(f => {
                        const isLow = f.key === 'low';
                        const isOut = f.key === 'out';
                        const isActive = activeFilter === f.key;
                        
                        let customBorder = {};
                        let customText = {};
                        
                        if (!isActive && isLow) {
                            customBorder = { borderColor: '#eab308' };
                            customText = { color: '#eab308' };
                        } else if (!isActive && isOut) {
                            customBorder = { borderColor: '#ef4444' };
                            customText = { color: '#ef4444' };
                        } else if (isActive && isLow) {
                            customBorder = { borderColor: '#eab308', backgroundColor: '#eab308' };
                            customText = { color: '#fff' };
                        } else if (isActive && isOut) {
                            customBorder = { borderColor: '#ef4444', backgroundColor: '#ef4444' };
                            customText = { color: '#fff' };
                        }

                        return (
                            <TouchableOpacity
                                key={f.key}
                                style={[styles.filterBtn, isActive && styles.filterBtnActive, customBorder]}
                                onPress={() => setActiveFilter(f.key)}
                            >
                                <Text style={[styles.filterBtnText, isActive && styles.filterBtnTextActive, customText]}>{f.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item, index) => (item.id || index).toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
                contentContainerStyle={[styles.listContainer, isTablet && { paddingHorizontal: 32 }]}
                renderItem={({ item }) => {
                    const remaining = Number(item.remaining_quantity || 0);
                    const isLow = remaining > 0 && remaining <= lowStockLimit;
                    const isZero = remaining === 0;
                    
                    let containerStyle = {};
                    if (isZero) {
                        containerStyle = {
                            borderColor: colors.border.color,
                            borderLeftWidth: 4,
                            borderLeftColor: colors.status.danger,
                        };
                    } else if (isLow) {
                        containerStyle = {
                            borderColor: colors.border.color,
                            borderLeftWidth: 4,
                            borderLeftColor: colors.status.warning,
                        };
                    }

                    const stockBorder =
                        isZero ? colors.status.danger : isLow ? colors.status.warning : colors.border.color;
                    const stockColor =
                        isZero ? colors.status.danger : isLow ? colors.status.warning : colors.status.success;

                    const stockSummaryLabel = isZero ? 'Status' : 'In Stock';
                    const stockSummaryValue = isZero ? 'Out of stock' : String(remaining);

                    return (
                        <ExpandableItem
                            title={item.name}
                            subtitle={item.category || item.purchased_from || null}
                            rightText={`Rs. ${item.price}`}
                            rightSubText={
                                isZero ? 'Out of stock' : isLow ? `Low stock · ${remaining} left` : `Stock: ${remaining}`
                            }
                            summaryBoxes={[
                                { label: 'Sale Price', value: `Rs. ${item.price}` },
                                {
                                    label: stockSummaryLabel,
                                    value: stockSummaryValue,
                                    valueColor: stockColor,
                                    borderColor: stockBorder,
                                },
                                { label: 'Category', value: item.category || '—' },
                            ]}
                            iconName="cube-outline"
                            containerStyle={containerStyle}
                            detailsData={{
                                'Product ID': formatProductId(item.id),
                                'Supplier': item.purchased_from || 'N/A',
                                'Purchase Price': showPurchaseRates ? `Rs. ${item.purchase_rate || '-'}` : '***',
                                'Unit': item.quantity_unit || 'Per Piece',
                                'Max Discount': `Rs. ${item.max_discount || 0}`,
                                'Total Qty': String(item.total_quantity),
                                'Remaining Qty': `${remaining}${isZero ? ' (Out of Stock)' : isLow ? ' (Low)' : ''}`,
                                'Purchase Date': item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-',
                                'Added': new Date(item.created_at).toLocaleDateString()
                            }}
                            renderActions={() => (
                                <>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => openModal(item)}>
                                        <Icon name="refresh-outline" size={18} color={colors.text.primary} />
                                        <Text style={styles.actionBtnTxt}>Update</Text>
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
                ListEmptyComponent={<Text style={styles.emptyText}>No products found.</Text>}
            />

            {/* Floating Action Button */}
            <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
                <Icon name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Add / Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isTablet && { width: '70%', alignSelf: 'center' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{formItem.id ? 'Update Product' : 'Add Product'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Product Name *</Text>
                            <TextInput style={styles.input} value={formItem.name} onChangeText={t => setFormItem({...formItem, name: t})} placeholder="Enter product name" placeholderTextColor={colors.text.muted} />

                            {!formItem.id ? (
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.inputLabel}>Sale Price *</Text>
                                    <TextInput style={styles.input} value={formItem.price} onChangeText={t => setFormItem({...formItem, price: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.inputLabel}>Purchase Price</Text>
                                    <TextInput style={styles.input} value={formItem.purchase_rate} onChangeText={t => setFormItem({...formItem, purchase_rate: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                </View>
                            </View>
                            ) : null}

                            {!formItem.id ? (
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.inputLabel}>Total Qty (Stock)</Text>
                                    <TextInput style={styles.input} value={formItem.total_quantity} onChangeText={t => setFormItem({...formItem, total_quantity: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.inputLabel}>Unit</Text>
                                    <TouchableOpacity style={styles.input} onPress={() => setShowUnitPicker(true)}>
                                        <Text style={[{color: colors.text.primary, fontFamily: FONTS.regular, flex: 1}, !formItem.quantity_unit && {color: colors.text.muted}]} numberOfLines={1}>
                                            {formItem.quantity_unit || 'Select Unit...'}
                                        </Text>
                                        <Icon name="chevron-down" size={18} color={colors.text.secondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            ) : (
                            <>
                                <View style={styles.row}>
                                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                        <Text style={styles.inputLabel}>Total qty</Text>
                                        <View style={[styles.input, { justifyContent: 'center' }]}>
                                            <Text style={{ color: colors.text.secondary, fontFamily: FONTS.medium }}>{formItem.total_quantity}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                        <Text style={styles.inputLabel}>Remaining</Text>
                                        <View style={[styles.input, { justifyContent: 'center' }]}>
                                            <Text style={{ color: colors.text.secondary, fontFamily: FONTS.medium }}>{formItem.remaining_display}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.row}>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={styles.inputLabel}>Unit</Text>
                                        <TouchableOpacity style={styles.input} onPress={() => setShowUnitPicker(true)}>
                                            <Text style={[{color: colors.text.primary, fontFamily: FONTS.regular, flex: 1}, !formItem.quantity_unit && {color: colors.text.muted}]} numberOfLines={1}>
                                                {formItem.quantity_unit || 'Select Unit...'}
                                            </Text>
                                            <Icon name="chevron-down" size={18} color={colors.text.secondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={{ backgroundColor: colors.background.primary, borderWidth: 1, borderColor: colors.border.color, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                                    <Text style={[styles.inputLabel, { marginBottom: 10 }]}>Restock</Text>
                                    <View style={styles.row}>
                                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                            <Text style={styles.inputLabel}>Sale price *</Text>
                                            <TextInput style={styles.input} value={formItem.price} onChangeText={t => setFormItem({...formItem, price: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                        </View>
                                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                            <Text style={styles.inputLabel}>Purchase rate</Text>
                                            <TextInput style={styles.input} value={formItem.purchase_rate} onChangeText={t => setFormItem({...formItem, purchase_rate: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                        </View>
                                    </View>
                                    <Text style={styles.inputLabel}>Add qty</Text>
                                    <TextInput style={styles.input} value={formItem.add_quantity} onChangeText={t => setFormItem({...formItem, add_quantity: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                    {(() => {
                                        const aq = Number(formItem.add_quantity || 0);
                                        const rate = Number(formItem.purchase_rate || 0);
                                        if (!(aq > 0)) return null;
                                        const supplierDue = rate * aq;
                                        const paidRaw = Number(formItem.restock_paid_amount || 0);
                                        const paid = Math.min(Math.max(0, paidRaw), supplierDue);
                                        const balance = Math.max(0, supplierDue - paid);
                                        return (
                                            <View style={{ marginBottom: 12, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.background.secondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border.color }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text style={{ color: colors.text.secondary, fontSize: 13, fontFamily: FONTS.medium }}>Supplier due</Text>
                                                    <Text style={{ fontFamily: FONTS.bold, fontSize: 17, color: colors.text.primary }}>Rs. {supplierDue.toLocaleString()}</Text>
                                                </View>
                                                {rate > 0 ? (
                                                    <Text style={{ color: colors.text.muted, fontSize: 12, marginTop: 6 }}>{aq} × Rs. {rate} purchase rate</Text>
                                                ) : (
                                                    <Text style={{ color: colors.status.warning, fontSize: 12, marginTop: 6 }}>Enter purchase rate</Text>
                                                )}
                                                {supplierDue > 0 && paidRaw > 0 ? (
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                                                        <Text style={{ color: colors.text.muted, fontSize: 12 }}>Balance</Text>
                                                        <Text style={{ fontSize: 13, fontFamily: FONTS.bold, color: balance > 0 ? colors.status.danger : colors.status.success }}>
                                                            Rs. {balance.toLocaleString()}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        );
                                    })()}
                                    <Text style={styles.inputLabel}>Paid (Rs)</Text>
                                    <TextInput style={styles.input} value={formItem.restock_paid_amount} onChangeText={t => setFormItem({...formItem, restock_paid_amount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                    <Text style={styles.inputLabel}>Batch date</Text>
                                    <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowRestockDatePicker(true)}>
                                        <Text style={{ color: colors.text.primary, fontFamily: FONTS.regular }}>
                                            {(formItem.restock_purchase_date instanceof Date ? formItem.restock_purchase_date : new Date()).toLocaleDateString()}
                                        </Text>
                                        <Icon name="calendar-outline" size={18} color={colors.text.secondary} />
                                    </TouchableOpacity>
                                    {showRestockDatePicker ? (
                                        <DateTimePicker
                                            value={formItem.restock_purchase_date instanceof Date ? formItem.restock_purchase_date : new Date()}
                                            mode="date"
                                            display="default"
                                            onChange={(e, d) => {
                                                setShowRestockDatePicker(Platform.OS === 'ios');
                                                if (d) setFormItem({ ...formItem, restock_purchase_date: d });
                                            }}
                                        />
                                    ) : null}
                                </View>
                            </>
                            )}

                            {/* Auto-calculated total to pay supplier - only for new products */}
                            {!formItem.id && (() => {
                                const rate = Number(formItem.purchase_rate);
                                const qty = Number(formItem.total_quantity);
                                if (rate > 0 && qty > 0) {
                                    const total = rate * qty;
                                    return (
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 }}>
                                            <Text style={{ color: colors.text.secondary, fontSize: 13 }}>💳 Total to Pay Supplier</Text>
                                            <Text style={{ color: '#38bdf8', fontFamily: FONTS.bold, fontSize: 15 }}>Rs. {total.toLocaleString()}</Text>
                                        </View>
                                    );
                                }
                                return null;
                            })()}

                            <Text style={styles.inputLabel}>Category</Text>
                            <TouchableOpacity style={styles.input} onPress={() => setShowCategoryPicker(true)}>
                                <Text style={[{color: colors.text.primary, fontFamily: FONTS.regular, flex: 1}, !formItem.category && {color: colors.text.muted}]} numberOfLines={1}>
                                    {formItem.category || 'Select Category...'}
                                </Text>
                                <Icon name="chevron-down" size={18} color={colors.text.secondary} />
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Supplier (Purchased From)</Text>
                            <TouchableOpacity style={styles.input} onPress={() => setShowSupplierPicker(true)}>
                                <Text style={[{color: colors.text.primary, fontFamily: FONTS.regular, flex: 1}, !formItem.purchased_from && {color: colors.text.muted}]} numberOfLines={1}>
                                    {formItem.purchased_from || 'Select or type supplier...'}
                                </Text>
                                <Icon name="chevron-down" size={18} color={colors.text.secondary} />
                            </TouchableOpacity>

                            {/* Show auto-create supplier fields if it's a new supplier */}
                            {formItem.purchased_from && !supplierOptions.includes(formItem.purchased_from) && (
                                <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.05)', padding: 12, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                                    <Text style={[styles.inputLabel, { color: colors.accent.primary }]}>Auto-Create New Supplier</Text>
                                    
                                    <Text style={styles.inputLabel}>Phone Number</Text>
                                    <TextInput style={styles.input} value={formItem.supplier_phone} onChangeText={t => setFormItem({...formItem, supplier_phone: t})} keyboardType="phone-pad" placeholder="Enter supplier's phone" placeholderTextColor={colors.text.muted} />
                                    
                                    <Text style={styles.inputLabel}>Company Name (Optional)</Text>
                                    <TextInput style={[styles.input, { marginBottom: 0 }]} value={formItem.supplier_company_name} onChangeText={t => setFormItem({...formItem, supplier_company_name: t})} placeholder="Enter company name" placeholderTextColor={colors.text.muted} />
                                </View>
                            )}

                            <Text style={styles.inputLabel}>Max Discount (Rs)</Text>
                            <TextInput style={styles.input} value={formItem.max_discount} onChangeText={t => setFormItem({...formItem, max_discount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                            
                            {/* Show Paid Amount only for NEW products */}
                            {!formItem.id && (
                                <>
                                    <Text style={styles.inputLabel}>Paid Amount (Rs) <Text style={{color: colors.text.muted, fontSize: 12}}>(0 = credit only)</Text></Text>
                                    <TextInput style={styles.input} value={formItem.paid_amount} onChangeText={t => setFormItem({...formItem, paid_amount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
                                </>
                            )}

                            {/* Supplier Payment Ledger — Edit mode only */}
                            {!!formItem.id && supplierTxnInfo && (
                                <>
                                    <View style={{ height: 1, backgroundColor: colors.background.tertiary, marginVertical: 16 }} />
                                    <Text style={[styles.inputLabel, { fontSize: 14, color: colors.text.primary, fontFamily: FONTS.bold }]}>💰 Supplier Payment Ledger</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>Total Owed (Rs)</Text>
                                            <View style={[styles.input, { backgroundColor: colors.background.secondary }]}>
                                                <Text style={{ color: colors.text.muted }}>Rs. {supplierTxnInfo.total_amount.toLocaleString()}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>Total Paid (Rs)</Text>
                                            <View style={[styles.input, { backgroundColor: colors.background.secondary }]}>
                                                <Text style={{ color: colors.status.success }}>Rs. {supplierTxnInfo.paid_amount.toLocaleString()}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={styles.inputLabel}>Remaining owed (Rs)</Text>
                                    <View style={[styles.input, { backgroundColor: colors.background.secondary }]}>
                                        <Text style={{ color: supplierTxnInfo.remaining > 0 ? colors.status.danger : colors.status.success, fontFamily: FONTS.bold }}>Rs. {supplierTxnInfo.remaining.toLocaleString()}</Text>
                                    </View>
                                    <Text style={styles.inputLabel}>Add New Payment (Rs) <Text style={{color: colors.text.muted, fontSize: 12}}>(max: {supplierTxnInfo.remaining})</Text></Text>
                                    <TextInput style={styles.input} value={addPaymentAmount} onChangeText={setAddPaymentAmount} keyboardType="numeric" placeholder="Amount to pay now..." placeholderTextColor={colors.text.muted} />
                                </>
                            )}

                            <View style={{ height: 20 }} />
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={isSaving}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{formItem.id ? 'Update' : 'Save'}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Dropdown Pickers */}
            <PickerModal
                visible={showUnitPicker}
                onClose={() => setShowUnitPicker(false)}
                items={UNIT_OPTIONS}
                onSelect={(val) => setFormItem({...formItem, quantity_unit: val})}
                title="Select Unit"
                colors={colors}
                FONTS={FONTS}
            />
            <PickerModal
                visible={showCategoryPicker}
                onClose={() => setShowCategoryPicker(false)}
                items={CATEGORY_OPTIONS}
                onSelect={(val) => setFormItem({...formItem, category: val})}
                title="Select Category"
                colors={colors}
                FONTS={FONTS}
            />
            <PickerModal
                visible={showSupplierPicker}
                onClose={() => setShowSupplierPicker(false)}
                items={supplierOptions}
                onSelect={(val) => setFormItem({...formItem, purchased_from: val})}
                title="Select Supplier"
                allowCustom={true}
                customValue={formItem.purchased_from}
                onCustomChange={(val) => setFormItem({...formItem, purchased_from: val})}
                colors={colors}
                FONTS={FONTS}
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
    searchSortRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        marginHorizontal: 16,
        marginBottom: 10,
        gap: 8,
    },
    searchRow: {
        flex: 7,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.border.color,
    },
    searchInput: { flex: 1, minWidth: 0, color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 14 },
    sortDropdown: {
        flex: 3,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background.secondary,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.border.color,
    },
    sortDropdownText: {
        flex: 1,
        minWidth: 0,
        marginRight: 6,
        color: colors.text.primary,
        fontFamily: FONTS.medium,
        fontSize: 12,
    },
    sortPickerItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    filterWrapper: { height: 45, marginBottom: 8 },
    filterRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
    filterBtn: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: colors.border.color,
        backgroundColor: colors.background.secondary,
    },
    filterBtnActive: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    filterBtnText: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    filterBtnTextActive: { color: '#fff', fontFamily: FONTS.bold },
    listContainer: { padding: 16, paddingBottom: 100 },
    emptyText: { color: colors.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },
    
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background.tertiary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 6 },
    actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    actionBtnTxt: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 13 },
    
    fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { backgroundColor: colors.background.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, color: colors.text.primary, fontFamily: FONTS.bold },
    modalBody: { marginBottom: 20 },
    row: { flexDirection: 'row' },
    inputGroup: { flex: 1 },
    inputLabel: { color: colors.text.secondary, fontSize: 13, marginBottom: 6, fontFamily: FONTS.medium },
    input: { backgroundColor: colors.background.primary, color: colors.text.primary, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border.color, fontFamily: FONTS.regular, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    
    modalFooter: { flexDirection: 'row', gap: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border.color },
    cancelBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: colors.background.primary, alignItems: 'center' },
    cancelBtnText: { color: colors.text.secondary, fontFamily: FONTS.bold, fontSize: 16 },
    saveBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: colors.accent.primary, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
});

const getModalStyles = (colors, FONTS) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: colors.background.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '80%', padding: 16,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 18 },
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background.primary, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 8,
        marginBottom: 12, borderWidth: 1, borderColor: colors.border.color,
    },
    searchInput: { flex: 1, color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 14 },
    item: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border.color },
    itemName: { color: colors.text.primary, fontFamily: FONTS.semibold, fontSize: 15 },
    empty: { color: colors.text.secondary, textAlign: 'center', padding: 24, fontFamily: FONTS.regular },
});
