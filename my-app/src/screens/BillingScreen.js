import React, { useEffect, useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, FlatList, Modal
} from 'react-native';
import { productsService } from '../api/products';
import { buyersService } from '../api/buyers';
import { salesService } from '../api/sales';
import { COLORS, FONTS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const BILL_TYPES = [
    { key: 'QUOTATION', label: '📋 Quotation' },
    { key: 'REAL', label: '✅ Original' },
    { key: 'CREDIT', label: '💳 Udhaar' },
];

// A searchable modal picker
const PickerModal = ({ visible, onClose, items, onSelect, title, searchKey = 'name', renderSub }) => {
    const [q, setQ] = useState('');
    const filtered = useMemo(() =>
        items.filter(i => (i[searchKey] || '').toLowerCase().includes(q.toLowerCase())),
        [items, q]
    );

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={modal.overlay}>
                <View style={modal.sheet}>
                    <View style={modal.header}>
                        <Text style={modal.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose}><Icon name="close" size={22} color={COLORS.text.secondary} /></TouchableOpacity>
                    </View>
                    <View style={modal.searchRow}>
                        <Icon name="search-outline" size={16} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
                        <TextInput
                            style={modal.searchInput}
                            placeholder={`Search ${title.toLowerCase()}...`}
                            placeholderTextColor={COLORS.text.muted}
                            value={q}
                            onChangeText={setQ}
                            autoFocus
                        />
                    </View>
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, i) => (item.id || i).toString()}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={modal.item} onPress={() => { onSelect(item); setQ(''); onClose(); }}>
                                <Text style={modal.itemName} numberOfLines={1}>{item[searchKey]}</Text>
                                {renderSub && <Text style={modal.itemSub}>{renderSub(item)}</Text>}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={modal.empty}>No results found</Text>}
                    />
                </View>
            </View>
        </Modal>
    );
};

