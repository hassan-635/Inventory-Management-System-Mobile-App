import React, { useState, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    RefreshControl, TextInput, TouchableOpacity, Modal,
    Alert, ScrollView, Dimensions, useWindowDimensions
} from 'react-native';
import api from '../api/apiClient';
import { useAppTheme } from '../theme/useAppTheme';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';
import { flatListPerformanceProps } from '../utils/listPerf';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';

const SORT_OPTIONS = [
    { key: 'balanceDesc', label: 'Highest Payable (Receivable)' },
    { key: 'balanceAsc', label: 'Lowest Payable (Receivable)' },
    { key: 'nameAsc', label: 'Name (A-Z)' },
    { key: 'nameDesc', label: 'Name (Z-A)' },
    { key: 'salesDesc', label: 'Highest Sales' },
    { key: 'salesAsc', label: 'Lowest Sales' },
];

const FILTER_OPTIONS = [
    { key: 'all', label: 'All Companies' },
    { key: 'pending', label: 'Pending Receivables' },
    { key: 'cleared', label: 'Fully Paid' },
];

export default function CompaniesScreen() {
    const { colors, FONTS } = useAppTheme();
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const styles = useMemo(() => getStyles(colors, FONTS, SCREEN_WIDTH), [colors, FONTS, SCREEN_WIDTH]);
    
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [sortOption, setSortOption] = useState('balanceDesc');
    const [filterOption, setFilterOption] = useState('all');
    const [showSortPicker, setShowSortPicker] = useState(false);
    const [showFilterPicker, setShowFilterPicker] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [payModal, setPayModal] = useState({ visible: false, company: null });
    const [payAmount, setPayAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Company Payment');
    const [cashAmount, setCashAmount] = useState('');
    const [onlineAmount, setOnlineAmount] = useState('');
    const [paying, setPaying] = useState(false);

    const fetchCompanies = useCallback(async () => {
        try {
            const res = await api.get('/buyers/companies');
            setCompanies(res.data);
        } catch (err) {
            console.error('Failed to load companies:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useRefetchOnFocus(fetchCompanies);
    const onRefresh = () => { setRefreshing(true); fetchCompanies(); };

    const filtered = useMemo(() => {
        let list = companies.filter(c =>
            (c.company_name || '').toLowerCase().includes(search.toLowerCase())
        );

        if (filterOption === 'pending') {
            list = list.filter(c => (c.total_remaining || 0) > 0);
        } else if (filterOption === 'cleared') {
            list = list.filter(c => (c.total_remaining || 0) <= 0);
        }

        return list.sort((a,b) => {
            const remA = a.total_remaining || 0;
            const remB = b.total_remaining || 0;

            if (sortOption === 'balanceDesc') {
                if(remA === 0 && remB === 0) return (a.company_name || '').localeCompare(b.company_name || '');
                return remB - remA;
            }
            if (sortOption === 'balanceAsc') {
                 if(remA === 0 && remB === 0) return (a.company_name || '').localeCompare(b.company_name || '');
                 return remA - remB;
            }
            if (sortOption === 'nameAsc') return (a.company_name || '').localeCompare(b.company_name || '');
            if (sortOption === 'nameDesc') return (b.company_name || '').localeCompare(a.company_name || '');
            if (sortOption === 'salesDesc') return (b.total_amount || 0) - (a.total_amount || 0);
            if (sortOption === 'salesAsc') return (a.total_amount || 0) - (b.total_amount || 0);
            return 0;
        });

    }, [companies, search, filterOption, sortOption]);

    const handlePay = async () => {
        const amount = parseFloat(payAmount);
        if (!amount || amount <= 0) {
            useToastStore.getState().showToast('Invalid Amount', 'Please enter a valid amount', 'error');
            return;
        }
        const company = payModal.company;
        if (amount > company.total_remaining) {
            Alert.alert('Excess Amount', `Company max Rs. ${company.total_remaining} is owed to you (please receive it).`);
            return;
        }

        if (paymentMethod === 'Split') {
            const parsedCash = Number(cashAmount || 0);
            const parsedOnline = Number(onlineAmount || 0);
            if (parsedCash < 0 || parsedOnline < 0) {
                useToastStore.getState().showToast('Invalid Amount', 'Split amounts cannot be negative', 'error');
                return;
            }
            if (Math.abs((parsedCash + parsedOnline) - amount) > 0.01) {
                useToastStore.getState().showToast('Invalid Amount', `Split amounts (${parsedCash} + ${parsedOnline}) must equal the paid amount (${amount})`, 'error');
                return;
            }
        }
        
        Alert.alert(
            'Confirm Payment',
            `Receive payment of Rs. ${amount} from ${company.company_name}? This will be distributed across all ${company.buyers.length} customers in this company.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Receive Payment',
                    style: 'default',
                    onPress: async () => {
                        setPaying(true);
                        try {
                            await api.post('/buyers/company-payment', {
                                company_name: company.company_name,
                                payment_amount: amount,
                                date: new Date().toISOString().split('T')[0],
                                payment_method: paymentMethod,
                                cash_amount: Number(cashAmount || 0),
                                online_amount: Number(onlineAmount || 0)
                            });
                            
                            useToastStore.getState().showToast('Payment Successful!', `Rs. ${amount} distributed across ${company.buyers.length} customers`, 'success');
                            setPayModal({ visible: false, company: null });
                            setPayAmount('');
                            setPaymentMethod('Company Payment');
                            setCashAmount('');
                            setOnlineAmount('');
                            fetchCompanies();
                        } catch (err) {
                            useToastStore.getState().showToast('Error', 'Payment failed. Please try again.', 'error');
                            console.error(err);
                        } finally {
                            setPaying(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    const renderCompany = ({ item }) => {
        const isExpanded = expandedId === item.company_name;
        const hasBalance = item.total_remaining > 0;

        return (
            <TouchableOpacity
                style={[styles.card, hasBalance && styles.cardAlert]}
                activeOpacity={0.85}
                onPress={() => setExpandedId(isExpanded ? null : item.company_name)}
            >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardIconWrap}>
                        <Icon name="business" size={22} color={colors.accent.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.companyName} numberOfLines={1}>{item.company_name}</Text>
                        <Text style={styles.buyerCount}>{item.buyers?.length || 0} customers</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.dueLabel, { color: hasBalance ? colors.status.danger : colors.status.success }]}>
                            {hasBalance ? `Rs. ${item.total_remaining.toLocaleString()}` : '✓ Clear'}
                        </Text>
                        <Text style={styles.totalSalesLabel}>
                            Total: Rs. {item.total_amount.toLocaleString()}
                        </Text>
                    </View>
                    <Icon
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.text.muted || colors.text.secondary}
                        style={{ marginLeft: 8 }}
                    />
                </View>

                {/* Expanded Content */}
                {isExpanded && (
                    <View style={styles.expandedContent}>
                        {/* Summary Row */}
                        <View style={styles.summaryRow}>
                            <View style={styles.summaryBox}>
                                <Text style={styles.summaryBoxLabel}>Total Sales</Text>
                                <Text style={styles.summaryBoxValue}>Rs. {item.total_amount.toLocaleString()}</Text>
                            </View>
                            <View style={[styles.summaryBox, { borderColor: colors.status.success }]}>
                                <Text style={styles.summaryBoxLabel}>Paid</Text>
                                <Text style={[styles.summaryBoxValue, { color: colors.status.success }]}>Rs. {item.total_paid.toLocaleString()}</Text>
                            </View>
                            <View style={[styles.summaryBox, { borderColor: hasBalance ? colors.status.danger : colors.status.success }]}>
                                <Text style={styles.summaryBoxLabel}>Pending</Text>
                                <Text style={[styles.summaryBoxValue, { color: hasBalance ? colors.status.danger : colors.status.success }]}>
                                    Rs. {item.total_remaining.toLocaleString()}
                                </Text>
                            </View>
                        </View>

                        {/* Buyers List */}
                        {(item.buyers || []).map((buyer) => {
                            const bDue = (buyer.buyer_transactions || []).reduce(
                                (acc, t) => acc + Math.max(0, Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0
                            );
                            return (
                                <View key={buyer.id} style={styles.buyerRow}>
                                    <Icon name="person-outline" size={14} color={colors.text.secondary} />
                                    <Text style={styles.buyerName} numberOfLines={1}>{buyer.name}</Text>
                                    <Text style={[styles.buyerDue, { color: bDue > 0 ? colors.status.danger : colors.status.success }]}>
                                        {bDue > 0 ? `-Rs. ${bDue.toLocaleString()}` : '✓'}
                                    </Text>
                                </View>
                            );
                        })}

                        {/* Pay Button */}
                        {hasBalance && (
                            <TouchableOpacity
                                style={styles.payBtn}
                                onPress={() => setPayModal({ visible: true, company: item })}
                            >
                                <Icon name="cash-outline" size={16} color="#fff" />
                                <Text style={styles.payBtnText}>Receive payment</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Companies (customers owe you)</Text>

            {/* Search */}
            <View style={[styles.searchSortRow, { paddingHorizontal: 16, marginBottom: 10 }]}>
                <View style={[styles.searchRow, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}>
                    <Icon name="search-outline" size={18} color={colors.text.secondary} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search company name..."
                        placeholderTextColor={colors.text.muted || colors.text.secondary}
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
                        {FILTER_OPTIONS.find(o => o.key === filterOption)?.label || 'All Companies'}
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

            {/* Summary Bar */}
            <View style={styles.summaryBar}>
                <Text style={styles.summaryBarText}>
                    {filtered.length} companies • customers owe you{' '}
                    <Text style={{ color: colors.status.danger }}>
                        Rs. {filtered.reduce((s, c) => s + c.total_remaining, 0).toLocaleString()}
                    </Text>
                </Text>
            </View>

            <FlatList
                {...flatListPerformanceProps}
                data={filtered}
                keyExtractor={(item) => item.company_name}
                renderItem={renderCompany}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
                contentContainerStyle={[styles.listContent, SCREEN_WIDTH > 768 && { paddingHorizontal: 32 }]}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <Icon name="business-outline" size={48} color={colors.text.secondary} />
                        <Text style={styles.emptyText}>No companies found</Text>
                    </View>
                }
            />

            {/* Payment Modal */}
            <Modal visible={payModal.visible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, SCREEN_WIDTH > 768 && { width: '60%', alignSelf: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
                        <Text style={styles.modalTitle}>Receive payment — {payModal.company?.company_name}</Text>
                        <Text style={styles.modalSub}>
                            Unpaid / credit (you have to receive): Rs. {payModal.company?.total_remaining?.toLocaleString()}
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Enter amount"
                            placeholderTextColor={colors.text.muted || colors.text.secondary}
                            keyboardType="numeric"
                            value={payAmount}
                            onChangeText={setPayAmount}
                        />

                        {payAmount > 0 && (
                            <View style={{ marginBottom: 16 }}>
                                <Text style={{ color: colors.text.secondary, fontSize: 13, marginBottom: 6, fontFamily: FONTS.medium }}>Payment Method</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    {['Company Payment', 'Cash', 'Online', 'Split'].map(pm => (
                                        <TouchableOpacity
                                            key={pm}
                                            style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.background.primary, borderWidth: 1, borderColor: colors.border.color }, paymentMethod === pm && { backgroundColor: 'rgba(56,189,248,0.1)', borderColor: '#38bdf8' }]}
                                            onPress={() => setPaymentMethod(pm)}
                                        >
                                            <Text style={[{ fontFamily: FONTS.medium, color: colors.text.primary, fontSize: 11, textAlign: 'center' }, paymentMethod === pm && { color: '#38bdf8', fontFamily: FONTS.bold }]}>
                                                {pm === 'Company Payment' ? '🏢 Default' : pm === 'Online' ? '📱 Online' : (pm === 'Cash' ? '💵 Cash' : '🔀 Split')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                
                                {paymentMethod === 'Split' && (
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text.secondary, fontSize: 11, marginBottom: 4 }}>Cash Amount</Text>
                                            <TextInput style={[styles.modalInput, { marginBottom: 0 }]} value={cashAmount} onChangeText={setCashAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted || colors.text.secondary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text.secondary, fontSize: 11, marginBottom: 4 }}>Online Amount</Text>
                                            <TextInput style={[styles.modalInput, { marginBottom: 0 }]} value={onlineAmount} onChangeText={setOnlineAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted || colors.text.secondary} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        <View style={styles.modalBtns}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.background.tertiary }]}
                                onPress={() => { setPayModal({ visible: false, company: null }); setPayAmount(''); setPaymentMethod('Company Payment'); setCashAmount(''); setOnlineAmount(''); }}
                            >
                                <Text style={{ color: colors.text.primary, fontFamily: FONTS.medium }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handlePay} disabled={paying}>
                                {paying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontFamily: FONTS.bold }}>Record</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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
        </View>
    );
}

const getStyles = (colors, FONTS, SCREEN_WIDTH) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
    title: {
        fontSize: Math.min(24, SCREEN_WIDTH * 0.063),
        color: colors.text.primary,
        fontFamily: FONTS.bold,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },

    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginBottom: 8,
        backgroundColor: colors.background.secondary,
        borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.border.color,
    },
    searchInput: { flex: 1, color: colors.text.primary, fontFamily: FONTS.regular, fontSize: 14 },

    summaryBar: {
        marginHorizontal: 16, marginBottom: 10,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    },
    summaryBarText: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },

    listContent: { padding: 16, paddingBottom: 40 },

    card: {
        backgroundColor: colors.background.secondary,
        borderRadius: 16, marginBottom: 16,
        borderWidth: 1, borderColor: colors.border.color || 'rgba(255,255,255,0.05)',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
        overflow: 'hidden',
    },
    cardAlert: { borderColor: 'rgba(239,68,68,0.3)' },

    cardHeader: {
        flexDirection: 'row', alignItems: 'center',
        padding: 14, gap: 10,
    },
    cardIconWrap: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(99,102,241,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    companyName: {
        color: colors.text.primary, fontFamily: FONTS.bold,
        fontSize: Math.min(15, SCREEN_WIDTH * 0.038),
    },
    buyerCount: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 12 },
    dueLabel: { fontFamily: FONTS.bold, fontSize: Math.min(14, SCREEN_WIDTH * 0.035) },
    totalSalesLabel: { color: colors.text.secondary, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 },

    expandedContent: {
        borderTopWidth: 1, borderTopColor: colors.border.color,
        padding: 14, paddingTop: 10,
    },

    summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    summaryBox: {
        flex: 1, borderWidth: 1, borderColor: colors.border.color,
        borderRadius: 8, padding: 8, alignItems: 'center',
    },
    summaryBoxLabel: { color: colors.text.secondary, fontSize: 10, fontFamily: FONTS.medium, marginBottom: 3 },
    summaryBoxValue: { color: colors.text.primary, fontSize: 12, fontFamily: FONTS.bold },

    buyerRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 6, paddingVertical: 5,
        borderBottomWidth: 1, borderBottomColor: colors.border.color,
    },
    buyerName: {
        flex: 1, color: colors.text.secondary,
        fontFamily: FONTS.regular, fontSize: 13,
    },
    buyerDue: { fontFamily: FONTS.medium, fontSize: 13 },

    payBtn: {
        marginTop: 16, backgroundColor: colors.accent.primary,
        borderRadius: 12, paddingVertical: 12,
        flexDirection: 'row', justifyContent: 'center',
        alignItems: 'center', gap: 8,
        shadowColor: colors.accent.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    },
    payBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 14 },

    emptyWrap: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: colors.text.secondary, fontFamily: FONTS.regular, marginTop: 12, fontSize: 15 },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: colors.background.secondary,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 24, paddingBottom: 36,
    },
    modalTitle: { color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 4 },
    modalSub: { color: colors.status.danger, fontFamily: FONTS.medium, fontSize: 14, marginBottom: 16 },
    modalInput: {
        backgroundColor: colors.background.primary,
        borderWidth: 1, borderColor: colors.border.color,
        borderRadius: 10, color: colors.text.primary,
        padding: 14, fontSize: 16, fontFamily: FONTS.regular,
        marginBottom: 16,
    },
    modalBtns: { flexDirection: 'row', gap: 12 },
    modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    modalBtnPrimary: { backgroundColor: colors.accent.primary },
});
