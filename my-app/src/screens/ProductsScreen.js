import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, ScrollView, Modal, Alert } from 'react-native';
import { productsService } from '../api/products';
import { suppliersService } from '../api/suppliers';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';
import Icon from 'react-native-vector-icons/Ionicons';
import { useMemo } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'Paint', label: 'Paint' },
    { key: 'Hardware', label: 'Hardware' },
    { key: 'Electricity', label: 'Electricity' },
    { key: 'low', label: '⚠️ Low Stock' },
];

const UNIT_OPTIONS = ['Per Unit', 'Per Kilo', 'Per Dozen', 'Per Liter', 'Per Ft', 'Per Meter'];
const CATEGORY_OPTIONS = ['Paint', 'Hardware', 'Electricity', 'Plumbing', 'Tools', 'Uncategorized'];

// A searchable modal picker for Dropdowns
const PickerModal = ({ visible, onClose, items, onSelect, title, allowCustom = false, customValue = '', onCustomChange = null }) => {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        return items.filter(i => i.toLowerCase().includes(q.toLowerCase()));
    }, [items, q]);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.sheet}>
                    <View style={modalStyles.header}>
                        <Text style={modalStyles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose}><Icon name="close" size={22} color={COLORS.text.secondary} /></TouchableOpacity>
                    </View>
                    <View style={modalStyles.searchRow}>
                        <Icon name="search-outline" size={16} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
                        <TextInput
                            style={modalStyles.searchInput}
                            placeholder={`Search or type ${title.toLowerCase()}...`}
                            placeholderTextColor={COLORS.text.muted}
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
                            <TouchableOpacity style={modalStyles.item} onPress={() => { onSelect(item); setQ(''); onClose(); }}>
                                <Text style={modalStyles.itemName} numberOfLines={1}>{item}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={modalStyles.empty}>{allowCustom ? "Press 'done' to use custom typed value" : "No results found"}</Text>}
                        keyboardShouldPersistTaps="handled"
                    />
                    {allowCustom && (
                        <TouchableOpacity style={styles.saveBtn} onPress={() => { onSelect(customValue); setQ(''); onClose(); }}>
                            <Text style={styles.saveBtnText}>Done</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default function ProductsScreen() {
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [lowStockLimit, setLowStockLimit] = useState(10); // Default to 10

    // Picker State
    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showSupplierPicker, setShowSupplierPicker] = useState(false);

    // CRUD State
    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formItem, setFormItem] = useState({ 
        id: null, name: '', category: 'Hardware', price: '', 
        purchase_rate: '', purchased_from: '', quantity_unit: 'Per Unit', 
        max_discount: '0', total_quantity: '0' 
    });

    const fetchProductsAndSuppliers = async () => {
        try {
            const [prodData, suppData] = await Promise.all([
                productsService.getAll(),
                suppliersService.getAll().catch(() => []) // fail gracefully
            ]);
            
            // Read custom threshold
            const limitStr = await AsyncStorage.getItem('low_stock_limit');
            if (limitStr && !isNaN(limitStr)) {
                setLowStockLimit(Number(limitStr));
            }

            const sorted = [...prodData].sort((a, b) => Number(b.remaining_quantity || 0) - Number(a.remaining_quantity || 0));
            setProducts(sorted);
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

    // CRUD Functions
    const openModal = (product = null) => {
        if (product) {
            setFormItem({
                id: product.id,
                name: product.name || '',
                category: product.category || 'Hardware',
                price: product.price?.toString() || '',
                purchase_rate: product.purchase_rate?.toString() || '',
                purchased_from: product.purchased_from || '',
                quantity_unit: product.quantity_unit || 'Per Unit',
                max_discount: product.max_discount?.toString() || '0',
                total_quantity: product.total_quantity?.toString() || '0'
            });
        } else {
            setFormItem({ 
                id: null, name: '', category: 'Hardware', price: '', 
                purchase_rate: '', purchased_from: '', quantity_unit: 'Per Unit', 
                max_discount: '0', total_quantity: '0' 
            });
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formItem.name || !formItem.price) {
            Alert.alert("Error", "Name and Sale Price are required.");
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                ...formItem,
                price: Number(formItem.price),
                purchase_rate: Number(formItem.purchase_rate),
                max_discount: Number(formItem.max_discount),
                total_quantity: Number(formItem.total_quantity)
            };

            if (formItem.id) {
                await productsService.update(formItem.id, payload);
            } else {
                await productsService.create(payload);
            }
            setModalVisible(false);
            fetchProductsAndSuppliers();
        } catch (error) {
            console.error("Save product error", error);
            Alert.alert("Error", error.response?.data?.error || "Could not save product.");
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
                        fetchProductsAndSuppliers();
                    } catch (err) {
                        Alert.alert("Error", err.response?.data?.error || "Could not delete product");
                    }
                }
            }
        ]);
    };

    const filteredProducts = products.filter(p => {
        // Search filter
        if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
        
        // Category filter
        if (activeFilter === 'low') {
            return Number(p.remaining_quantity || 0) <= lowStockLimit;
        } else if (activeFilter !== 'all') {
            // Check if the product name contains the category name (as a simple way to categorize if real categories aren't in DB)
            // Or if backend has a category field, we use p.category === activeFilter
            return p.category === activeFilter || p.name?.toLowerCase().includes(activeFilter.toLowerCase());
        }
        return true;
    });

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Products Inventory</Text>

            {/* Search */}
            <View style={styles.searchRow}>
                <Icon name="search-outline" size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
                    placeholderTextColor={COLORS.text.muted || COLORS.text.secondary}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterBtn, activeFilter === f.key && styles.filterBtnActive, f.key === 'low' && activeFilter !== 'low' && { borderColor: '#eab308' }]}
                            onPress={() => setActiveFilter(f.key)}
                        >
                            <Text style={[styles.filterBtnText, activeFilter === f.key && styles.filterBtnTextActive, f.key === 'low' && activeFilter !== 'low' && { color: '#eab308' }]}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item, index) => (item.id || index).toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                    const remaining = Number(item.remaining_quantity || 0);
                    const isLow = remaining > 0 && remaining <= lowStockLimit;
                    const isZero = remaining === 0;
                    
                    let containerStyle = {};
                    if (isZero) {
                        containerStyle = { borderColor: 'rgba(239, 68, 68, 0.5)', backgroundColor: 'rgba(239, 68, 68, 0.05)' };
                    } else if (isLow) {
                        containerStyle = { borderColor: 'rgba(234, 179, 8, 0.3)' };
                    }

                    return (
                        <ExpandableItem
                            title={item.name}
                            subtitle={null}
                            rightText={`Rs. ${item.price}`}
                            iconName="cube-outline"
                            containerStyle={containerStyle}
                            detailsData={{
                                'Product ID': item.id,
                                'Category': item.category || 'N/A',
                                'Supplier': item.purchased_from || 'N/A',
                                'Sale Price': `Rs. ${item.price}`,
                                'Purchase Price': `Rs. ${item.purchase_rate || '-'}`,
                                'Unit': item.quantity_unit || 'Per Unit',
                                'Max Discount': `Rs. ${item.max_discount || 0}`,
                                'Total Qty': item.total_quantity,
                                'Remaining Qty': `${remaining}${isZero ? ' ❌ (Out of Stock)' : isLow ? ' ⚠️' : ''}`,
                                'Purchase Date': item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-',
                                'Added': new Date(item.created_at).toLocaleDateString()
                            }}
                            renderActions={() => (
                                <>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => openModal(item)}>
                                        <Icon name="create-outline" size={18} color={COLORS.text.primary} />
                                        <Text style={styles.actionBtnTxt}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => confirmDelete(item.id)}>
                                        <Icon name="trash-outline" size={18} color={COLORS.danger || '#ef4444'} />
                                        <Text style={[styles.actionBtnTxt, { color: COLORS.danger || '#ef4444' }]}>Delete</Text>
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
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{formItem.id ? 'Edit Product' : 'Add Product'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={COLORS.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Product Name *</Text>
                            <TextInput style={styles.input} value={formItem.name} onChangeText={t => setFormItem({...formItem, name: t})} placeholder="Enter product name" placeholderTextColor={COLORS.text.muted} />

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.inputLabel}>Sale Price *</Text>
                                    <TextInput style={styles.input} value={formItem.price} onChangeText={t => setFormItem({...formItem, price: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text.muted} />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.inputLabel}>Purchase Price</Text>
                                    <TextInput style={styles.input} value={formItem.purchase_rate} onChangeText={t => setFormItem({...formItem, purchase_rate: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text.muted} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.inputLabel}>Total Qty (Stock)</Text>
                                    <TextInput style={styles.input} value={formItem.total_quantity} onChangeText={t => setFormItem({...formItem, total_quantity: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text.muted} editable={!formItem.id} />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.inputLabel}>Unit</Text>
                                    <TouchableOpacity style={styles.input} onPress={() => setShowUnitPicker(true)}>
                                        <Text style={[{color: COLORS.text.primary, fontFamily: FONTS.regular, flex: 1}, !formItem.quantity_unit && {color: COLORS.text.muted}]} numberOfLines={1}>
                                            {formItem.quantity_unit || 'Select Unit...'}
                                        </Text>
                                        <Icon name="chevron-down" size={18} color={COLORS.text.secondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Category</Text>
                            <TouchableOpacity style={styles.input} onPress={() => setShowCategoryPicker(true)}>
                                <Text style={[{color: COLORS.text.primary, fontFamily: FONTS.regular, flex: 1}, !formItem.category && {color: COLORS.text.muted}]} numberOfLines={1}>
                                    {formItem.category || 'Select Category...'}
                                </Text>
                                <Icon name="chevron-down" size={18} color={COLORS.text.secondary} />
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Supplier (Purchased From)</Text>
                            <TouchableOpacity style={styles.input} onPress={() => setShowSupplierPicker(true)}>
                                <Text style={[{color: COLORS.text.primary, fontFamily: FONTS.regular, flex: 1}, !formItem.purchased_from && {color: COLORS.text.muted}]} numberOfLines={1}>
                                    {formItem.purchased_from || 'Select or type supplier...'}
                                </Text>
                                <Icon name="chevron-down" size={18} color={COLORS.text.secondary} />
                            </TouchableOpacity>

                            <Text style={styles.inputLabel}>Max Discount (Rs)</Text>
                            <TextInput style={styles.input} value={formItem.max_discount} onChangeText={t => setFormItem({...formItem, max_discount: t})} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text.muted} />
                            
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

            {/* Dropdown Pickers */}
            <PickerModal
                visible={showUnitPicker}
                onClose={() => setShowUnitPicker(false)}
                items={UNIT_OPTIONS}
                onSelect={(val) => setFormItem({...formItem, quantity_unit: val})}
                title="Select Unit"
            />
            <PickerModal
                visible={showCategoryPicker}
                onClose={() => setShowCategoryPicker(false)}
                items={CATEGORY_OPTIONS}
                onSelect={(val) => setFormItem({...formItem, category: val})}
                title="Select Category"
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
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginBottom: 10,
        backgroundColor: COLORS.background.secondary,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    searchInput: { flex: 1, color: COLORS.text.primary, fontFamily: FONTS.regular, fontSize: 14 },
    filterWrapper: { height: 45, marginBottom: 8 },
    filterRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
    filterBtn: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: COLORS.border.color,
        backgroundColor: COLORS.background.secondary,
    },
    filterBtnActive: { backgroundColor: COLORS.accent.primary, borderColor: COLORS.accent.primary },
    filterBtnText: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    filterBtnTextActive: { color: '#fff', fontFamily: FONTS.bold },
    listContainer: { padding: 16, paddingBottom: 100 },
    emptyText: { color: COLORS.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },
    
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background.tertiary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 6 },
    actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    actionBtnTxt: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 13 },
    
    fab: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.accent.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { backgroundColor: COLORS.background.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, color: COLORS.text.primary, fontFamily: FONTS.bold },
    modalBody: { marginBottom: 20 },
    row: { flexDirection: 'row' },
    inputGroup: { flex: 1 },
    inputLabel: { color: COLORS.text.secondary, fontSize: 13, marginBottom: 6, fontFamily: FONTS.medium },
    input: { backgroundColor: COLORS.background.primary, color: COLORS.text.primary, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border.color, fontFamily: FONTS.regular, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    
    modalFooter: { flexDirection: 'row', gap: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border.color },
    cancelBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.background.primary, alignItems: 'center' },
    cancelBtnText: { color: COLORS.text.secondary, fontFamily: FONTS.bold, fontSize: 16 },
    saveBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.accent.primary, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
});

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: COLORS.background.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxHeight: '80%', padding: 16,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { color: COLORS.text.primary, fontFamily: FONTS.bold, fontSize: 18 },
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.background.primary, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 8,
        marginBottom: 12, borderWidth: 1, borderColor: COLORS.border.color,
    },
    searchInput: { flex: 1, color: COLORS.text.primary, fontFamily: FONTS.regular, fontSize: 14 },
    item: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border.color },
    itemName: { color: COLORS.text.primary, fontFamily: FONTS.semibold, fontSize: 15 },
    empty: { color: COLORS.text.secondary, textAlign: 'center', padding: 24, fontFamily: FONTS.regular },
});
