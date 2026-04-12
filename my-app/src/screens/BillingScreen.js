import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, FlatList, Modal, useWindowDimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { productsService } from '../api/products';
import { buyersService } from '../api/buyers';
import { salesService } from '../api/sales';
import { useAppTheme } from '../theme/useAppTheme';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import { formatProductId } from '../utils/formatProductId';
import { useFocusEffect } from '@react-navigation/native';
import { useDataRefreshStore } from '../store/dataRefreshStore';

const BILL_TYPES = [
    { key: 'QUOTATION', label: '📋 Quotation' },
    { key: 'REAL', label: '✅ Original' },
    { key: 'CREDIT', label: '💳 Credit' },
];

const UNIT_OPTIONS = ['Per Piece', 'Per Dozen', 'Per Box', 'Per Kg', 'Per Liter', 'Per Meter', 'Per Roll', 'Per Pack', 'Per Case', 'Per Gallon', 'Per Bucket/Balti', 'Per 250 Gram', 'Per Gram', 'Per Inch', 'Per Ft', 'Per Millimeter', 'Per Pair', 'Per Set', 'Per Strip', 'Per Bag', 'Per Coil'];

// Remove "Per " prefix for bill display (e.g. "Per Piece" → "Piece")
const stripPer = (unit) => unit ? unit.replace(/^Per\s+/i, '') : '';

// A searchable modal picker for Products and Companies
const PickerModal = ({ visible, onClose, items, onSelect, title, searchKey = 'name', renderSub, isStringList = false, colors, FONTS }) => {
    const [q, setQ] = useState('');
    const modalStyles = useMemo(() => getModalStyles(colors, FONTS), [colors, FONTS]);

    const filtered = useMemo(() => {
        if (isStringList) {
            return items.filter(i => i.toLowerCase().includes(q.toLowerCase()));
        }
        return items.filter(i => (i[searchKey] || '').toLowerCase().includes(q.toLowerCase()));
    }, [items, q, isStringList, searchKey]);

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.sheet}>
                    <View style={modalStyles.header}>
                        <Text style={modalStyles.title}>{title}</Text>
                        <TouchableOpacity onPress={onClose}><Icon name="close" size={22} color={colors.text.secondary} /></TouchableOpacity>
                    </View>
                    <View style={modalStyles.searchRow}>
                        <Icon name="search-outline" size={16} color={colors.text.secondary} style={{ marginRight: 8 }} />
                        <TextInput
                            style={modalStyles.searchInput}
                            placeholder={`Search ${title.toLowerCase()}...`}
                            placeholderTextColor={colors.text.muted}
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
                            <TouchableOpacity style={modalStyles.item} onPress={() => { onSelect(item); setQ(''); onClose(); }}>
                                <Text style={modalStyles.itemName} numberOfLines={1}>{isStringList ? item : item[searchKey]}</Text>
                                {!isStringList && renderSub && <Text style={modalStyles.itemSub}>{renderSub(item)}</Text>}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={modalStyles.empty}>No results found</Text>}
                    />
                </View>
            </View>
        </Modal>
    );
};

