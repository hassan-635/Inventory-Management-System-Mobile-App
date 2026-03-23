import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TextInput, TouchableOpacity, Modal, Alert, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { suppliersService } from '../api/suppliers';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';

export default function SuppliersScreen() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    // CRUD State
    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [formItem, setFormItem] = useState({ id: null, name: '', phone: '', company_name: '', payment_amount: '', txn_due: 0, payment_date: new Date() });

    const fetchSuppliers = async () => {
        try {
            const data = await suppliersService.getAll();
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to fetch suppliers:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchSuppliers(); }, []);
    const onRefresh = () => { setRefreshing(true); fetchSuppliers(); };

    // CRUD Functions
    const openModal = (supplier = null) => {
        if (supplier) {
            const txnDue = (supplier.supplier_transactions || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);
            setFormItem({
                id: supplier.id,
                name: supplier.name || '',
                phone: supplier.phone || '',
                company_name: supplier.company_name || '',
                payment_amount: '',
                payment_date: new Date(),
                txn_due: txnDue
            });
        } else {
            setFormItem({ id: null, name: '', phone: '', company_name: '', payment_amount: '', txn_due: 0, payment_date: new Date() });
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formItem.name) {
            useToastStore.getState().showToast("Error", "Supplier name is required.", "error");
            return;
        }
        
        const payload = { ...formItem };
        if (formItem.id && formItem.payment_amount) {
            const payAmt = Number(formItem.payment_amount);
            if (payAmt > formItem.txn_due) {
                useToastStore.getState().showToast('Error', 'Payment cannot exceed remaining amount: Rs. ' + formItem.txn_due, 'error');
                return;
            }
            if (payAmt < 0) {
                useToastStore.getState().showToast('Error', 'Payment amount cannot be negative.', 'error');
                return;
            }
            payload.payment_amount = payAmt;
            payload.date = formItem.payment_date.toISOString().split('T')[0];
        }

        setIsSaving(true);
        try {
            if (formItem.id) {
                await suppliersService.update(formItem.id, payload);
            } else {
                await suppliersService.create(payload);
            }
            setModalVisible(false);
            useToastStore.getState().showToast('Saved', 'Supplier saved successfully!', 'success');
            fetchSuppliers();
        } catch (error) {
            console.error("Save supplier error", error);
            useToastStore.getState().showToast("Error", error.response?.data?.error || "Could not save supplier.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = (id) => {
        Alert.alert("Delete Supplier", "Are you sure you want to delete this supplier?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await suppliersService.delete(id);
                        useToastStore.getState().showToast('Deleted', 'Supplier deleted successfully!', 'success');
                        fetchSuppliers();
                    } catch (err) {
                        useToastStore.getState().showToast("Error", err.response?.data?.error || "Could not delete supplier. Make sure they have no linked transactions.", "error");
                    }
                }
            }
        ]);
    };

    const computeDue = (txns) =>
        (txns || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);

    const computePaid = (txns) =>
        (txns || []).reduce((acc, t) => acc + Number(t.paid_amount || 0), 0);

    const filteredSuppliers = suppliers.filter(s =>
        s.name?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Suppliers Directory</Text>

            <View style={styles.searchRow}>
                <Icon name="search-outline" size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search suppliers..."
                    placeholderTextColor={COLORS.text.muted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList
                data={filteredSuppliers}
                keyExtractor={(item, index) => (item.id || index).toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                    const due = computeDue(item.supplier_transactions);
                    const paid = computePaid(item.supplier_transactions);
                    return (
                        <ExpandableItem
                            title={item.name}
                            subtitle={item.company_name || item.phone || null}
                            rightText={due > 0 ? `Due: Rs. ${due.toLocaleString()}` : '✓ Cleared'}
                            iconName="business-outline"
                            detailsData={{
                                'Phone': item.phone || 'N/A',
                                'Company': item.company_name || 'N/A',
                                'Total Paid': `Rs. ${paid.toLocaleString()}`,
                                'Remaining Due': `Rs. ${due.toLocaleString()}`,
                            }}
                            renderExtra={() => (
                                <>
                                    {(item.supplier_transactions || []).length > 0 && (
                                        <View style={{ marginTop: 10 }}>
                                            <Text style={[styles.inputLabel, { marginBottom: 6, fontSize: 12, letterSpacing: 0.5 }]}>📦 PURCHASE HISTORY</Text>
                                            {item.supplier_transactions.map((txn, idx) => {
                                                const purchaseRate = txn.quantity > 0 ? Math.round(Number(txn.total_amount) / Number(txn.quantity)) : 0;
                                                const remaining = Number(txn.total_amount || 0) - Number(txn.paid_amount || 0);
                                                return (
                                                    <View key={txn.id || idx} style={styles.txnCard}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                            <Text style={styles.txnProduct}>{txn.products?.name || `Product #${txn.product_id}`}</Text>
                                                            <Text style={[styles.txnRemaining, { color: remaining > 0 ? '#f87171' : '#4ade80' }]}>
                                                                {remaining > 0 ? `Due: Rs. ${remaining.toLocaleString()}` : '✓ Paid'}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.txnRow}>
                                                            <View style={styles.txnCell}>
                                                                <Text style={styles.txnLabel}>Qty</Text>
                                                                <Text style={styles.txnValue}>{txn.quantity}</Text>
                                                            </View>
                                                            <View style={styles.txnCell}>
                                                                <Text style={styles.txnLabel}>Rate/Unit</Text>
                                                                <Text style={styles.txnValue}>Rs. {purchaseRate.toLocaleString()}</Text>
                                                            </View>
                                                            <View style={styles.txnCell}>
                                                                <Text style={styles.txnLabel}>Total</Text>
                                                                <Text style={styles.txnValue}>Rs. {Number(txn.total_amount).toLocaleString()}</Text>
                                                            </View>
                                                            <View style={styles.txnCell}>
                                                                <Text style={styles.txnLabel}>Paid</Text>
                                                                <Text style={[styles.txnValue, { color: '#4ade80' }]}>Rs. {Number(txn.paid_amount).toLocaleString()}</Text>
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
                ListEmptyComponent={<Text style={styles.emptyText}>No suppliers found.</Text>}
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
                            <Text style={styles.modalTitle}>{formItem.id ? 'Edit Supplier' : 'Add Supplier'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={COLORS.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Supplier Name *</Text>
                            <TextInput style={styles.input} value={formItem.name} onChangeText={t => setFormItem({...formItem, name: t})} placeholder="Enter name" placeholderTextColor={COLORS.text.muted} />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput style={styles.input} value={formItem.phone} onChangeText={t => setFormItem({...formItem, phone: t})} keyboardType="phone-pad" placeholder="Enter phone (optional)" placeholderTextColor={COLORS.text.muted} />

                            <Text style={styles.inputLabel}>Company Name</Text>
                            <TextInput style={styles.input} value={formItem.company_name} onChangeText={t => setFormItem({...formItem, company_name: t})} placeholder="Company Name (optional)" placeholderTextColor={COLORS.text.muted} />
                            
                            {formItem.id && formItem.txn_due > 0 && (
                                <>
                                    <View style={{ height: 1, backgroundColor: COLORS.border.color, marginVertical: 10 }} />
                                    <Text style={[styles.inputLabel, { color: COLORS.accent.primary, fontWeight: 'bold' }]}>Make Payment (Rs) <Text style={{color: COLORS.text.muted, fontSize: 12}}>(max: {formItem.txn_due})</Text></Text>
                                    <Text style={{ fontSize: 11, color: COLORS.text.muted, marginBottom: 8 }}>Pay off oldest unpaid bills sequentially.</Text>
                                    <TextInput style={styles.input} value={formItem.payment_amount} onChangeText={t => setFormItem({...formItem, payment_amount: t})} keyboardType="numeric" placeholder="Enter amount..." placeholderTextColor={COLORS.text.muted} />

                                    <Text style={styles.inputLabel}>Payment Date</Text>
                                    <TouchableOpacity 
                                        style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={{ color: COLORS.text.primary, fontFamily: FONTS.regular }}>
                                            {formItem.payment_date.toLocaleDateString()}
                                        </Text>
                                        <Icon name="calendar-outline" size={18} color={COLORS.text.secondary} />
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
    inputLabel: { color: COLORS.text.secondary, fontSize: 13, marginBottom: 6, fontFamily: FONTS.medium },
    input: { backgroundColor: COLORS.background.primary, color: COLORS.text.primary, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border.color, fontFamily: FONTS.regular },
    
    modalFooter: { flexDirection: 'row', gap: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border.color },
    cancelBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.background.primary, alignItems: 'center' },
    cancelBtnText: { color: COLORS.text.secondary, fontFamily: FONTS.bold, fontSize: 16 },
    saveBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.accent.primary, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },

    txnCard: {
        backgroundColor: COLORS.background.primary,
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.border.color,
    },
    txnProduct: { color: COLORS.text.primary, fontFamily: FONTS.semibold, fontSize: 13 },
    txnRemaining: { fontSize: 12, fontFamily: FONTS.medium },
    txnRow: { flexDirection: 'row', marginTop: 4, gap: 4 },
    txnCell: { flex: 1, alignItems: 'center', backgroundColor: COLORS.background.secondary, borderRadius: 6, padding: 6 },
    txnLabel: { color: COLORS.text.muted, fontSize: 10, fontFamily: FONTS.regular, marginBottom: 2 },
    txnValue: { color: COLORS.text.primary, fontSize: 12, fontFamily: FONTS.medium },
});
