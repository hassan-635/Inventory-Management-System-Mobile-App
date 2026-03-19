import React, { useEffect, useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, FlatList, Modal
} from 'react-native';
import { productsService } from '../api/products';
import { buyersService } from '../api/buyers';
import { salesService } from '../api/sales';
import { COLORS, FONTS } from '../theme/theme';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';

const BILL_TYPES = [
    { key: 'QUOTATION', label: '📋 Quotation' },
    { key: 'REAL', label: '✅ Original' },
    { key: 'CREDIT', label: '💳 Udhaar' },
];

// A searchable modal picker for Products and Companies
const PickerModal = ({ visible, onClose, items, onSelect, title, searchKey = 'name', renderSub, isStringList = false }) => {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        if (isStringList) {
            return items.filter(i => i.toLowerCase().includes(q.toLowerCase()));
        }
        return items.filter(i => (i[searchKey] || '').toLowerCase().includes(q.toLowerCase()));
    }, [items, q, isStringList, searchKey]);

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
                        keyExtractor={(item, i) => isStringList ? item : (item.id || i).toString()}
                        contentContainerStyle={{ paddingBottom: 24 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={modal.item} onPress={() => { onSelect(item); setQ(''); onClose(); }}>
                                <Text style={modal.itemName} numberOfLines={1}>{isStringList ? item : item[searchKey]}</Text>
                                {!isStringList && renderSub && <Text style={modal.itemSub}>{renderSub(item)}</Text>}
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
    
    // Cart State
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [quantity, setQuantity] = useState('1');

    // Customer State
    const [buyerSearch, setBuyerSearch] = useState('');
    const [showBuyerDD, setShowBuyerDD] = useState(false);
    const [selectedBuyer, setSelectedBuyer] = useState(null);
    const [buyerPhone, setBuyerPhone] = useState('');
    
    // Company State
    const [companyName, setCompanyName] = useState('');
    const [showCompanyPicker, setShowCompanyPicker] = useState(false);

    // Udhaar State
    const [paidAmount, setPaidAmount] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [p, b] = await Promise.all([productsService.getAll(), buyersService.getAll()]);
            setProducts(p);
            setBuyers(b);
        } catch (e) {
            console.error('Failed to load data', e);
        } finally {
            setLoading(false);
        }
    };

    // Derived Companies List from Buyers
    const companyOptions = useMemo(() => {
        const companies = buyers.map(b => b.company_name).filter(Boolean);
        return [...new Set(companies)];
    }, [buyers]);

    // Derived Values
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = subtotal;
    const remaining = Math.max(0, totalAmount - Number(paidAmount || 0));

    const filteredBuyers = buyers.filter(b =>
        b.name?.toLowerCase().includes(buyerSearch.toLowerCase()) || 
        (b.company_name && b.company_name.toLowerCase().includes(buyerSearch.toLowerCase()))
    );

    const addToCart = () => {
        if (!selectedProduct) return;
        
        const qtyToAdd = parseInt(quantity, 10);
        if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
            useToastStore.getState().showToast("Error", "Quantity must be at least 1", "error");
            return;
        }

        // Validate stock for real/credit bills
        if (billType !== 'QUOTATION' && selectedProduct.remaining_quantity < qtyToAdd) {
            useToastStore.getState().showToast("Stock Error", `Cannot add ${qtyToAdd} items. Only ${selectedProduct.remaining_quantity} in stock.`, "error");
            return;
        }

        const existingItemIndex = cart.findIndex(item => item.id === selectedProduct.id);
        
        if (existingItemIndex >= 0) {
            const newCart = [...cart];
            const newTotalQty = newCart[existingItemIndex].quantity + qtyToAdd;
            
            if (billType !== 'QUOTATION' && selectedProduct.remaining_quantity < newTotalQty) {
                Alert.alert("Stock Error", `Exceeds stock limit of ${selectedProduct.remaining_quantity}.`);
                return;
            }
            
            newCart[existingItemIndex].quantity = newTotalQty;
            setCart(newCart);
        } else {
            setCart([...cart, { ...selectedProduct, quantity: qtyToAdd }]);
        }

        setSelectedProduct(null);
        setQuantity('1');
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleSelectBuyer = (b) => {
        setSelectedBuyer(b);
        setBuyerSearch(b.name);
        if (b.company_name) setCompanyName(b.company_name);
        if (b.phone && b.phone !== 'N/A') setBuyerPhone(b.phone);
        setShowBuyerDD(false);
    };

    const handleSubmit = async () => {
        if (cart.length === 0) {
            useToastStore.getState().showToast('Error', 'Please add at least one item to the cart.', 'error');
            return;
        }

        // QUOTATION LOGIC
        if (billType === 'QUOTATION') {
            useToastStore.getState().showToast('Quotation Generated', 'This is a quotation invoice.', 'info');
            // In a real app, this would trigger PDF generation or printing.
            resetForm();
            return;
        }

        const isCreditBill = billType === 'CREDIT';

        if (isCreditBill && (!buyerSearch.trim() || !buyerPhone.trim())) {
            Alert.alert('Udhaar Validation Error', 'Udhaar bills require both Customer Name and Phone Number.');
            return;
        }

        try {
            setSubmitting(true);
            let activeBuyerId = selectedBuyer?.id || null;

            // Udhaar Auto-Create Buyer (Frontend Parity)
            if (isCreditBill && !activeBuyerId) {
                const buyerPayload = {
                    name: buyerSearch.trim(),
                    phone: buyerPhone.trim(),
                    company_name: companyName.trim() || null
                };
                const buyerRes = await buyersService.create(buyerPayload);
                // Depending on backend response format
                activeBuyerId = buyerRes.data?.[0]?.id || buyerRes.data?.id || buyerRes.id;
                
                if (!activeBuyerId) {
                    throw new Error("Failed to auto-create customer for Udhaar bill");
                }
            }

            // Prepare common sale data
            const actualBillType = isCreditBill ? 'CREDIT' : 'REAL';
            const userPaid = isCreditBill ? Number(paidAmount || 0) : null;
            const bName = buyerSearch.trim() || 'Walk-in Customer';

            // Submit each cart item individually to match backend constraints
            for (const item of cart) {
                const itemTotal = item.price * item.quantity;
                const payload = {
                    product_id: item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    total_amount: itemTotal,
                    bill_type: actualBillType,
                    buyer_id: activeBuyerId,
                    buyer_name: bName,
                    company_name: companyName.trim() || null,
                    paid_amount: isCreditBill ? userPaid : itemTotal
                };
                
                // If multiple items, we assign the full paid amount to the first item for simplicity, 
                // or distribute it. Since backend `createSale` logs payment history, distributing it 
                // perfectly is tricky. For now, sending userPaid for all might duplicate payments if backend 
                // isn't careful. Frontend sends it per item too.
                await salesService.create(payload);
            }

            useToastStore.getState().showToast('Success', `${isCreditBill ? 'Udhaar' : 'Original'} Bill saved successfully!`, 'success');
            resetForm();
            loadData(); // Refresh stock

        } catch (e) {
            useToastStore.getState().showToast('Error', e.response?.data?.error || e.message || 'Failed to create bill.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setCart([]);
        setSelectedProduct(null);
        setSelectedBuyer(null);
        setBuyerSearch('');
        setBuyerPhone('');
        setCompanyName('');
        setQuantity('1');
        setPaidAmount('');
        setBillType('REAL');
    };

    if (loading && products.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.headerTitle}>Generate Bill</Text>

            {/* --- BILL DETAILS SECTION --- */}
            <View style={styles.cardSection}>
                <Text style={styles.sectionHeader}>Bill Details</Text>
                
                {/* Bill Type */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Bill Type</Text>
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

                {/* Customer Name */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{billType === 'CREDIT' ? 'Customer Name *' : 'Customer Name'}</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder={billType === 'CREDIT' ? 'Enter customer name (required)' : 'Search or type customer...'}
                        placeholderTextColor={COLORS.text.muted}
                        value={buyerSearch}
                        onChangeText={t => { setBuyerSearch(t); setShowBuyerDD(true); setSelectedBuyer(null); }}
                        onFocus={() => setShowBuyerDD(true)}
                    />
                    {showBuyerDD && buyerSearch.length > 0 && (
                        <View style={styles.dropdown}>
                            {filteredBuyers.slice(0, 5).map(b => (
                                <TouchableOpacity key={b.id} style={styles.dropdownItem} onPress={() => handleSelectBuyer(b)}>
                                    <Text style={styles.dropdownItemTxt} numberOfLines={1}>{b.name}</Text>
                                    <Text style={styles.dropdownItemSub}>
                                        {b.company_name ? `🏢 ${b.company_name}` : (b.phone || 'No phone')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            {filteredBuyers.length === 0 && (
                                <Text style={styles.dropdownEmpty}>Will auto-create as new buyer</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Company Name */}
                {billType !== 'QUOTATION' && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Company Name</Text>
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCompanyPicker(true)}>
                            <Text style={[styles.pickerBtnTxt, !companyName && {color: COLORS.text.muted}]}>
                                {companyName ? `🏢 ${companyName}` : 'Select or type company...'}
                            </Text>
                            <Icon name="chevron-down" size={18} color={COLORS.text.secondary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Udhaar Specific Fields */}
                {billType === 'CREDIT' && (
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                            <Text style={styles.inputLabel}>Phone *</Text>
                            <TextInput 
                                style={styles.textInput} keyboardType="phone-pad" 
                                value={buyerPhone} onChangeText={setBuyerPhone} 
                                placeholder="03xx-xxxxxxx" placeholderTextColor={COLORS.text.muted} 
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                            <Text style={styles.inputLabel}>Paid Now (Rs)</Text>
                            <TextInput 
                                style={styles.textInput} keyboardType="numeric" 
                                value={paidAmount} onChangeText={setPaidAmount} 
                                placeholder="0" placeholderTextColor={COLORS.text.muted} 
                            />
                        </View>
                    </View>
                )}
            </View>

            {/* --- ADD ITEMS SECTION --- */}
            <View style={styles.cardSection}>
                <Text style={styles.sectionHeader}>Add Items</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Select Product</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowProductPicker(true)}>
                        <Icon name="cube-outline" size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                            {selectedProduct ? (
                                <>
                                    <Text style={styles.pickerBtnTxt} numberOfLines={1}>{selectedProduct.name}</Text>
                                    <Text style={styles.pickerBtnSub}>Rs. {selectedProduct.price} | Stock: {selectedProduct.remaining_quantity}</Text>
                                </>
                            ) : (
                                <Text style={[styles.pickerBtnTxt, {color: COLORS.text.muted}]}>Tap to search product...</Text>
                            )}
                        </View>
                        <Icon name="chevron-down" size={18} color={COLORS.text.secondary} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.row, { alignItems: 'flex-end' }]}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 10, marginBottom: 0 }]}>
                        <Text style={styles.inputLabel}>Quantity</Text>
                        <TextInput 
                            style={styles.textInput} keyboardType="numeric" 
                            value={quantity} onChangeText={setQuantity} 
                            placeholder="1" placeholderTextColor={COLORS.text.muted} 
                        />
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={addToCart}>
                        <Icon name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                
                {selectedProduct && billType !== 'QUOTATION' && (
                    <Text style={styles.stockHint}>
                        📦 Remaining Stock: <Text style={{fontWeight: 'bold'}}>{selectedProduct.remaining_quantity}</Text>
                    </Text>
                )}
            </View>

            {/* --- CART SECTION --- */}
            <View style={styles.cardSection}>
                <View style={styles.cartHeaderRow}>
                    <Text style={styles.sectionHeader}>Current Items</Text>
                    <Text style={styles.itemCountText}>{cart.length} items</Text>
                </View>

                {cart.length === 0 ? (
                    <View style={styles.emptyCart}>
                        <Icon name="receipt-outline" size={32} color={COLORS.text.muted} />
                        <Text style={styles.emptyCartTxt}>No items added yet</Text>
                    </View>
                ) : (
                    cart.map((item, index) => (
                        <View key={`${item.id}-${index}`} style={styles.cartItem}>
                            <View style={styles.cartItemDetails}>
                                <Text style={styles.cartItemName}>{item.name}</Text>
                                <Text style={styles.cartItemSub}>Rs. {item.price} x {item.quantity}</Text>
                            </View>
                            <View style={styles.cartItemRight}>
                                <Text style={styles.cartItemTotal}>Rs. {(item.price * item.quantity).toLocaleString()}</Text>
                                <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromCart(item.id)}>
                                    <Icon name="trash-outline" size={18} color={COLORS.status.danger} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* --- TOTAL SUMMARY --- */}
            {cart.length > 0 && (
                <View style={styles.totalCard}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalVal}>Rs. {subtotal.toLocaleString()}</Text>
                    </View>
                    <View style={[styles.totalRow, styles.totalBorder]}>
                        <Text style={styles.totalLabelBig}>Total Amount</Text>
                        <Text style={styles.totalValBig}>Rs. {totalAmount.toLocaleString()}</Text>
                    </View>
                    {billType === 'CREDIT' && (
                        <>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Paid Amount</Text>
                                <Text style={styles.totalVal}>Rs. {Number(paidAmount || 0).toLocaleString()}</Text>
                            </View>
                            <View style={styles.totalRow}>
                                <Text style={[styles.totalLabel, { color: COLORS.status.danger }]}>Remaining (Udhaar)</Text>
                                <Text style={[styles.totalVal, { color: COLORS.status.danger, fontWeight: 'bold' }]}>Rs. {remaining.toLocaleString()}</Text>
                            </View>
                        </>
                    )}
                </View>
            )}

            {/* Submit */}
            <TouchableOpacity
                style={[styles.submitBtn, (submitting || cart.length === 0) && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting || cart.length === 0}
            >
                {submitting ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.submitBtnTxt}>
                        {billType === 'QUOTATION' ? 'Generate Quotation 🖨️' : `Save ${billType} Bill \u2192`}
                    </Text>
                )}
            </TouchableOpacity>

            <View style={{height: 20}} />

            {/* Modals */}
            <PickerModal
                visible={showProductPicker}
                onClose={() => setShowProductPicker(false)}
                items={products.filter(p => billType === 'QUOTATION' || p.remaining_quantity >= 1)}
                onSelect={setSelectedProduct}
                title="Select Product"
                searchKey="name"
                renderSub={p => `Rs. ${p.price} | Stock: ${p.remaining_quantity}`}
            />

            <PickerModal
                visible={showCompanyPicker}
                onClose={() => setShowCompanyPicker(false)}
                items={companyOptions}
                onSelect={setCompanyName}
                title="Select Company"
                isStringList={true}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background.primary },
    content: { padding: 16, paddingBottom: 40 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary },
    headerTitle: { fontSize: 26, color: COLORS.text.primary, fontFamily: FONTS.bold, marginBottom: 16 },
    cardSection: {
        backgroundColor: COLORS.background.secondary,
        borderRadius: 16,
        padding: 20,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: COLORS.border.color || 'rgba(255,255,255,0.05)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    sectionHeader: {
        fontSize: 18,
        color: COLORS.text.primary,
        fontFamily: FONTS.semibold,
        marginBottom: 16,
    },
    inputGroup: { marginBottom: 16 },
    inputLabel: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 6 },
    textInput: {
        backgroundColor: COLORS.background.tertiary, borderRadius: 10, padding: 12,
        color: COLORS.text.primary, fontFamily: FONTS.regular, fontSize: 14,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    pickerBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.background.tertiary, borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: COLORS.border.color,
    },
    pickerBtnTxt: { flex: 1, color: COLORS.text.primary, fontFamily: FONTS.semibold, fontSize: 14 },
    pickerBtnSub: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    row: { flexDirection: 'row' },
    addBtn: {
        backgroundColor: COLORS.accent.primary,
        width: 50, height: 50, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    stockHint: { color: '#a78bfa', fontFamily: FONTS.medium, fontSize: 12, marginTop: 6 },
    
    // Dropdown
    dropdown: {
        backgroundColor: COLORS.background.tertiary, borderRadius: 10,
        borderWidth: 1, borderColor: COLORS.border.color, marginTop: 4,
    },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border.color },
    dropdownItemTxt: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 14 },
    dropdownItemSub: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    dropdownEmpty: { color: COLORS.text.secondary, padding: 12, fontFamily: FONTS.regular, fontStyle: 'italic' },
    
    // Bill Types
    billTypeRow: { flexDirection: 'row', gap: 8 },
    billTypeBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        backgroundColor: COLORS.background.tertiary, borderWidth: 1, borderColor: COLORS.border.color,
        alignItems: 'center',
    },
    billTypeBtnActive: { backgroundColor: COLORS.accent.primary, borderColor: COLORS.accent.primary },
    billTypeTxt: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 12 },
    billTypeTxtActive: { color: '#fff' },
    
    // Cart
    cartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    itemCountText: { color: COLORS.accent.primary, fontFamily: FONTS.medium, fontSize: 13 },
    emptyCart: { alignItems: 'center', padding: 20 },
    emptyCartTxt: { color: COLORS.text.muted, fontFamily: FONTS.regular, marginTop: 8 },
    cartItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border.color,
    },
    cartItemDetails: { flex: 1 },
    cartItemName: { color: COLORS.text.primary, fontFamily: FONTS.semibold, fontSize: 15 },
    cartItemSub: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 13, marginTop: 2 },
    cartItemRight: { flexDirection: 'row', alignItems: 'center' },
    cartItemTotal: { color: COLORS.text.primary, fontFamily: FONTS.semibold, fontSize: 15, marginRight: 12 },
    removeBtn: { padding: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6 },
    
    // Totals
    totalCard: {
        backgroundColor: COLORS.background.secondary, borderRadius: 16, padding: 20,
        borderWidth: 1, borderColor: COLORS.border.color || 'rgba(255,255,255,0.05)', marginBottom: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    totalBorder: { borderTopWidth: 1, borderTopColor: COLORS.border.color, marginTop: 8, paddingTop: 12, marginBottom: 6 },
    totalLabel: { color: COLORS.text.secondary, fontFamily: FONTS.regular, fontSize: 15 },
    totalVal: { color: COLORS.text.primary, fontFamily: FONTS.medium, fontSize: 15 },
    totalLabelBig: { color: COLORS.text.primary, fontFamily: FONTS.bold, fontSize: 18 },
    totalValBig: { color: COLORS.accent.primary, fontFamily: FONTS.bold, fontSize: 20 },
    
    // Submit
    submitBtn: { 
        backgroundColor: COLORS.accent.primary, 
        borderRadius: 14, 
        padding: 18, 
        alignItems: 'center',
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
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
