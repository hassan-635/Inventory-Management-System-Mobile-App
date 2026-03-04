import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { suppliersService } from '../api/suppliers';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';

export default function SuppliersScreen() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSuppliers();
    };

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

            <FlatList
                data={suppliers}
                keyExtractor={(item, index) => (item.id || index).toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                    <ExpandableItem
                        title={item.supplier_name}
                        subtitle={item.supplier_phone}
                        rightText={`Due: Rs. ${item.total_due || 0}`}
                        iconName="business-outline"
                        detailsData={{
                            'Supplier ID': item.supplier_id,
                            'Address': item.supplier_address || 'N/A',
                            'Total Paid': `Rs. ${item.total_paid || 0}`,
                            'Remaining Due': `Rs. ${item.total_due || 0}`,
                            'Register Date': new Date(item.created_at).toLocaleDateString()
                        }}
                    />
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No suppliers found.</Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background.primary,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background.primary,
    },
    listContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    headerTitle: {
        fontSize: 24,
        color: COLORS.text.primary,
        fontFamily: FONTS.bold,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    emptyText: {
        color: COLORS.text.secondary,
        textAlign: 'center',
        marginTop: 40,
        fontFamily: FONTS.regular,
    }
});
