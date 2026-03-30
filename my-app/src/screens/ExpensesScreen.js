import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ScrollView, useWindowDimensions } from 'react-native';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useAppTheme } from '../theme/useAppTheme';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';
import { flatListPerformanceProps } from '../utils/listPerf';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import GenericSideList from '../components/GenericSideList';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const CATEGORIES = ['Petrol', 'Electric Bill', 'Food', 'Rent', 'Maintenance', 'Other'];

export default function ExpensesScreen() {
    const { colors, FONTS } = useAppTheme();
    const { width } = useWindowDimensions();
    const isTablet = width > 768;
    const styles = useMemo(() => getStyles(colors, FONTS, isTablet), [colors, FONTS, isTablet]);

    const { token } = useAuthStore();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Side List State
    const [isSideListVisible, setIsSideListVisible] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [formItem, setFormItem] = useState({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    const [isSaving, setIsSaving] = useState(false);

    // Filter state
    const currentYearStr = new Date().getFullYear().toString();
    const currentMonthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const [filterYear, setFilterYear] = useState(currentYearStr);
    const [filterMonth, setFilterMonth] = useState(currentMonthStr);

    const fetchExpenses = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/expenses?year=${filterYear}&month=${filterMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpenses(res.data);
        } catch (error) {
            console.error('Fetch expenses error:', error);
            useToastStore.getState().showToast("Error", "Could not fetch expenses.", "error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterYear, filterMonth, token]);

    useEffect(() => {
        setLoading(true);
        fetchExpenses();
    }, [fetchExpenses]);

    useRefetchOnFocus(fetchExpenses, [filterYear, filterMonth, token]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchExpenses();
    };

    const handleSave = async () => {
        if (!formItem.category || !formItem.amount) {
            useToastStore.getState().showToast("Error", "Category and amount are required.", "error");
            return;
        }

        // For new expenses, add to pending list instead of direct save
        if (!formItem.id) {
            // Check if expense with same category and amount already exists in pending list
            if (isExpenseInPendingList(formItem.category, formItem.amount)) {
                useToastStore.getState().showToast("Error", "This expense is already in the pending list.", "error");
                return;
            }
            
            const newItem = {
                action: 'add',
                name: `${formItem.category} - Rs.${formItem.amount}`,
                data: formItem
            };
            
            setPendingItems(prev => [...prev, newItem]);
            setIsSideListVisible(true);
            setModalVisible(false);
            return;
        }

        // For existing expenses (edit mode), keep the original logic
        setIsSaving(true);
        try {
            await axios.put(`${API_URL}/expenses/${formItem.id}`, formItem, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setModalVisible(false);
            useToastStore.getState().showToast('Saved', 'Expense saved successfully!', 'success');
            fetchExpenses();
        } catch (error) {
            console.error('Save expense error:', error);
            useToastStore.getState().showToast("Error", "Could not save expense.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = (id) => {
        const expense = expenses.find(e => e.id === id);
        if (!expense) return;
        
        // Check if expense is already in pending list
        if (isExpenseInPendingList(expense.category, expense.amount)) {
            useToastStore.getState().showToast("Error", "This expense is already in the pending list.", "error");
            return;
        }
        
        Alert.alert("Delete Expense", `Add "${expense.category} - Rs.${expense.amount}" to pending deletions?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Add to Pending",
                style: "default",
                onPress: () => {
                    const newItem = {
                        action: 'delete',
                        name: `${expense.category} - Rs.${expense.amount}`,
                        data: expense
                    };
                    
                    setPendingItems(prev => [...prev, newItem]);
                    setIsSideListVisible(true);
                }
            }
        ])
    };

    const openModal = (exp = null) => {
        if (exp) {
            setFormItem(exp);
        } else {
            setFormItem({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
        }
        setModalVisible(true);
    };

    // Check if expense already exists in pending list
    const isExpenseInPendingList = (category, amount) => {
        return pendingItems.some(item => {
            if (item.action === 'add') {
                // For new items, check by category and amount combination
                const [itemCategory, itemAmount] = item.name.split(' - Rs.');
                return itemCategory === category && itemAmount === amount;
            } else if (item.action === 'delete') {
                // For deletions, check by actual ID
                return item.data.category === category && item.data.amount === amount;
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
                text: 'Clear',
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
                                    await axios.post(`${API_URL}/expenses`, item.data, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                    successCount++;
                                } else if (item.action === 'delete') {
                                    await axios.delete(`${API_URL}/expenses/${item.data.id}`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                    });
                                    successCount++;
                                }
                            } catch (err) {
                                errorCount++;
                                errors.push(`${item.action === 'add' ? 'Adding' : 'Deleting'} "${item.name}": ${err.response?.data?.error || err.message}`);
                            }
                        }

                        // Show results
                        if (errorCount > 0) {
                            Alert.alert('Processing Complete', `Processed ${successCount} items successfully. ${errorCount} items failed:\n\n${errors.join('\n')}`);
                        } else {
                            Alert.alert('Success', `Successfully processed ${successCount} items!`);
                        }

                        // Clear pending items and refresh expenses
                        setPendingItems([]);
                        setIsSideListVisible(false);
                        fetchExpenses();
                    } catch (err) {
                        console.error('Error processing pending items:', err);
                        Alert.alert('Error', 'An unexpected error occurred while processing items.');
                    } finally {
                        setIsProcessing(false);
                    }
                }
            }
        ]);
    };

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    const getCategoryStyles = (category) => {
        switch(category) {
            case 'Petrol': return { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', icon: 'water' };
            case 'Electric Bill': return { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', icon: 'flash' };
            case 'Food': return { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', icon: 'restaurant' };
            case 'Rent': return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', icon: 'home' };
            case 'Maintenance': return { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', icon: 'build' };
            default: return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', icon: 'ellipsis-horizontal' };
        }
    }

    const renderExpenseItem = ({ item }) => {
        const catStyle = getCategoryStyles(item.category);
        return (
            <View style={styles.card}>
                <View style={styles.cardLeft}>
                    <View style={[styles.catIconContainer, { backgroundColor: catStyle.bg }]}>
                        <Icon name={catStyle.icon} size={22} color={catStyle.text} />
                    </View>
                    <View style={styles.cardDetails}>
                        <Text style={styles.cardTitle}>{item.category}</Text>
                        <Text style={styles.cardDesc} numberOfLines={1}>
                            {item.description || 'No description'}
                        </Text>
                        <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    </View>
                </View>
                <View style={styles.cardRight}>
                    <Text style={styles.cardAmount}>Rs. {Number(item.amount).toLocaleString()}</Text>
                    <View style={styles.cardActions}>
                        <TouchableOpacity onPress={() => openModal(item)} style={styles.editBtn}>
                            <Icon name="create-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(item.id)} style={styles.deleteBtn}>
                            <Icon name="trash-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Monthly Expenses</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                    <Icon name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Filter controls */}
            <View style={styles.filterContainer}>
                <View style={styles.filterInputGroup}>
                    <Text style={styles.filterLabel}>Year</Text>
                    <TextInput
                        style={styles.filterInput}
                        value={filterYear}
                        onChangeText={setFilterYear}
                        keyboardType="numeric"
                        maxLength={4}
                        placeholderTextColor={colors.text.muted}
                    />
                </View>
                <View style={styles.filterInputGroup}>
                    <Text style={styles.filterLabel}>Month (1-12)</Text>
                    <TextInput
                        style={styles.filterInput}
                        value={filterMonth}
                        onChangeText={(t) => setFilterMonth(t.padStart(2, '0'))}
                        keyboardType="numeric"
                        maxLength={2}
                        placeholderTextColor={colors.text.muted}
                    />
                </View>
            </View>

            <View style={styles.summaryContainer}>
                <Text style={styles.summaryLabel}>Total Expenses ({filterMonth}-{filterYear})</Text>
                <Text style={styles.summaryAmount}>Rs. {totalExpenses.toLocaleString()}</Text>
            </View>

            <FlatList
                {...flatListPerformanceProps}
                data={expenses}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderExpenseItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<Text style={styles.emptyText}>No expenses found.</Text>}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />}
            />

            {/* Manage Expense Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{formItem.id ? 'Edit Expense' : 'Add Expense'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                            <TextInput
                                style={styles.input}
                                value={formItem.date}
                                onChangeText={(t) => setFormItem({ ...formItem, date: t })}
                                placeholderTextColor={colors.text.muted}
                            />

                            <Text style={styles.inputLabel}>Category</Text>
                            <View style={styles.categoryContainer}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[styles.catBtn, formItem.category === cat && styles.catBtnActive]}
                                        onPress={() => setFormItem({ ...formItem, category: cat })}
                                    >
                                        <Text style={[styles.catText, formItem.category === cat && styles.catTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Amount (Rs)</Text>
                            <TextInput
                                style={styles.input}
                                value={formItem.amount.toString()}
                                onChangeText={(t) => setFormItem({ ...formItem, amount: t })}
                                keyboardType="numeric"
                                placeholder="Enter amount"
                                placeholderTextColor={colors.text.muted}
                            />

                            <Text style={styles.inputLabel}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={formItem.description}
                                onChangeText={(t) => setFormItem({ ...formItem, description: t })}
                                multiline
                                placeholder="Optional description..."
                                placeholderTextColor={colors.text.muted}
                            />
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

            {/* Pending Items Indicator */}
            {pendingItems.length > 0 && (
                <TouchableOpacity 
                    style={styles.pendingIndicator} 
                    onPress={() => setIsSideListVisible(true)}
                >
                    <Icon name="list-outline" size={20} color="#fff" />
                    <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>{pendingItems.length}</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Expense Side List */}
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
                entityType="expense"
            />
        </View>
    );
}

const getStyles = (colors, FONTS, isTablet) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    headerTitle: { fontSize: 24, color: colors.text.primary, fontFamily: FONTS.bold },
    addBtn: { backgroundColor: colors.accent.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

    filterContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 15, gap: 15 },
    filterInputGroup: { flex: 1 },
    filterLabel: { color: colors.text.secondary, fontSize: 12, marginBottom: 5, fontFamily: FONTS.regular },
    filterInput: { backgroundColor: colors.background.secondary, borderRadius: 8, padding: 10, color: colors.text.primary, borderWidth: 1, borderColor: colors.border.color },

    summaryContainer: { marginHorizontal: 16, marginBottom: 15, padding: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
    summaryLabel: { color: colors.text.secondary, fontSize: 14, fontFamily: FONTS.medium, marginBottom: 5 },
    summaryAmount: { color: colors.status?.danger || '#ef4444', fontSize: 28, fontFamily: FONTS.bold },

    listContainer: { padding: 16, paddingBottom: 40 },
    emptyText: { color: colors.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },

    card: { 
        backgroundColor: colors.background.secondary, 
        borderRadius: 16, 
        padding: 16, 
        marginBottom: 14, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1, 
        borderColor: colors.border.color || 'rgba(255,255,255,0.05)'
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    catIconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    cardDetails: { flex: 1, justifyContent: 'center' },
    cardTitle: { color: colors.text.primary, fontSize: 16, fontFamily: FONTS.bold, marginBottom: 2 },
    cardDesc: { color: colors.text.secondary, fontSize: 13, fontFamily: FONTS.regular, marginBottom: 4 },
    cardDate: { color: colors.text.muted, fontSize: 11, fontFamily: FONTS.medium },
    
    cardRight: { alignItems: 'flex-end', justifyContent: 'center' },
    cardAmount: { color: colors.text.primary, fontSize: 17, fontFamily: FONTS.bold, marginBottom: 12 },
    cardActions: { flexDirection: 'row', gap: 10 },
    editBtn: { backgroundColor: colors.accent.primary, padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    deleteBtn: { backgroundColor: colors.status?.danger || '#ef4444', padding: 8, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { 
        backgroundColor: colors.background.secondary, 
        borderTopLeftRadius: 24, borderTopRightRadius: 24, 
        padding: 20, maxHeight: '80%',
        ...(isTablet && { width: '60%', alignSelf: 'center', maxHeight: '70%' }) 
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, color: colors.text.primary, fontFamily: FONTS.bold },
    modalBody: { marginBottom: 20 },
    inputLabel: { color: colors.text.secondary, fontSize: 14, marginBottom: 8, fontFamily: FONTS.medium },
    input: { backgroundColor: colors.background.primary, color: colors.text.primary, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border.color, fontFamily: FONTS.regular },

    categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    catBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.background.primary, borderWidth: 1, borderColor: colors.border.color },
    catBtnActive: { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: '#38bdf8' },
    catText: { color: colors.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    catTextActive: { color: '#38bdf8' },

    modalFooter: { flexDirection: 'row', gap: 15 },
    cancelBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: colors.background.primary, alignItems: 'center' },
    cancelBtnText: { color: colors.text.secondary, fontFamily: FONTS.bold, fontSize: 16 },
    saveBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: colors.accent.primary, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
    
    // Pending indicator styles
    pendingIndicator: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: colors.accent.primary,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        zIndex: 1000
    },
    pendingBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },
    pendingBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontFamily: FONTS.bold
    }
});