export default function BillingScreen() {
    const { colors, FONTS } = useAppTheme();
    const styles = useMemo(() => getStyles(colors, FONTS), [colors, FONTS]);
    const { width } = useWindowDimensions();
    const isTablet = width > 768;

    const [products, setProducts] = useState([]);
    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [lastSaleData, setLastSaleData] = useState(null); // for PDF after sale

    // Form state
    const [billType, setBillType] = useState('REAL');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [splitCash, setSplitCash] = useState('');
    const [splitOnline, setSplitOnline] = useState('');
    
    // Cart State
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [quantity, setQuantity] = useState('1');
    const [selectedUnit, setSelectedUnit] = useState('Per Piece');
    const [showUnitPicker, setShowUnitPicker] = useState(false);

    // Customer State
    const [buyerSearch, setBuyerSearch] = useState('');
    const [showBuyerDD, setShowBuyerDD] = useState(false);
    const [selectedBuyer, setSelectedBuyer] = useState(null);
    const [buyerPhone, setBuyerPhone] = useState('');
    
    // Company State
    const [companyName, setCompanyName] = useState('');
    const [showCompanyDD, setShowCompanyDD] = useState(false);

    // Credit State
    const [paidAmount, setPaidAmount] = useState('0');

    // Recent bill recovery
    const [recentGeneratedBill, setRecentGeneratedBill] = useState(null);
    const [isEditingGeneratedBill, setIsEditingGeneratedBill] = useState(false);
    const skipAutosave = useRef(false);

    const inventoryTick = useDataRefreshStore((s) => s.inventoryTick);
    const billingFirstFocus = useRef(true);

    const loadData = useCallback(async (opts = { showLoading: true }) => {
        try {
            if (opts.showLoading) setLoading(true);
            const [p, b] = await Promise.all([productsService.getAll(), buyersService.getAll()]);
            setProducts(p);
            setBuyers(b);
        } catch (e) {
            console.error('Failed to load data', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData({ showLoading: billingFirstFocus.current });
            billingFirstFocus.current = false;
        }, [loadData]),
    );

    useEffect(() => {
        if (inventoryTick === 0) return;
        loadData({ showLoading: false });
    }, [inventoryTick, loadData]);

    // Load draft + recent bill from AsyncStorage on mount
    useEffect(() => {
        const loadSaved = async () => {
            try {
                const savedRecent = await AsyncStorage.getItem('recent_billing_data');
                if (savedRecent) setRecentGeneratedBill(JSON.parse(savedRecent));

                const savedDraft = await AsyncStorage.getItem('current_billing_draft');
                if (savedDraft) {
                    skipAutosave.current = true;
                    const d = JSON.parse(savedDraft);
                    setCart(d.cart || []);
                    setBuyerSearch(d.buyerSearch || '');
                    setCompanyName(d.companyName || '');
                    setBuyerPhone(d.buyerPhone || '');
                    setBillType(d.billType || 'REAL');
                    setPaidAmount(d.paidAmount || '0');
                    setPaymentMethod(d.paymentMethod || 'Cash');
                    setSplitCash(d.splitCash || '');
                    setSplitOnline(d.splitOnline || '');
                    setIsEditingGeneratedBill(d.isEditingGeneratedBill || false);
                    setTimeout(() => { skipAutosave.current = false; }, 500);
                }
            } catch (e) { console.error('Failed to load billing draft', e); }
        };
        loadSaved();
    }, []);

    // Continuously autosave draft
    useEffect(() => {
        if (skipAutosave.current) return;
        const draftObj = { cart, buyerSearch, companyName, buyerPhone, billType, paidAmount, paymentMethod, splitCash, splitOnline, isEditingGeneratedBill };
        if (cart.length > 0 || buyerSearch) {
            AsyncStorage.setItem('current_billing_draft', JSON.stringify(draftObj)).catch(() => {});
        } else {
            AsyncStorage.removeItem('current_billing_draft').catch(() => {});
        }
    }, [cart, buyerSearch, companyName, buyerPhone, billType, paidAmount, paymentMethod, splitCash, splitOnline, isEditingGeneratedBill]);

    // Derived Companies List from Buyers (unique, sorted)
    const companyOptions = useMemo(() => {
        const companies = buyers.map(b => b.company_name).filter(Boolean);
        return [...new Set(companies)].sort();
    }, [buyers]);

    // Filtered companies based on current company input
    const filteredCompanies = useMemo(() => {
        if (!companyName.trim()) return companyOptions;
        return companyOptions.filter(c => c.toLowerCase().includes(companyName.toLowerCase()));
    }, [companyOptions, companyName]);

    const isNewCompany = companyName.trim().length > 0 &&
        !companyOptions.some(c => c.toLowerCase() === companyName.trim().toLowerCase());

    // Derived Values
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = subtotal;
    const remaining = Math.max(0, totalAmount - Number(paidAmount || 0));

    const filteredBuyers = useMemo(() => buyers.filter(b =>
        (b.name || '').toLowerCase().includes(buyerSearch.toLowerCase()) || 
        (b.company_name && b.company_name.toLowerCase().includes(buyerSearch.toLowerCase()))
    ), [buyers, buyerSearch]);

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
            newCart[existingItemIndex].cart_unit = selectedUnit;
            setCart(newCart);
        } else {
            setCart([...cart, { ...selectedProduct, quantity: qtyToAdd, cart_unit: selectedUnit }]);
        }

        setSelectedProduct(null);
        setQuantity('1');
        setSelectedUnit('Per Piece');
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
            // Generate a quotation PDF
            try {
                const cartForPdf = cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    selectedUnit: item.cart_unit || 'Per Piece'
                }));
                await generateInvoicePdf(
                    { amount: totalAmount },
                    cartForPdf,
                    buyerSearch.trim() || 'Walk-in Customer',
                    totalAmount,
                    0,
                    totalAmount,
                    null,
                    { kind: 'quotation' },
                );
            } catch (e) {
                useToastStore.getState().showToast('Quotation', 'PDF generation failed, please try again.', 'error');
            }
            resetForm();
            return;
        }

        const isCreditBill = billType === 'CREDIT';

        if (isCreditBill && (!buyerSearch.trim() || !buyerPhone.trim())) {
            Alert.alert('Credit Validation Error', 'Credit bills require both Customer Name and Phone Number.');
            return;
        }

        const activePaymentAmt = isCreditBill ? Number(paidAmount || 0) : totalAmount;

        if (paymentMethod === 'Split') {
            const parsedCash = Number(splitCash || 0);
            const parsedOnline = Number(splitOnline || 0);
            if (parsedCash < 0 || parsedOnline < 0) {
                useToastStore.getState().showToast('Validation Error', 'Split amounts must be non-negative.', 'error');
                return;
            }
            if (Math.abs((parsedCash + parsedOnline) - activePaymentAmt) > 0.01) {
                useToastStore.getState().showToast('Validation Error', 'Split amounts must perfectly equal the total paid amount.', 'error');
                return;
            }
        }

        try {
            setSubmitting(true);
            let activeBuyerId = selectedBuyer?.id || null;

            // Credit Auto-Create Buyer (Frontend Parity)
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
                    throw new Error("Failed to auto-create customer for Credit bill");
                }
            }

            // Prepare common sale data
            const actualBillType = isCreditBill ? 'CREDIT' : 'REAL';
            const userPaid = isCreditBill ? Number(paidAmount || 0) : null;
            const bName = buyerSearch.trim() || 'Walk-in Customer';

            const activePaymentAmt = isCreditBill ? Number(paidAmount || 0) : totalAmount;
            const derivedSplitOnline = paymentMethod === 'Split' ? Number(splitOnline || 0) : 0;

            // If editing a previously generated bill, delete the old sale records first
            if (isEditingGeneratedBill && recentGeneratedBill?.cart) {
                for (const oldItem of recentGeneratedBill.cart) {
                    if (oldItem.txn_id) {
                        try {
                            await salesService.delete(oldItem.txn_id);
                        } catch (e) {
                            console.error('Failed to delete old txn', oldItem.txn_id, e);
                        }
                    }
                }
            }

            // Submit each cart item individually to match backend constraints
            const generatedCartItems = [...cart];
            for (let i = 0; i < generatedCartItems.length; i++) {
                const item = generatedCartItems[i];
                const itemTotal = item.price * item.quantity;
                
                // Proportion logic for split payment
                let proportion = 1;
                if (paymentMethod === 'Split' && activePaymentAmt > 0) {
                    proportion = isCreditBill ? (itemTotal / totalAmount) : (itemTotal / activePaymentAmt);
                    if (!isCreditBill) proportion = itemTotal / activePaymentAmt;
                } else if (paymentMethod === 'Split' && activePaymentAmt > 0 && isCreditBill) {
                     proportion = itemTotal / totalAmount; // Actually, paid proportionally to item total's share of grand total
                }
                
                let proportionRatio = 1;
                if (activePaymentAmt > 0) {
                     // For both real and credit, the proportion of this item's contribution to the total
                     proportionRatio = itemTotal / totalAmount;
                }
                
                const currentItemPaid = isCreditBill ? activePaymentAmt * proportionRatio : itemTotal;
                
                const itemCashAmount = paymentMethod === 'Split' ? Math.round(Number(splitCash || 0) * proportionRatio * 100) / 100 : (paymentMethod === 'Cash' ? currentItemPaid : 0);
                const itemOnlineAmount = paymentMethod === 'Split' ? Math.round(derivedSplitOnline * proportionRatio * 100) / 100 : (paymentMethod === 'Online' ? currentItemPaid : 0);

                const payload = {
                    product_id: item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    total_amount: itemTotal,
                    bill_type: actualBillType,
                    buyer_id: activeBuyerId,
                    buyer_name: bName,
                    company_name: companyName.trim() || null,
                    paid_amount: currentItemPaid,
                    quantity_unit: item.cart_unit,
                    payment_method: paymentMethod,
                    cash_amount: itemCashAmount,
                    online_amount: itemOnlineAmount
                };
                
                const res = await salesService.create(payload);
                // Capture txn id for future edit/reversal
                generatedCartItems[i].txn_id = res?.data?.id || res?.id || res?.data?.[0]?.id;
            }

            useToastStore.getState().showToast('Success', `${isCreditBill ? 'Credit' : 'Original'} Bill saved successfully!`, 'success');
            useDataRefreshStore.getState().bumpInventory();

            // Check for low stock AFTER sale
            cart.forEach(item => {
                const remainingAfterSale = (item.remaining_quantity || 0) - item.quantity;
                const threshold = item.low_stock_threshold !== undefined && item.low_stock_threshold !== null ? Number(item.low_stock_threshold) : 10;
                if (remainingAfterSale > 0 && remainingAfterSale <= threshold) {
                    useToastStore.getState().showToast('Low Stock Alert', `⚠️ "${item.name}" stock has dropped to ${remainingAfterSale}!`, 'error');
                } else if (remainingAfterSale <= 0) {
                    useToastStore.getState().showToast('Out of Stock', `❌ "${item.name}" is now out of stock!`, 'error');
                }
            });

            // Save the generated bill snapshot to AsyncStorage for recovery
            const billSnapshot = {
                cart: generatedCartItems,
                buyerSearch: bName,
                companyName: companyName.trim() || '',
                buyerPhone,
                billType,
                paidAmount,
                paymentMethod,
                splitCash,
                splitOnline,
                isEditingGeneratedBill: false,
            };
            await AsyncStorage.setItem('recent_billing_data', JSON.stringify(billSnapshot));
            setRecentGeneratedBill(billSnapshot);

            // Save sale data for PDF download
            const cartForPdf = cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                selectedUnit: item.cart_unit || 'Per Piece'
            }));
            setLastSaleData({
                transactionInfo: { amount: isCreditBill ? Number(paidAmount || 0) : totalAmount },
                cartItems: cartForPdf,
                customerName: bName,
                totalBill: totalAmount,
                discount: 0,
                finalAmount: totalAmount,
                customPaymentDate: null,
                invoiceKind: isCreditBill ? 'credit_invoice' : 'cash_invoice',
            });
            
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
        setSelectedUnit('Per Piece');
        setPaidAmount('0');
        setBillType('REAL');
        setPaymentMethod('Cash');
        setSplitCash('');
        setSplitOnline('');
        setIsEditingGeneratedBill(false);
        skipAutosave.current = true;
        AsyncStorage.removeItem('current_billing_draft').catch(() => {});
        setTimeout(() => { skipAutosave.current = false; }, 500);
    };

    const canProceed = useMemo(() => {
        // Basic validation
        if (cart.length === 0) {
            console.log('Cart is empty');
            return false;
        }
        
        // Credit bill validation - allow partial payments
        if (billType === 'CREDIT') {
            if (!buyerSearch.trim() || !buyerPhone.trim()) return false;
            if (!paidAmount || Number(paidAmount) < 0) return false;
            if (Number(paidAmount) > totalAmount) return false;
        }
        
        // Split payment validation - different logic for credit vs regular bills
        if (paymentMethod === 'Split') {
            if (billType === 'CREDIT') {
                // For credit bills: cash + online = paid amount
                const cash = Number(splitCash || 0);
                const online = Number(splitOnline || 0);
                const totalPaid = cash + online;
                
                if (totalPaid !== Number(paidAmount || 0)) return false;
                if (cash < 0 || online < 0) return false;
            } else {
                // For regular bills: cash + online = total amount
                const cash = Number(splitCash || 0);
                const online = Number(splitOnline || 0);
                const totalPaid = cash + online;
                
                if (totalPaid !== totalAmount) return false;
                if (cash < 0 || online < 0) return false;
            }
        }
        
        return true;
    }, [cart, billType, buyerSearch, buyerPhone, paidAmount, totalAmount, paymentMethod, splitCash]);

    if (loading && products.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.content, isTablet && { paddingHorizontal: '10%' }]} keyboardShouldPersistTaps="handled">
            {/* Editing banner */}
            {isEditingGeneratedBill && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <Text style={{ color: '#f59e0b', fontFamily: FONTS.semibold, fontSize: 14 }}>✏️ Editing Printed Bill</Text>
                    <TouchableOpacity
                        onPress={() => {
                            setIsEditingGeneratedBill(false);
                            setCart([]);
                            setBuyerSearch(''); setBuyerPhone(''); setCompanyName('');
                            setPaidAmount('0'); setSplitCash(''); setSplitOnline('');
                            setPaymentMethod('Cash'); setBillType('REAL');
                            skipAutosave.current = true;
                            AsyncStorage.removeItem('current_billing_draft').catch(() => {});
                            setTimeout(() => { skipAutosave.current = false; }, 300);
                        }}
                        style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                        <Text style={{ color: '#ef4444', fontFamily: FONTS.semibold, fontSize: 12 }}>Cancel Editing</Text>
                    </TouchableOpacity>
                </View>
            )}
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
                        placeholderTextColor={colors.text.muted}
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
                                <Text style={styles.dropdownEmpty}>Will auto-create as new customer</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Company Name */}
                {billType !== 'QUOTATION' && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Company Name</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type or select company..."
                            placeholderTextColor={colors.text.muted}
                            value={companyName}
                            onChangeText={t => { setCompanyName(t); setShowCompanyDD(true); }}
                            onFocus={() => setShowCompanyDD(true)}
                            onBlur={() => setTimeout(() => setShowCompanyDD(false), 200)}
                        />
                        {showCompanyDD && (companyName.trim().length > 0 || filteredCompanies.length > 0) && (
                            <View style={styles.dropdown}>
                                {filteredCompanies.slice(0, 6).map((c, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.dropdownItem}
                                        onPress={() => { setCompanyName(c); setShowCompanyDD(false); }}
                                    >
                                        <Text style={styles.dropdownItemTxt} numberOfLines={1}>🏢 {c}</Text>
                                    </TouchableOpacity>
                                ))}
                                {isNewCompany && (
                                    <TouchableOpacity
                                        style={[styles.dropdownItem, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}
                                        onPress={() => { setShowCompanyDD(false); }}
                                    >
                                        <Text style={[styles.dropdownItemTxt, { color: colors.accent.primary }]}>
                                            ✚ Use "{companyName.trim()}" as new company
                                        </Text>
                                        <Text style={styles.dropdownItemSub}>Will be saved when bill is created</Text>
                                    </TouchableOpacity>
                                )}
                                {filteredCompanies.length === 0 && !isNewCompany && (
                                    <Text style={[styles.dropdownEmpty, { padding: 12 }]}>No companies found</Text>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Payment Method */}
                {billType !== 'QUOTATION' && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Payment Method</Text>
                        <View style={styles.billTypeRow}>
                            {['Cash', 'Online', 'Split'].map(pm => (
                                <TouchableOpacity
                                    key={pm}
                                    style={[styles.billTypeBtn, paymentMethod === pm && styles.billTypeBtnActive]}
                                    onPress={() => setPaymentMethod(pm)}
                                >
                                    <Text style={[styles.billTypeTxt, paymentMethod === pm && styles.billTypeTxtActive]}>
                                        {pm === 'Online' ? '📱 Online' : (pm === 'Cash' ? '💵 Cash' : '🔀 Split')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        
                        {paymentMethod === 'Split' && (
                            <View style={[styles.row, { marginTop: 12 }]}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 6, marginBottom: 0 }]}>
                                    <Text style={styles.inputLabel}>Cash Amount (Rs)</Text>
                                    <TextInput 
                                        style={styles.textInput} keyboardType="numeric" 
                                        value={splitCash} 
                                        onChangeText={(val) => {
                                            setSplitCash(val);
                                            const targetAmt = billType === 'CREDIT' ? Number(paidAmount || 0) : totalAmount;
                                            if (val === '') {
                                                setSplitOnline(String(targetAmt));
                                            } else if (!isNaN(Number(val)) && Number(val) >= 0) {
                                                setSplitOnline(String(Math.max(0, targetAmt - Number(val))));
                                            }
                                        }}
                                        placeholder="0" placeholderTextColor={colors.text.muted} 
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 6, marginBottom: 0 }]}>
                                    <Text style={styles.inputLabel}>Online Amount (Rs)</Text>
                                    <TextInput 
                                        style={styles.textInput} keyboardType="numeric" 
                                        value={splitOnline} 
                                        onChangeText={(val) => {
                                            setSplitOnline(val);
                                            const targetAmt = billType === 'CREDIT' ? Number(paidAmount || 0) : totalAmount;
                                            if (val === '') {
                                                setSplitCash(String(targetAmt));
                                            } else if (!isNaN(Number(val)) && Number(val) >= 0) {
                                                setSplitCash(String(Math.max(0, targetAmt - Number(val))));
                                            }
                                        }}
                                        placeholder="0" placeholderTextColor={colors.text.muted} 
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Credit Specific Fields */}
                {billType === 'CREDIT' && (
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 6 }]}>
                            <Text style={styles.inputLabel}>Phone *</Text>
                            <TextInput 
                                style={styles.textInput} keyboardType="phone-pad" 
                                value={buyerPhone} onChangeText={setBuyerPhone} 
                                placeholder="03xx-xxxxxxx" placeholderTextColor={colors.text.muted} 
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 6 }]}>
                            <Text style={styles.inputLabel}>Paid Now (Rs)</Text>
                            <TextInput 
                                style={styles.textInput} keyboardType="numeric" 
                                value={paidAmount} onChangeText={setPaidAmount} 
                                placeholder="0" placeholderTextColor={colors.text.muted} 
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
                        <Icon name="cube-outline" size={18} color={colors.text.secondary} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                            {selectedProduct ? (
                                <>
                                    <Text style={styles.pickerBtnTxt} numberOfLines={1}>{selectedProduct.name}</Text>
                                    <Text style={styles.pickerBtnSub}>
                                        <Text style={{color: colors.accent.primary}}>{formatProductId(selectedProduct.id)}</Text> | Rs. {selectedProduct.price} | Stock: {selectedProduct.remaining_quantity}
                                    </Text>
                                </>
                            ) : (
                                <Text style={[styles.pickerBtnTxt, {color: colors.text.muted}]}>Tap to search product...</Text>
                            )}
                        </View>
                        <Icon name="chevron-down" size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.row, { alignItems: 'flex-end', marginTop: 12 }]}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 10, marginBottom: 0 }]}>
                        <Text style={styles.inputLabel}>Quantity</Text>
                        <TextInput 
                            style={styles.textInput} keyboardType="numeric" 
                            value={quantity} onChangeText={setQuantity} 
                            placeholder="1" placeholderTextColor={colors.text.muted} 
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1.5, marginRight: 10, marginBottom: 0 }]}>
                        <Text style={styles.inputLabel}>Unit</Text>
                        <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowUnitPicker(true)}>
                            <Text style={styles.pickerBtnTxt} numberOfLines={1}>{selectedUnit}</Text>
                            <Icon name="chevron-down" size={18} color={colors.text.secondary} />
                        </TouchableOpacity>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.itemCountText}>{cart.length} items</Text>
                        {(cart.length > 0 || buyerSearch || companyName || buyerPhone) && (
                            <TouchableOpacity
                                onPress={() => {
                                    setCart([]);
                                    setBuyerSearch('');
                                    setCompanyName('');
                                    setBuyerPhone('');
                                    setPaidAmount('0');
                                    setSplitCash('');
                                    setSplitOnline('');
                                    setPaymentMethod('Cash');
                                    setBillType('REAL');
                                    setSelectedProduct(null);
                                    setQuantity('1');
                                    setIsEditingGeneratedBill(false);
                                    skipAutosave.current = true;
                                    AsyncStorage.removeItem('current_billing_draft').catch(() => {});
                                    setTimeout(() => { skipAutosave.current = false; }, 300);
                                }}
                                style={styles.cancelBillBtn}
                            >
                                <Icon name="trash-outline" size={12} color="#ef4444" />
                                <Text style={styles.cancelBillBtnTxt}> Cancel Bill</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {cart.length === 0 ? (
                    <View style={styles.emptyCart}>
                        <Icon name="receipt-outline" size={32} color={colors.text.muted} />
                        <Text style={styles.emptyCartTxt}>No items added yet</Text>
                    </View>
                ) : (
                    cart.map((item, index) => (
                        <View key={`${item.id}-${index}`} style={styles.cartItem}>
                            <View style={styles.cartItemDetails}>
                                <Text style={styles.cartItemName}>{item.name}</Text>
                                <Text style={styles.cartItemSub}>
                                    <Text style={{color: colors.accent.primary}}>{formatProductId(item.id)}</Text> | Rs. {item.price} x {item.quantity} {item.cart_unit ? `(${stripPer(item.cart_unit)})` : ''}
                                </Text>
                            </View>
                            <View style={styles.cartItemRight}>
                                <Text style={styles.cartItemTotal}>Rs. {(item.price * item.quantity).toLocaleString()}</Text>
                                <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromCart(item.id)}>
                                    <Icon name="trash-outline" size={18} color={colors.status.danger} />
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
                                <Text style={[styles.totalLabel, { color: colors.status.danger }]}>Remaining (Credit)</Text>
                                <Text style={[styles.totalVal, { color: colors.status.danger, fontWeight: 'bold' }]}>Rs. {remaining.toLocaleString()}</Text>
                            </View>
                        </>
                    )}
                </View>
            )}

            {/* Submit */}
            <TouchableOpacity
                style={[styles.submitBtn, (submitting || !canProceed) && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting || !canProceed}
            >
                {submitting ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.submitBtnTxt}>
                        {billType === 'QUOTATION' ? 'Generate Quotation 🖨️' : `Save ${billType} Bill \u2192`}
                    </Text>
                )}
            </TouchableOpacity>

            {/* Download Last Invoice Banner */}
            {lastSaleData && (
                <TouchableOpacity
                    style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backgroundColor: 'rgba(34, 197, 94, 0.15)', borderWidth: 1,
                        borderColor: 'rgba(34, 197, 94, 0.4)', borderRadius: 12,
                        padding: 14, marginTop: 10
                    }}
                    onPress={async () => {
                        try {
                            await generateInvoicePdf(
                                lastSaleData.transactionInfo,
                                lastSaleData.cartItems,
                                lastSaleData.customerName,
                                lastSaleData.totalBill,
                                lastSaleData.discount,
                                lastSaleData.finalAmount,
                                lastSaleData.customPaymentDate,
                                { kind: lastSaleData.invoiceKind || 'cash_invoice' },
                            );
                        } catch(e) { Alert.alert('Error', 'Could not generate PDF.'); }
                    }}
                >
                    <Icon name="download-outline" size={20} color="#22c55e" />
                    <Text style={{ color: '#22c55e', fontFamily: FONTS.bold, fontSize: 14 }}>
                        Download Last Invoice ({lastSaleData.customerName})
                    </Text>
                </TouchableOpacity>
            )}

            <View style={{height: 10}} />

            {/* Recent generated bill compact row */}
            {recentGeneratedBill && !isEditingGeneratedBill && (
                <View style={styles.recentBillRow}>
                    <Icon name="receipt-outline" size={16} color={colors.accent.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.recentBillName} numberOfLines={1}>
                            {recentGeneratedBill.buyerSearch || 'Walk-in'}
                        </Text>
                        <Text style={styles.recentBillMeta} numberOfLines={1}>
                            {recentGeneratedBill.cart?.length || 0} items • Rs. {(recentGeneratedBill.cart || []).reduce((s, it) => s + (it.price * it.quantity), 0).toLocaleString()}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.recentBillEditBtn}
                        onPress={() => {
                            skipAutosave.current = true;
                            setCart(recentGeneratedBill.cart || []);
                            setBuyerSearch(recentGeneratedBill.buyerSearch || '');
                            setCompanyName(recentGeneratedBill.companyName || '');
                            setBuyerPhone(recentGeneratedBill.buyerPhone || '');
                            setBillType(recentGeneratedBill.billType || 'REAL');
                            setPaidAmount(recentGeneratedBill.paidAmount || '0');
                            setPaymentMethod(recentGeneratedBill.paymentMethod || 'Cash');
                            setSplitCash(recentGeneratedBill.splitCash || '');
                            setSplitOnline(recentGeneratedBill.splitOnline || '');
                            setIsEditingGeneratedBill(true);
                            setTimeout(() => { skipAutosave.current = false; }, 500);
                            useToastStore.getState().showToast('Recovered', 'Recent bill loaded!', 'success');
                        }}
                    >
                        <Text style={styles.recentBillEditTxt}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => { AsyncStorage.removeItem('recent_billing_data').catch(() => {}); setRecentGeneratedBill(null); }}
                        style={{ padding: 6 }}
                    >
                        <Icon name="close-circle-outline" size={18} color={colors.text.muted} />
                    </TouchableOpacity>
                </View>
            )}

            <View style={{height: 20}} />

            {/* Modals */}
            <PickerModal
                visible={showProductPicker}
                onClose={() => setShowProductPicker(false)}
                items={products.filter(p => billType === 'QUOTATION' || p.remaining_quantity >= 1)}
                onSelect={(prod) => {
                    setSelectedProduct(prod);
                    setSelectedUnit(prod.quantity_unit || 'Per Piece');
                }}
                title="Select Product"
                searchKey="name"
                renderSub={p => `${formatProductId(p.id)} | Rs. ${p.price} | Stock: ${p.remaining_quantity}`}
                colors={colors}
                FONTS={FONTS}
            />

            <PickerModal
                visible={showUnitPicker}
                onClose={() => setShowUnitPicker(false)}
                items={UNIT_OPTIONS}
                onSelect={setSelectedUnit}
                title="Select Unit"
                isStringList={true}
                colors={colors}
                FONTS={FONTS}
            />
        </ScrollView>
    );
}

