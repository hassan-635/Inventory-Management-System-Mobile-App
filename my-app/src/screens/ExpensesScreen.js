import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ScrollView } from 'react-native';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { COLORS, FONTS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const CATEGORIES = ['Petrol', 'Electric Bill', 'Food', 'Rent', 'Maintenance', 'Other'];

export default function ExpensesScreen() {
    const { token } = useAuthStore();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [formItem, setFormItem] = useState({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    const [isSaving, setIsSaving] = useState(false);

    // Filter state
    const currentYearStr = new Date().getFullYear().toString();
    const currentMonthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const [filterYear, setFilterYear] = useState(currentYearStr);
    const [filterMonth, setFilterMonth] = useState(currentMonthStr);

    const fetchExpenses = async () => {
        try {
            const res = await axios.get(`${API_URL}/expenses?year=${filterYear}&month=${filterMonth}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExpenses(res.data);
        } catch (error) {
            console.error('Fetch expenses error:', error);
            Alert.alert("Error", "Could not fetch expenses.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchExpenses();
    }, [filterYear, filterMonth]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchExpenses();
    };

    const handleSave = async () => {
        if (!formItem.category || !formItem.amount) {
            Alert.alert("Error", "Category and amount are required.");
            return;
        }

        setIsSaving(true);
        try {
            if (formItem.id) {
                await axios.put(`${API_URL}/expenses/${formItem.id}`, formItem, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/expenses`, formItem, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setModalVisible(false);
            fetchExpenses();
        } catch (error) {
            console.error('Save expense error:', error);
            Alert.alert("Error", "Could not save expense.");
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = (id) => {
        Alert.alert("Delete Expense", "Are you sure you want to delete this expense?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await axios.delete(`${API_URL}/expenses/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        fetchExpenses();
                    } catch (err) {
                        Alert.alert("Error", "Could not delete expense");
                    }
                }
            }
        ])
    }

    const openModal = (exp = null) => {
        if (exp) {
            setFormItem(exp);
        } else {
            setFormItem({ id: null, category: 'Petrol', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
        }
        setModalVisible(true);
    };

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    const renderExpenseItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.category}</Text>
                </View>
                <Text style={styles.cardDate}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.cardBody}>
                <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description || 'No description provided.'}
                </Text>
                <Text style={styles.cardAmount}>Rs. {Number(item.amount).toLocaleString()}</Text>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openModal(item)} style={styles.iconBtn}>
                    <Icon name="create-outline" size={20} color={COLORS.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(item.id)} style={styles.iconBtn}>
                    <Icon name="trash-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

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
                    />
                </View>
            </View>

            <View style={styles.summaryContainer}>
                <Text style={styles.summaryLabel}>Total Expenses ({filterMonth}-{filterYear})</Text>
                <Text style={styles.summaryAmount}>Rs. {totalExpenses.toLocaleString()}</Text>
            </View>

            <FlatList
                data={expenses}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderExpenseItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<Text style={styles.emptyText}>No expenses found.</Text>}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
            />

            {/* Manage Expense Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{formItem.id ? 'Edit Expense' : 'Add Expense'}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Icon name="close" size={24} color={COLORS.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                            <TextInput
                                style={styles.input}
                                value={formItem.date}
                                onChangeText={(t) => setFormItem({ ...formItem, date: t })}
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
                                placeholderTextColor={COLORS.text.muted}
                            />

                            <Text style={styles.inputLabel}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={formItem.description}
                                onChangeText={(t) => setFormItem({ ...formItem, description: t })}
                                multiline
                                placeholder="Optional description..."
                                placeholderTextColor={COLORS.text.muted}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background.primary },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    headerTitle: { fontSize: 24, color: COLORS.text.primary, fontFamily: FONTS.bold },
    addBtn: { backgroundColor: COLORS.accent.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

    filterContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 15, gap: 15 },
    filterInputGroup: { flex: 1 },
    filterLabel: { color: COLORS.text.secondary, fontSize: 12, marginBottom: 5, fontFamily: FONTS.regular },
    filterInput: { backgroundColor: COLORS.background.secondary, borderRadius: 8, padding: 10, color: COLORS.text.primary, borderWidth: 1, borderColor: COLORS.border.color },

    summaryContainer: { marginHorizontal: 16, marginBottom: 15, padding: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
    summaryLabel: { color: COLORS.text.secondary, fontSize: 14, fontFamily: FONTS.medium, marginBottom: 5 },
    summaryAmount: { color: '#ef4444', fontSize: 28, fontFamily: FONTS.bold },

    listContainer: { padding: 16, paddingBottom: 40 },
    emptyText: { color: COLORS.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },

    card: { backgroundColor: COLORS.background.secondary, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border.color },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    badge: { backgroundColor: 'rgba(56, 189, 248, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { color: '#38bdf8', fontSize: 12, fontFamily: FONTS.medium },
    cardDate: { color: COLORS.text.muted, fontSize: 12, fontFamily: FONTS.regular },
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    cardDesc: { color: COLORS.text.secondary, fontSize: 14, fontFamily: FONTS.regular, flex: 1, marginRight: 10 },
    cardAmount: { color: COLORS.text.primary, fontSize: 18, fontFamily: FONTS.bold },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: COLORS.border.color, paddingTop: 10, gap: 15 },
    iconBtn: { padding: 5 },

    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContent: { backgroundColor: COLORS.background.secondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, color: COLORS.text.primary, fontFamily: FONTS.bold },
    modalBody: { marginBottom: 20 },
    inputLabel: { color: COLORS.text.secondary, fontSize: 14, marginBottom: 8, fontFamily: FONTS.medium },
    input: { backgroundColor: COLORS.background.primary, color: COLORS.text.primary, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border.color, fontFamily: FONTS.regular },

    categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    catBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background.primary, borderWidth: 1, borderColor: COLORS.border.color },
    catBtnActive: { backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: '#38bdf8' },
    catText: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    catTextActive: { color: '#38bdf8' },

    modalFooter: { flexDirection: 'row', gap: 15 },
    cancelBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.background.primary, alignItems: 'center' },
    cancelBtnText: { color: COLORS.text.secondary, fontFamily: FONTS.bold, fontSize: 16 },
    saveBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: COLORS.accent.primary, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 16 },
});
