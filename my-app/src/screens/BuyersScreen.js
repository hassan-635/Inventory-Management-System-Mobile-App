import React, { useEffect, useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    RefreshControl, TextInput, TouchableOpacity, Modal,
    Alert, ScrollView, Platform, useWindowDimensions
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { buyersService } from '../api/buyers';
import { useAppTheme } from '../theme/useAppTheme';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';

export default function BuyersScreen() {
    const { colors, FONTS } = useAppTheme();
    const { width: SW } = useWindowDimensions();
    const styles = useMemo(() => getStyles(colors, FONTS, SW), [colors, FONTS, SW]);

    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    // Form modal
    const [modalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [formItem, setFormItem] = useState({
        id: null, name: '', phone: '', company_name: '', address: '',
        payment_amount: '', txn_due: 0, payment_date: new Date()
    });

    const fetchBuyers = async () => {
        try {
            const data = await buyersService.getAll();
            setBuyers(data);
        } catch (e) {
            console.error('Failed to fetch customers:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchBuyers(); }, []);
    const onRefresh = () => { setRefreshing(true); fetchBuyers(); };

    const filtered = useMemo(() => buyers.filter(b =>
        (b.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.phone || '').includes(search)
    ), [buyers, search]);

    const filteredPending = useMemo(() =>
        filtered.reduce((sum, b) =>
            sum + (b.buyer_transactions || []).reduce((s, t) =>
                s + Math.max(0, Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0), 0),
        [filtered]);

    const computeDue = (txns = []) => txns.reduce((s, t) => s + Math.max(0, Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);
    const computePaid = (txns = []) => txns.reduce((s, t) => s + Number(t.paid_amount || 0), 0);

    const openModal = (buyer = null) => {
        if (buyer) {
            const txnDue = computeDue(buyer.buyer_transactions);
            setFormItem({ id: buyer.id, name: buyer.name || '', phone: buyer.phone || '', company_name: buyer.company_name || '', address: buyer.address || '', payment_amount: '', txn_due: txnDue, payment_date: new Date() });
        } else {
            setFormItem({ id: null, name: '', phone: '', company_name: '', address: '', payment_amount: '', txn_due: 0, payment_date: new Date() });
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formItem.name) { useToastStore.getState().showToast('Error', 'Customer name is required.', 'error'); return; }
        const payload = {
            name: formItem.name.trim(),
            phone: formItem.phone?.trim() || '',
            address: formItem.address?.trim() || '',
            company_name: formItem.company_name?.trim() || null,
        };
        if (formItem.id) {
            const rawPay = String(formItem.payment_amount ?? '').trim();
            if (rawPay !== '') {
                const payAmt = Number(rawPay);
                if (Number.isNaN(payAmt) || payAmt < 0) {
                    useToastStore.getState().showToast('Error', 'Invalid payment amount.', 'error');
                    return;
                }
                if (payAmt > 0) {
                    if (payAmt > formItem.txn_due) {
                        useToastStore.getState().showToast('Error', 'Payment cannot exceed Rs. ' + formItem.txn_due, 'error');
                        return;
                    }
                    payload.payment_amount = payAmt;
                    payload.date = formItem.payment_date.toISOString().split('T')[0];
                }
            }
        }
        setIsSaving(true);
        try {
            if (formItem.id) { await buyersService.update(formItem.id, payload); useToastStore.getState().showToast('Updated!', payload.payment_amount ? 'Payment recorded; profile updated.' : 'Customer updated.', 'success'); }
            else { await buyersService.create(payload); useToastStore.getState().showToast('Added!', 'Customer added.', 'success'); }
            setModalVisible(false);
            fetchBuyers();
        } catch (e) {
            useToastStore.getState().showToast('Error', e.response?.data?.error || 'Failed to save.', 'error');
        } finally { setIsSaving(false); }
    };

    const confirmDelete = (id) => {
        Alert.alert('Delete Customer', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try { await buyersService.delete(id); fetchBuyers(); useToastStore.getState().showToast('Deleted', 'Customer removed.', 'success'); }
                catch (e) { useToastStore.getState().showToast('Error', 'Failed to delete.', 'error'); }
            }}
        ]);
    };

    if (loading && !refreshing) {
        return (<View style={styles.center}><ActivityIndicator size="large" color={colors.accent.primary} /></View>);
    }

    const renderBuyer = ({ item }) => {
        const due = computeDue(item.buyer_transactions);
        const paid = computePaid(item.buyer_transactions);
        const total = due + paid;
        const isExpanded = expandedId === item.id;
        const hasDue = due > 0;

        return (
            <TouchableOpacity
                style={[styles.card, hasDue && styles.cardAlert]}
                activeOpacity={0.85}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardIconWrap}>
                        <Icon name="person" size={22} color={colors.accent.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.itemSub} numberOfLines={1}>
                            {item.company_name
                                ? `${item.company_name}${item.phone ? ` · ${item.phone}` : ''}`
                                : item.phone || 'No phone'}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.dueLabel, { color: hasDue ? colors.status.danger : colors.status.success }]}>
                            {hasDue ? `Rs. ${due.toLocaleString()}` : '✓ Clear'}
                        </Text>
                        <Text style={styles.totalLabel}>Total: Rs. {total.toLocaleString()}</Text>
                    </View>
                    <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.muted || colors.text.secondary} style={{ marginLeft: 8 }} />
                </View>

                {/* Expanded Content */}
                {isExpanded && (
                    <View style={styles.expandedContent}>
                        {/* 3 stat boxes */}
                        <View style={styles.statRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Total Sales</Text>
                                <Text style={styles.statValue}>Rs. {total.toLocaleString()}</Text>
                            </View>
                            <View style={[styles.statBox, { borderColor: colors.status.success }]}>
                                <Text style={styles.statLabel}>Paid</Text>
                                <Text style={[styles.statValue, { color: colors.status.success }]}>Rs. {paid.toLocaleString()}</Text>
                            </View>
                            <View style={[styles.statBox, { borderColor: hasDue ? colors.status.danger : colors.status.success }]}>
                                <Text style={styles.statLabel}>Pending</Text>
                                <Text style={[styles.statValue, { color: hasDue ? colors.status.danger : colors.status.success }]}>Rs. {due.toLocaleString()}</Text>
                            </View>
                        </View>

                        {/* Details */}
                        <View style={styles.detailRows}>
                            {item.phone && <View style={styles.detailRow}><Icon name="call-outline" size={14} color={colors.text.secondary} /><Text style={styles.detailText}>{item.phone}</Text></View>}
                            {item.address && <View style={styles.detailRow}><Icon name="location-outline" size={14} color={colors.text.secondary} /><Text style={styles.detailText}>{item.address}</Text></View>}
                            <View style={styles.detailRow}><Icon name="receipt-outline" size={14} color={colors.text.secondary} /><Text style={styles.detailText}>{item.buyer_transactions?.length || 0} transactions</Text></View>
                            <View style={styles.detailRow}><Icon name="calendar-outline" size={14} color={colors.text.secondary} /><Text style={styles.detailText}>Since {new Date(item.created_at).toLocaleDateString()}</Text></View>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => openModal(item)}>
                                <Icon name="create-outline" size={16} color={colors.text.primary} />
                                <Text style={styles.actionBtnTxt}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => confirmDelete(item.id)}>
                                <Icon name="trash-outline" size={16} color={colors.status.danger} />
                                <Text style={[styles.actionBtnTxt, { color: colors.status.danger }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Customers</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                    <Icon name="add" size={20} color="#fff" />
                    <Text style={styles.addBtnTxt}>Add</Text>
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Icon name="search-outline" size={17} color={colors.text.secondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search customers, company, phone..."
                    placeholderTextColor={colors.text.muted}
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Icon name="close-circle" size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Summary — customers owe you (you receive payment from them) */}
            <View style={styles.summaryBar}>
                <Text style={styles.summaryBarText}>
                    {filtered.length} customers • they owe you{' '}
                    <Text style={{ color: colors.status.danger }}>
                        Rs. {filteredPending.toLocaleString()}
                    </Text>
                </Text>
            </View>

            <FlatList
                data={filtered}
                keyExtractor={item => item.id.toString()}
                renderItem={renderBuyer}
                contentContainerStyle={[styles.listContent, SW > 768 && { paddingHorizontal: 32 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Icon name="people-outline" size={48} color={colors.text.secondary} />
                        <Text style={styles.emptyText}>No customers found</Text>
                    </View>
                }
            />

            {/* Add/Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalTitleRow}>
                            <Text style={styles.modalTitle}>{formItem.id ? 'Edit Customer' : 'Add Customer'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Customer Name *</Text>
                            <TextInput style={styles.input} value={formItem.name} onChangeText={t => setFormItem({ ...formItem, name: t })} placeholder="Enter name" placeholderTextColor={colors.text.muted} />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput style={styles.input} value={formItem.phone} onChangeText={t => setFormItem({ ...formItem, phone: t })} keyboardType="phone-pad" placeholder="03xx-xxxxxxx (optional)" placeholderTextColor={colors.text.muted} />

                            <Text style={styles.inputLabel}>Company Name</Text>
                            <TextInput style={styles.input} value={formItem.company_name} onChangeText={t => setFormItem({ ...formItem, company_name: t })} placeholder="Company (optional)" placeholderTextColor={colors.text.muted} />

                            <Text style={styles.inputLabel}>Address</Text>
                            <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={formItem.address} onChangeText={t => setFormItem({ ...formItem, address: t })} multiline placeholder="Full address (optional)" placeholderTextColor={colors.text.muted} />

                            {!!formItem.id && formItem.txn_due > 0 && (
                                <>
                                    <View style={{ height: 1, backgroundColor: colors.border.color, marginVertical: 12 }} />
                                    <Text style={[styles.inputLabel, { color: colors.accent.primary, fontFamily: FONTS.bold }]}>
                                        Receive payment (they pay you){' '}
                                        <Text style={{ color: colors.text.muted, fontSize: 11, fontFamily: FONTS.regular }}>(max: Rs. {formItem.txn_due})</Text>
                                    </Text>
                                    <TextInput style={styles.input} value={formItem.payment_amount} onChangeText={t => setFormItem({ ...formItem, payment_amount: t })} keyboardType="numeric" placeholder="Enter amount..." placeholderTextColor={colors.text.muted} />

                                    <Text style={styles.inputLabel}>Payment Date</Text>
                                    <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowDatePicker(true)}>
                                        <Text style={{ color: colors.text.primary, fontFamily: FONTS.regular }}>{formItem.payment_date.toLocaleDateString()}</Text>
                                        <Icon name="calendar-outline" size={18} color={colors.text.secondary} />
                                    </TouchableOpacity>
                                    {showDatePicker && (
                                        <DateTimePicker value={formItem.payment_date} mode="date" display="default"
                                            onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setFormItem({ ...formItem, payment_date: d }); }} />
                                    )}
                                </>
                            )}
                            <View style={{ height: 20 }} />
                        </ScrollView>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} disabled={isSaving}>
                                <Text style={styles.cancelBtnTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnTxt}>Save</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (colors, FONTS, SW) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },

    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    headerTitle: { fontSize: Math.min(24, SW * 0.063), color: colors.text.primary, fontFamily: FONTS.bold },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, shadowColor: colors.accent.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
    addBtnTxt: { color: '#fff', fontFamily: FONTS.bold, fontSize: 13 },

    searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.background.secondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: colors.border.color },
    searchInput: { flex: 1, color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 14 },

    summaryBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    summaryBarText: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 13 },

    listContent: { padding: 16, paddingBottom: 40 },

    card: { backgroundColor: colors.background.secondary, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border.color || 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4, overflow: 'hidden' },
    cardAlert: { borderColor: 'rgba(239,68,68,0.3)' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    cardIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.15)', justifyContent: 'center', alignItems: 'center' },
    itemName: { color: colors.text.primary, fontFamily: FONTS.bold, fontSize: Math.min(15, SW * 0.038) },
    itemSub: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12, marginTop: 1 },
    dueLabel: { fontFamily: FONTS.bold, fontSize: Math.min(14, SW * 0.035) },
    totalLabel: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 },

    expandedContent: { borderTopWidth: 1, borderTopColor: colors.border.color, padding: 14, paddingTop: 10 },

    statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    statBox: { flex: 1, borderWidth: 1, borderColor: colors.border.color, borderRadius: 8, padding: 8, alignItems: 'center' },
    statLabel: { color: colors.text.secondary, fontSize: 10, fontFamily: FONTS.medium, marginBottom: 3 },
    statValue: { color: colors.text.primary, fontSize: 13, fontFamily: FONTS.bold },

    detailRows: { gap: 5, marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    detailText: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 13 },

    actionRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background.primary, paddingVertical: 9, borderRadius: 10, gap: 6 },
    actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    actionBtnTxt: { color: colors.text.primary, fontFamily: FONTS.medium, fontSize: 13 },

    emptyWrap: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: colors.text.secondary, fontFamily: FONTS.regular, marginTop: 12, fontSize: 15 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalBox: { backgroundColor: colors.background.secondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36, maxHeight: '88%' },
    modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 18 },
    inputLabel: { color: colors.text.secondary, fontSize: 13, marginBottom: 6, fontFamily: FONTS.medium },
    input: { backgroundColor: colors.background.primary, color: colors.text.primary, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border.color, fontFamily: FONTS.regular },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 10 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.background.primary, alignItems: 'center' },
    cancelBtnTxt: { color: colors.text.secondary, fontFamily: FONTS.bold, fontSize: 15 },
    saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.accent.primary, alignItems: 'center' },
    saveBtnTxt: { color: '#fff', fontFamily: FONTS.bold, fontSize: 15 },
});
