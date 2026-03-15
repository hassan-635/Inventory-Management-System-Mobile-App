import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { productsService } from '../api/products';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'Paint', label: 'Paint' },
    { key: 'Hardware', label: 'Hardware' },
    { key: 'Electricity', label: 'Electricity' },
    { key: 'low', label: '⚠️ Low Stock' },
];

export default function ProductsScreen() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [search, setSearch] = useState('');

    const fetchProducts = async () => {
        try {
            const data = await productsService.getAll();
            // Sort: highest remaining_quantity first
            const sorted = [...data].sort((a, b) => Number(b.remaining_quantity || 0) - Number(a.remaining_quantity || 0));
            setProducts(sorted);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const onRefresh = () => { setRefreshing(true); fetchProducts(); };

    const lowStockLimit = 10;
    const filteredProducts = products.filter(p => {
        // Search filter
        if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
        
        // Category filter
        if (activeFilter === 'low') {
            return Number(p.remaining_quantity || 0) <= lowStockLimit;
        } else if (activeFilter !== 'all') {
            // Check if the product name contains the category name (as a simple way to categorize if real categories aren't in DB)
            // Or if backend has a category field, we use p.category === activeFilter
            return p.category === activeFilter || p.name?.toLowerCase().includes(activeFilter.toLowerCase());
        }
        return true;
    });

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

            {/* Search */}
            <View style={styles.searchRow}>
                <Icon name="search-outline" size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
                    placeholderTextColor={COLORS.text.muted || COLORS.text.secondary}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {FILTERS.map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterBtn, activeFilter === f.key && styles.filterBtnActive, f.key === 'low' && activeFilter !== 'low' && { borderColor: '#eab308' }]}
                            onPress={() => setActiveFilter(f.key)}
                        >
                            <Text style={[styles.filterBtnText, activeFilter === f.key && styles.filterBtnTextActive, f.key === 'low' && activeFilter !== 'low' && { color: '#eab308' }]}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item, index) => (item.id || index).toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                    const remaining = Number(item.remaining_quantity || 0);
                    const isLow = remaining > 0 && remaining <= lowStockLimit;
                    const isZero = remaining === 0;
                    
                    let containerStyle = {};
                    if (isZero) {
                        containerStyle = { borderColor: 'rgba(239, 68, 68, 0.5)', backgroundColor: 'rgba(239, 68, 68, 0.05)' };
                    } else if (isLow) {
                        containerStyle = { borderColor: 'rgba(234, 179, 8, 0.3)' };
                    }

                    return (
                        <ExpandableItem
                            title={item.name}
                            subtitle={null}
                            rightText={`Rs. ${item.price}`}
                            iconName="cube-outline"
                            containerStyle={containerStyle}
                            detailsData={{
                                'Product ID': item.id,
                                'Category': item.category || 'N/A',
                                'Supplier': item.purchased_from || 'N/A',
                                'Sale Price': `Rs. ${item.price}`,
                                'Purchase Price': `Rs. ${item.purchase_rate || '-'}`,
                                'Unit': item.quantity_unit || 'Per Unit',
                                'Max Discount': `${item.max_discount || 0}%`,
                                'Total Qty': item.total_quantity,
                                'Remaining Qty': `${remaining}${isZero ? ' ❌ (Out of Stock)' : isLow ? ' ⚠️' : ''}`,
                                'Purchase Date': item.purchase_date || '-',
                                'Added': new Date(item.created_at).toLocaleDateString()
                            }}
                        />
                    );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No products found.</Text>}
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
    filterWrapper: { height: 45, marginBottom: 8 },
    filterRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
    filterBtn: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: COLORS.border.color,
        backgroundColor: COLORS.background.secondary,
    },
    filterBtnActive: { backgroundColor: COLORS.accent.primary, borderColor: COLORS.accent.primary },
    filterBtnText: { color: COLORS.text.secondary, fontFamily: FONTS.medium, fontSize: 13 },
    filterBtnTextActive: { color: '#fff', fontFamily: FONTS.bold },
    listContainer: { padding: 16, paddingBottom: 40 },
    emptyText: { color: COLORS.text.secondary, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },
});
