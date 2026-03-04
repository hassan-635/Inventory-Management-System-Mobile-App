import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, FlatList
} from 'react-native';
import { productsService } from '../api/products';
import { buyersService } from '../api/buyers';
import { salesService } from '../api/sales';
import { COLORS, FONTS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const BILL_TYPES = [
    { key: 'DUMMY', label: '📋 Dummy' },
    { key: 'REAL', label: '✅ Original' },
    { key: 'CREDIT', label: '💳 Udhaar' },
];

export default function BillingScreen() {
    const [products, setProducts] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [billType, setBillType] = useState('REAL');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDD, setShowProductDD] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
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
    const qty = Number(quantity) || 0;
    const disc = Number(discount) || 0;
    const totalAmount = Math.max(0, (unitPrice * qty) - disc);

    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(productSearch.toLowerCase())
    );
    const filteredBuyers = buyers.filter(b =>
        b.name?.toLowerCase().includes(buyerSearch.toLowerCase())
    );

    const handleProductSelect = (p) => {
        setSelectedProduct(p);
        setProductSearch(p.name);
        setShowProductDD(false);
    };

    const handleBuyerSelect = (b) => {
        setSelectedBuyer(b);
        setBuyerSearch(b.name);
        setShowBuyerDD(false);
    };

    const handleSubmit = async () => {
        if (!selectedProduct && !productSearch.trim()) {
            Alert.alert('Error', 'Please select or enter a product.');
            return;
        }
        if (qty <= 0) {
            Alert.alert('Error', 'Quantity must be at least 1.');
            return;
        }

        const payload = {
            buyer_id: selectedBuyer?.id || null,
            buyer_name: selectedBuyer ? null : (buyerSearch.trim() || null),
            product_id: selectedProduct?.id || null,
            product_name: selectedProduct ? null : productSearch.trim(),
            quantity: qty,
            total_amount: totalAmount,
            paid_amount: billType === 'CREDIT' ? Number(paidAmount || 0) : totalAmount,
            bill_type: billType,
        };

        try {
            setSubmitting(true);
            await salesService.create(payload);
            Alert.alert('✅ Success', `${billType} Bill created for Rs. ${totalAmount}`);
            // Reset
            setSelectedProduct(null);
            setProductSearch('');
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

            {/* Product */}
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Product</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Search or type product name..."
                    placeholderTextColor={COLORS.text.muted}
                    value={productSearch}
                    onChangeText={t => { setProductSearch(t); setShowProductDD(true); setSelectedProduct(null); }}
                    onFocus={() => setShowProductDD(true)}
                />
                {showProductDD && productSearch.length > 0 && (
                    <View style={styles.dropdown}>
                        {filteredProducts.slice(0, 6).map(p => (
                            <TouchableOpacity key={p.id} style={styles.dropdownItem} onPress={() => handleProductSelect(p)}>
                                <Text style={styles.dropdownItemTxt}>{p.name}</Text>
                                <Text style={styles.dropdownItemSub}>Rs. {p.price} | Stock: {p.remaining_quantity}</Text>
                            </TouchableOpacity>
                        ))}
                        {filteredProducts.length === 0 && (
                            <Text style={styles.dropdownEmpty}>No products — will auto-create</Text>
                        )}
                    </View>
                )}
                {selectedProduct && (
                    <Text style={styles.selectedHint}>✓ {selectedProduct.name} — Rs. {selectedProduct.price}/unit | Stock: {selectedProduct.remaining_quantity}</Text>
                )}
            </View>

            {/* Buyer (optional for DUMMY, required for CREDIT) */}
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
                            <TouchableOpacity key={b.id} style={styles.dropdownItem} onPress={() => handleBuyerSelect(b)}>
                                <Text style={styles.dropdownItemTxt}>{b.name}</Text>
                                <Text style={styles.dropdownItemSub}>{b.phone || 'No phone'}</Text>
                            </TouchableOpacity>
                        ))}
                        {filteredBuyers.length === 0 && (
                            <Text style={styles.dropdownEmpty}>New buyer — will auto-create</Text>
                        )}
                    </View>
                )}
            </View>

            {/* Qty & Discount */}
            <View style={styles.row}>
                <View style={[styles.section, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.sectionLabel}>Quantity</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={quantity}
                        onChangeText={setQuantity}
                        placeholder="1"
                        placeholderTextColor={COLORS.text.muted}
                    />
                </View>
                <View style={[styles.section, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.sectionLabel}>Discount (Rs.)</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={discount}
                        onChangeText={setDiscount}
                        placeholder="0"
                        placeholderTextColor={COLORS.text.muted}
                    />
                </View>
            </View>

            {/* Paid Amount (only for CREDIT) */}
            {billType === 'CREDIT' && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Paid Now (Rs.)</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={paidAmount}
                        onChangeText={setPaidAmount}
                        placeholder="0"
                        placeholderTextColor={COLORS.text.muted}
                    />
                </View>
            )}

            {/* Total Summary */}
            <View style={styles.totalCard}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Unit Price</Text>
                    <Text style={styles.totalVal}>Rs. {unitPrice}</Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Quantity</Text>
                    <Text style={styles.totalVal}>× {qty}</Text>
                </View>
                {disc > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Discount</Text>
                        <Text style={[styles.totalVal, { color: '#ef4444' }]}>- Rs. {disc}</Text>
                    </View>
                )}
                <View style={[styles.totalRow, styles.totalBorder]}>
                    <Text style={styles.totalLabelBig}>Total</Text>
                    <Text style={styles.totalValBig}>Rs. {totalAmount.toLocaleString()}</Text>
                </View>
                {billType === 'CREDIT' && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Remaining (Udhaar)</Text>
                        <Text style={[styles.totalVal, { color: '#f59e0b' }]}>
                            Rs. {Math.max(0, totalAmount - Number(paidAmount || 0))}
                        </Text>
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
                    : <Text style={styles.submitBtnTxt}>
                        <Icon name="checkmark-circle-outline" size={18} /> Create {billType} Bill
                    </Text>
                }
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background.primary },
    content: { padding: 16, paddingBottom: 60 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary },
    headerTitle: {
        fontSize: 24, color: COLORS.text.primary, fontFamily: FONTS.bold,
        paddingBottom: 16,
    },
    section: { marginBottom: 16 },
    sectionLabel: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 6 },
    input: {
        backgroundColor: COLORS.background.secondary,
        borderRadius: 10, padding: 12,
        color: COLORS.text.primary, fontFamily: FONTS.regular, fontSize: 14,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    dropdown: {
        backgroundColor: COLORS.background.secondary,
        borderRadius: 10, borderWidth: 1, borderColor: COLORS.border.color,
        marginTop: 4, zIndex: 10,
    },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border.color },
    dropdownItemTxt: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 14 },
    dropdownItemSub: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    dropdownEmpty: { color: COLORS.text.secondary, padding: 12, fontFamily: FONTS.regular, fontStyle: 'italic' },
    selectedHint: { color: '#22c55e', fontFamily: FONTS.regular, fontSize: 12, marginTop: 6 },
    billTypeRow: { flexDirection: 'row', gap: 8 },
    billTypeBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        backgroundColor: COLORS.background.secondary,
        borderWidth: 1, borderColor: COLORS.border.color,
        alignItems: 'center',
    },
    billTypeBtnActive: { backgroundColor: COLORS.accent.primary, borderColor: COLORS.accent.primary },
    billTypeTxt: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    billTypeTxtActive: { color: '#fff' },
    row: { flexDirection: 'row' },
    totalCard: {
        backgroundColor: COLORS.background.secondary,
        borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: COLORS.border.color,
        marginBottom: 20,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    totalBorder: { borderTopWidth: 1, borderTopColor: COLORS.border.color, marginTop: 8, paddingTop: 12 },
    totalLabel: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 14 },
    totalVal: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 14 },
    totalLabelBig: { color: COLORS.text.primary, fontFamily: FONTS.bold, fontSize: 18 },
    totalValBig: { color: COLORS.accent.primary, fontFamily: FONTS.bold, fontSize: 20 },
    submitBtn: {
        backgroundColor: COLORS.accent.primary, borderRadius: 12,
        padding: 16, alignItems: 'center',
    },
    submitBtnTxt: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
});
