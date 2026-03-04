import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { salesService } from '../api/sales';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';

export default function SalesScreen() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSales = async () => {
        try {
            const data = await salesService.getAll();
            setSales(data);
        } catch (error) {
            console.error('Failed to fetch sales:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchSales();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSales();
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
            <Text style={styles.headerTitle}>Recent Sales</Text>

            <FlatList
                data={sales}
                keyExtractor={(item) => item.sale_id.toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                    <ExpandableItem
                        title={`Invoice #${item.invoice_no}`}
                        subtitle={item.buyer_name || 'Walk-in Customer'}
                        rightText={`Rs. ${item.total_amount}`}
                        iconName="receipt-outline"
                        detailsData={{
                            'Products Details': item.products_details,
                            'Bill Type': item.bill_type,
                            'Discount': `Rs. ${item.total_discount}`,
                            'Paid Amount': `Rs. ${item.paid_amount || 0}`,
                            'Date': new Date(item.created_at).toLocaleString()
                        }}
                    />
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No sales records found.</Text>
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
