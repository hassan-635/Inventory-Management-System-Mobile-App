import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { buyersService } from '../api/buyers';
import { COLORS, FONTS } from '../theme/theme';
import ExpandableItem from '../components/ExpandableItem';
import Icon from 'react-native-vector-icons/Ionicons';

export default function BuyersScreen() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchBuyers = async () => {
    try {
      const data = await buyersService.getAll();
      setBuyers(data);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchBuyers(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchBuyers(); };

  const computeDue = (txns) =>
    (txns || []).reduce((acc, t) => acc + (Number(t.total_amount || 0) - Number(t.paid_amount || 0)), 0);

  const computePaid = (txns) =>
    (txns || []).reduce((acc, t) => acc + Number(t.paid_amount || 0), 0);

  const filteredBuyers = buyers.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.company_name?.toLowerCase().includes(search.toLowerCase())
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
      <Text style={styles.headerTitle}>Customers Directory</Text>

      <View style={styles.searchRow}>
        <Icon name="search-outline" size={18} color={COLORS.text.secondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or company..."
          placeholderTextColor={COLORS.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredBuyers}
        keyExtractor={(item, index) => (item.id || index).toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent.primary} />}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => {
          const due = computeDue(item.buyer_transactions);
          const paid = computePaid(item.buyer_transactions);
          return (
            <ExpandableItem
              title={item.name}
              subtitle={item.company_name ? `🏢 ${item.company_name}` : null}
              rightText={`Due: Rs. ${due}`}
              iconName="person-outline"
              detailsData={{
                'Customer ID': item.id,
                'Company': item.company_name || 'N/A',
                'Phone': item.phone || 'N/A',
                'Address': item.address || 'N/A',
                'Total Paid': `Rs. ${paid}`,
                'Remaining Due': `Rs. ${due}`,
                'Transactions': item.buyer_transactions?.length || 0,
                'Register Date': new Date(item.created_at).toLocaleDateString()
              }}
            />
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No customers found.</Text>}
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