export default function BillingScreen() {
    const [products, setProducts] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [billType, setBillType] = useState('REAL');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [buyerSearch, setBuyerSearch] = useState('');
    const [showBuyerDD, setShowBuyerDD] = useState(false);
    const [selectedBuyer, setSelectedBuyer] = useState(null);
    const [quantity, setQuantity] = useState('1');
    const [discount, setDiscount] = useState('0');
    const [paidAmount, setPaidAmount] = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const [p, b] = await Promise.all([productsService.getAll(), buyersService.getAll()]);
                setProducts(p);
                setBuyers(b);
            } catch (e) {
                console.error('Failed to load data', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const unitPrice = selectedProduct ? Number(selectedProduct.price || 0) : 0;
    const qty = Math.max(0, Number(quantity) || 0);
    const disc = Math.max(0, Number(discount) || 0);
    const totalAmount = Math.max(0, (unitPrice * qty) - disc);
    const remaining = Math.max(0, totalAmount - Number(paidAmount || 0));

    const filteredBuyers = buyers.filter(b =>
        b.name?.toLowerCase().includes(buyerSearch.toLowerCase())
    );

    const handleSubmit = async () => {
        if (!selectedProduct) {
            Alert.alert('Error', 'Please select a product from the list.');
            return;
        }
        if (qty <= 0) {
            Alert.alert('Error', 'Quantity must be at least 1.');
            return;
        }

        const payload = {
            buyer_id: selectedBuyer?.id || null,
            // Always send buyer_name so backend can auto-create/find buyer
            buyer_name: selectedBuyer
                ? selectedBuyer.name
                : (buyerSearch.trim() || 'Walk-in Customer'),
            product_id: selectedProduct.id,
            quantity: qty,
            total_amount: totalAmount,
            paid_amount: billType === 'CREDIT' ? Number(paidAmount || 0) : totalAmount,
            bill_type: billType === 'QUOTATION' ? 'REAL' : billType, // QUOTATION = no-stock-deduct handled by REAL but we label it
        };

        try {
            setSubmitting(true);
            await salesService.create(payload);
            Alert.alert('✅ Success', `${billType} Bill created!\nProduct: ${selectedProduct.name}\nTotal: Rs. ${totalAmount.toLocaleString()}`);
            setSelectedProduct(null);
            setSelectedBuyer(null);
            setBuyerSearch('');
            setQuantity('1');
            setDiscount('0');
            setPaidAmount('');
            setBillType('REAL');
        } catch (e) {
            Alert.alert('Error', e.response?.data?.error || 'Failed to create bill.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.headerTitle}>Create Bill</Text>

            {/* Bill Type */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Bill Type</Text>
                <View style={styles.billTypeRow}>
                    {BILL_TYPES.map(bt => (
                        <TouchableOpacity
                            key={bt.key}
                            style={[styles.billTypeBtn, billType === bt.key && styles.billTypeBtnActive]}
                            onPress={() => setBillType(bt.key)}
                        >
                            <Text style={[styles.billTypeTxt, billType === bt.key && styles.billTypeTxtActive]}>{bt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Product Picker */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Product *</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowProductPicker(true)}>
                    <Icon name="cube-outline" size={18} color={COLORS.text.secondary} style={{ marginRight: 10 }} />
                    {selectedProduct ? (
                        <View style={{ flex: 1 }}>
                            <Text style={styles.pickerBtnSelected} numberOfLines={1}>{selectedProduct.name}</Text>
                            <Text style={styles.pickerBtnSub}>Rs. {selectedProduct.price}/unit | Stock: {selectedProduct.remaining_quantity}</Text>
                        </View>
                    ) : (
                        <Text style={styles.pickerBtnPlaceholder}>Tap to select product...</Text>
                    )}
                    <Icon name="chevron-down" size={18} color={COLORS.text.secondary} />
                </TouchableOpacity>
                {selectedProduct && (
                    <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.clearBtn}>
                        <Icon name="close-circle" size={16} color="#ef4444" />
                        <Text style={styles.clearTxt}>Clear selection</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Buyer search (free text allowed — auto-creates) */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Buyer {billType === 'DUMMY' ? '(Optional)' : ''}</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Search or type buyer name..."
                    placeholderTextColor={COLORS.text.muted}
                    value={buyerSearch}
                    onChangeText={t => { setBuyerSearch(t); setShowBuyerDD(true); setSelectedBuyer(null); }}
                    onFocus={() => setShowBuyerDD(true)}
                />
                {showBuyerDD && buyerSearch.length > 0 && (
                    <View style={styles.dropdown}>
                        {filteredBuyers.slice(0, 5).map(b => (
                            <TouchableOpacity
                                key={b.id} style={styles.dropdownItem}
                                onPress={() => { setSelectedBuyer(b); setBuyerSearch(b.name); setShowBuyerDD(false); }}
                            >
                                <Text style={styles.dropdownItemTxt} numberOfLines={1}>{b.name}</Text>
                                <Text style={styles.dropdownItemSub}>{b.phone || 'No phone'}</Text>
                            </TouchableOpacity>
                        ))}
                        {filteredBuyers.length === 0 && (
                            <Text style={styles.dropdownEmpty}>"{buyerSearch}" — will auto-create as new buyer</Text>
                        )}
                    </View>
                )}
                {selectedBuyer && (
                    <Text style={styles.selectedHint}>✓ Existing buyer selected</Text>
                )}
            </View>

            {/* Qty & Discount */}
            <View style={styles.row}>
                <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.sectionLabel}>Quantity</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={quantity} onChangeText={setQuantity} placeholder="1" placeholderTextColor={COLORS.text.muted} />
                </View>
                <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.sectionLabel}>Discount (Rs.)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={discount} onChangeText={setDiscount} placeholder="0" placeholderTextColor={COLORS.text.muted} />
                </View>
            </View>

            {/* Paid Amount for CREDIT */}
            {billType === 'CREDIT' && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Paid Now (Rs.)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={paidAmount} onChangeText={setPaidAmount} placeholder="0" placeholderTextColor={COLORS.text.muted} />
                </View>
            )}

            {/* Total Summary */}
            <View style={styles.totalCard}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Unit Price</Text>
                    <Text style={styles.totalVal}>Rs. {unitPrice.toLocaleString()}</Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Quantity</Text>
                    <Text style={styles.totalVal}>× {qty}</Text>
                </View>
                {disc > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Discount</Text>
                        <Text style={[styles.totalVal, { color: '#ef4444' }]}>- Rs. {disc.toLocaleString()}</Text>
                    </View>
                )}
                <View style={[styles.totalRow, styles.totalBorder]}>
                    <Text style={styles.totalLabelBig}>Total</Text>
                    <Text style={styles.totalValBig}>Rs. {totalAmount.toLocaleString()}</Text>
                </View>
                {billType === 'CREDIT' && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Remaining (Udhaar)</Text>
                        <Text style={[styles.totalVal, { color: '#f59e0b' }]}>Rs. {remaining.toLocaleString()}</Text>
                    </View>
                )}
            </View>

            {/* Submit */}
            <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
            >
                {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitBtnTxt}>Create {billType} Bill  →</Text>
                }
            </TouchableOpacity>

            {/* Product Picker Modal */}
            <PickerModal
                visible={showProductPicker}
                onClose={() => setShowProductPicker(false)}
                items={products}
                onSelect={setSelectedProduct}
                title="Select Product"
                searchKey="name"
                renderSub={p => `Rs. ${p.price} | Stock: ${p.remaining_quantity}`}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background.primary },
    content: { padding: 16, paddingBottom: 60 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary },
    headerTitle: { fontSize: 24, color: COLORS.text.primary, fontFamily: FONTS.bold, paddingBottom: 16 },
    section: { marginBottom: 16 },
    sectionLabel: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 6 },
    input: {
        backgroundColor: COLORS.background.secondary, borderRadius: 10, padding: 12,
        color: COLORS.text.primary, fontFamily: FONTS.regular, fontSize: 14,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    pickerBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.background.secondary, borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    pickerBtnSelected: { color: COLORS.text.primary, fontFamily: FONTS.semibold, fontSize: 14 },
    pickerBtnSub: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    pickerBtnPlaceholder: { flex: 1, color: COLORS.text.muted, fontFamily: FONTS.regular, fontSize: 14 },
    clearBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    clearTxt: { color: '#ef4444', fontFamily: FONTS.regular, fontSize: 12, marginLeft: 4 },
    dropdown: {
        backgroundColor: COLORS.background.secondary, borderRadius: 10,
        borderWidth: 1, borderColor: COLORS.border.color, marginTop: 4,
    },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border.color },
    dropdownItemTxt: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 14 },
    dropdownItemSub: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    dropdownEmpty: { color: COLORS.text.secondary, padding: 12, fontFamily: FONTS.regular, fontStyle: 'italic' },
    selectedHint: { color: '#22c55e', fontFamily: FONTS.regular, fontSize: 12, marginTop: 6 },
    billTypeRow: { flexDirection: 'row', gap: 8 },
    billTypeBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        backgroundColor: COLORS.background.secondary, borderWidth: 1, borderColor: COLORS.border.color,
        alignItems: 'center',
    },
    billTypeBtnActive: { backgroundColor: COLORS.accent.primary, borderColor: COLORS.accent.primary },
    billTypeTxt: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 12 },
    billTypeTxtActive: { color: '#fff' },
    row: { flexDirection: 'row' },
    totalCard: {
        backgroundColor: COLORS.background.secondary, borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: COLORS.border.color, marginBottom: 20,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    totalBorder: { borderTopWidth: 1, borderTopColor: COLORS.border.color, marginTop: 8, paddingTop: 12 },
    totalLabel: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 14 },
    totalVal: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 14 },
    totalLabelBig: { color: COLORS.text.primary, fontFamily: FONTS.bold, fontSize: 18 },
    totalValBig: { color: COLORS.accent.primary, fontFamily: FONTS.bold, fontSize: 20 },
    submitBtn: { backgroundColor: COLORS.accent.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    submitBtnTxt: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
});

const modal = StyleSheet.create({
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
    itemSub: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
    empty: { color: COLORS.text.secondary, textAlign: 'center', padding: 24, fontFamily: FONTS.regular },
});