const getStyles = (colors, FONTS) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    content: { padding: 16, paddingBottom: 40 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
    headerTitle: { fontSize: 26, color: colors.text.primary, fontFamily: FONTS.bold, marginBottom: 16 },
    cardSection: {
        backgroundColor: colors.background.secondary,
        borderRadius: 16,
        padding: 20,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: colors.border.color || 'rgba(255,255,255,0.05)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    sectionHeader: {
        fontSize: 18,
        color: colors.text.primary,
        fontFamily: FONTS.semibold,
        marginBottom: 16,
    },
    inputGroup: { marginBottom: 16 },
    inputLabel: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 6 },
    textInput: {
        backgroundColor: colors.background.tertiary, borderRadius: 10, padding: 12,
        color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 14,
        borderWidth: 1, borderColor: colors.border.color,
    },
    pickerBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background.tertiary, borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: colors.border.color,
    },
    pickerBtnTxt: { flex: 1, color: colors.text.primary, fontFamily: FONTS.semibold, fontSize: 14 },
    pickerBtnSub: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    row: { flexDirection: 'row' },
    addBtn: {
        backgroundColor: colors.accent.primary,
        width: 50, height: 50, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    stockHint: { color: colors.accent.primary, fontFamily: FONTS.medium, fontSize: 12, marginTop: 6 },
    
    // Dropdown
    dropdown: {
        backgroundColor: colors.background.tertiary, borderRadius: 10,
        borderWidth: 1, borderColor: colors.border.color, marginTop: 4,
    },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border.color },
    dropdownItemTxt: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 14 },
    dropdownItemSub: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    dropdownEmpty: { color: colors.text.secondary, padding: 12, fontFamily: FONTS.regular, fontStyle: 'italic' },
    
    // Bill Types
    billTypeRow: { flexDirection: 'row', gap: 8 },
    billTypeBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 10,
        backgroundColor: colors.background.tertiary, borderWidth: 1, borderColor: colors.border.color,
        alignItems: 'center',
    },
    billTypeBtnActive: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    billTypeTxt: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 12 },
    billTypeTxtActive: { color: '#fff' },
    
    // Cart
    cartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    itemCountText: { color: colors.accent.primary, fontFamily: FONTS.medium, fontSize: 13 },
    cancelBillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.35)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    cancelBillBtnTxt: { color: '#ef4444', fontFamily: FONTS.semibold, fontSize: 12 },
    recentBillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99,102,241,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.25)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 6,
    },
    recentBillName: { color: colors.text.primary, fontFamily: FONTS.semibold, fontSize: 14 },
    recentBillMeta: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 },
    recentBillEditBtn: {
        backgroundColor: colors.accent.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        marginHorizontal: 8,
    },
    recentBillEditTxt: { color: '#fff', fontFamily: FONTS.semibold, fontSize: 13 },
    emptyCart: { alignItems: 'center', padding: 20 },
    emptyCartTxt: { color: colors.text.muted, fontFamily: FONTS.regular, marginTop: 8 },
    cartItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.color,
    },
    cartItemDetails: { flex: 1 },
    cartItemName: { color: colors.text.primary, fontFamily: FONTS.semibold, fontSize: 15 },
    cartItemSub: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 13, marginTop: 2 },
    cartItemRight: { flexDirection: 'row', alignItems: 'center' },
    cartItemTotal: { color: colors.text.primary, fontFamily: FONTS.semibold, fontSize: 15, marginRight: 12 },
    removeBtn: { padding: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6 },
    
    // Totals
    totalCard: {
        backgroundColor: colors.background.secondary, borderRadius: 16, padding: 20,
        borderWidth: 1, borderColor: colors.border.color || 'rgba(255,255,255,0.05)', marginBottom: 24,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
    },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    totalBorder: { borderTopWidth: 1, borderTopColor: colors.border.color, marginTop: 8, paddingTop: 12, marginBottom: 6 },
    totalLabel: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 15 },
    totalVal: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 15 },
    totalLabelBig: { color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 18 },
    totalValBig: { color: colors.accent.primary, fontFamily: FONTS.bold, fontSize: 20 },
    
    // Submit
    submitBtn: { 
        backgroundColor: colors.accent.primary, 
        borderRadius: 14, 
        padding: 18, 
        alignItems: 'center',
        shadowColor: colors.accent.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    submitBtnTxt: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
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
    itemSub: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 },
    empty: { color: colors.text.secondary, textAlign: 'center', padding: 24, fontFamily: FONTS.regular },
});
