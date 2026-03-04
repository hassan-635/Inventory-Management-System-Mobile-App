import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { suppliersService } from '../api/suppliers';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';
import Icon from 'react-native-vector-icons/Ionicons';

export default function SuppliersScreen() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

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
                            subtitle={null}
                            rightText={`Due: Rs. ${due}`}
                            iconName="business-outline"
                            detailsData={{
                                'Supplier ID': item.id,
                                'Phone': item.phone || 'N/A',
                                'Company': item.company_name || 'N/A',
                                'Total Paid': `Rs. ${paid}`,
                                'Remaining Due': `Rs. ${due}`,
                                'Transactions': item.supplier_transactions?.length || 0,
                                'Register Date': new Date(item.created_at).toLocaleDateString()
                            }}
                        />
                    );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No suppliers found.</Text>}
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
    listContainer: { padding: 16, paddingBottom: 40 },
    emptyText: { color: COLORS.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },
});
