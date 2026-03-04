import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { productsService } from '../api/products';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProductsScreen() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const checkLowStockAlerts = async (data) => {
        try {
            const limitStr = await AsyncStorage.getItem('low_stock_limit');
            const limit = limitStr ? parseInt(limitStr, 10) : 10;

            const lowStockItems = data.filter(p => parseInt(p.remaining_quantity, 10) <= limit);

            if (lowStockItems.length > 0) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "⚠️ Low Stock Alert!",
                        body: `You have ${lowStockItems.length} product(s) at or below your limit (${limit}).`,
                    },
                    trigger: null,
                });
            }
        } catch (err) {
            console.log("Error checking low stock:", err);
        }
    };

    const fetchProducts = async () => {
        try {
            const data = await productsService.getAll();
            setProducts(data);
            checkLowStockAlerts(data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProducts();
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
            <Text style={styles.headerTitle}>Products Inventory</Text>

            <FlatList
                data={products}
                keyExtractor={(item) => item.product_id.toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                    <ExpandableItem
                        title={item.product_name}
                        subtitle={`Supplier: ${item.supplier_name || 'N/A'}`}
                        rightText={`Rs. ${item.selling_price}`}
                        iconName="cube-outline"
                        detailsData={{
                            'Product ID': item.product_id,
                            'Purchase Price': `Rs. ${item.purchase_rate || '-'}`,
                            'Max Discount': `${item.max_discount || 0}%`,
                            'Total Qty': item.total_quantity,
                            'Remaining Qty': item.remaining_quantity,
                            'Added Date': new Date(item.created_at).toLocaleDateString()
                        }}
                    />
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No products found.</Text>
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
