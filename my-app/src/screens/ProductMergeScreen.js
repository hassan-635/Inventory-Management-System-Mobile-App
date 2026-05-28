import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { productsService } from '../api/products';
import { useAppTheme } from '../theme/useAppTheme';
import { useDataRefreshStore } from '../store/dataRefreshStore';
import { useToastStore } from '../store/toastStore';

const initialForm = {
  name: '',
  category: 'Hardware',
  price: '',
  purchase_rate: '',
  quantity_unit: 'Per Piece',
};

export default function ProductMergeScreen() {
  const { colors, FONTS } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, FONTS), [colors, FONTS]);

  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState([]);
  const [provider, setProvider] = useState('rule_based');
  const [limitWarning, setLimitWarning] = useState('');
  const [selectedPair, setSelectedPair] = useState(null);
  const [mergeForm, setMergeForm] = useState(initialForm);
  const [preview, setPreview] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const showToast = useToastStore((s) => s.showToast);

  const handleAnalyze = async () => {
    setLoading(true);
    setLimitWarning('');
    try {
      const result = await productsService.analyzeMergeCandidates({ use_groq: true });
      setPairs(Array.isArray(result?.pairs) ? result.pairs : []);
      setProvider(result?.provider_status || 'rule_based');
      if (result?.limit_warning) setLimitWarning(result.limit_warning);
      if (!result?.pairs?.length) {
        showToast('No Matches', 'No similar product pairs found.', 'info');
      }
    } catch (error) {
      showToast('Error', error.response?.data?.error || 'Could not analyze products.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openMergeModal = async (pair) => {
    setSelectedPair(pair);
    setMergeForm({
      ...initialForm,
      name: pair.left_name || '',
    });
    setPreview(null);
    setModalVisible(true);
    try {
      const result = await productsService.previewMerge({
        product_ids: [pair.left_product_id, pair.right_product_id],
        final_values: {},
      });
      setPreview(result?.preview || null);
    } catch (_) {
      // keep modal usable even if preview fails
    }
  };

  const refreshPreview = async () => {
    if (!selectedPair) return;
    try {
      const result = await productsService.previewMerge({
        product_ids: [selectedPair.left_product_id, selectedPair.right_product_id],
        final_values: {
          name: mergeForm.name,
          category: mergeForm.category,
          price: Number(mergeForm.price || 0),
          purchase_rate: mergeForm.purchase_rate === '' ? null : Number(mergeForm.purchase_rate),
          quantity_unit: mergeForm.quantity_unit || 'Per Piece',
        },
      });
      setPreview(result?.preview || null);
    } catch (error) {
      showToast('Error', error.response?.data?.error || 'Preview failed.', 'error');
    }
  };

  const executeMerge = async () => {
    if (!selectedPair) return;
    if (!mergeForm.name.trim() || !mergeForm.price) {
      showToast('Error', 'Final Name and Sale Price are required.', 'error');
      return;
    }

    Alert.alert('Confirm Merge', 'Merge these two products into one?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        onPress: async () => {
          setIsMerging(true);
          try {
            await productsService.executeMerge({
              product_ids: [selectedPair.left_product_id, selectedPair.right_product_id],
              survivor_product_id: selectedPair.left_product_id,
              provider_used: provider,
              final_values: {
                name: mergeForm.name.trim(),
                category: mergeForm.category,
                price: Number(mergeForm.price),
                purchase_rate: mergeForm.purchase_rate === '' ? null : Number(mergeForm.purchase_rate),
                quantity_unit: mergeForm.quantity_unit || 'Per Piece',
              },
            });
            useDataRefreshStore.getState().bumpInventory();
            showToast('Success', 'Products merged successfully.', 'success');
            setModalVisible(false);
            setSelectedPair(null);
            handleAnalyze();
          } catch (error) {
            showToast('Error', error.response?.data?.error || 'Merge failed.', 'error');
          } finally {
            setIsMerging(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>AI Product Merge</Text>
      <Text style={styles.subTitle}>Find similar products, review pair, then merge safely.</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusText}>
          Provider: <Text style={styles.statusEmphasis}>{provider === 'groq' ? 'Groq' : 'Rule-based'}</Text>
        </Text>
        {!!limitWarning && <Text style={styles.warningText}>{limitWarning}</Text>}
      </View>

      <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>Analyze Similar Products</Text>}
      </TouchableOpacity>

      <FlatList
        data={pairs}
        keyExtractor={(item) => item.pair_id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.emptyText}>Press analyze to find similar product pairs.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.left_name}</Text>
              <Text style={styles.confidence}>#{Math.round(Number(item.confidence || 0) * 100)}%</Text>
            </View>
            <View style={styles.row}>
              <Icon name="swap-horizontal-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.cardSubtitle} numberOfLines={1}>{item.right_name}</Text>
            </View>
            <Text style={styles.reasonText}>Reason: {(item.reason_tokens || []).join(', ') || 'name similarity'}</Text>
            <TouchableOpacity style={styles.mergeBtn} onPress={() => openMergeModal(item)}>
              <Text style={styles.mergeBtnText}>Merge This Pair</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Finalize Merge</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={22} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Final Name *</Text>
            <TextInput style={styles.input} value={mergeForm.name} onChangeText={(t) => setMergeForm((p) => ({ ...p, name: t }))} placeholder="Merged product name" placeholderTextColor={colors.text.muted} />
            <Text style={styles.label}>Category</Text>
            <TextInput style={styles.input} value={mergeForm.category} onChangeText={(t) => setMergeForm((p) => ({ ...p, category: t }))} placeholder="Hardware" placeholderTextColor={colors.text.muted} />
            <Text style={styles.label}>Sale Price *</Text>
            <TextInput style={styles.input} value={mergeForm.price} onChangeText={(t) => setMergeForm((p) => ({ ...p, price: t }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
            <Text style={styles.label}>Purchase Price</Text>
            <TextInput style={styles.input} value={mergeForm.purchase_rate} onChangeText={(t) => setMergeForm((p) => ({ ...p, purchase_rate: t }))} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.text.muted} />
            <Text style={styles.label}>Unit</Text>
            <TextInput style={styles.input} value={mergeForm.quantity_unit} onChangeText={(t) => setMergeForm((p) => ({ ...p, quantity_unit: t }))} placeholder="Per Piece" placeholderTextColor={colors.text.muted} />

            <TouchableOpacity style={styles.previewBtn} onPress={refreshPreview}>
              <Text style={styles.previewBtnText}>Refresh Preview</Text>
            </TouchableOpacity>

            {preview ? (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>Preview</Text>
                <Text style={styles.previewText}>Total Qty: {preview.total_quantity}</Text>
                <Text style={styles.previewText}>Remaining Qty: {preview.remaining_quantity}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.executeBtn} onPress={executeMerge} disabled={isMerging}>
              {isMerging ? <ActivityIndicator color="#fff" /> : <Text style={styles.executeBtnText}>Confirm Merge</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors, FONTS) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary, padding: 16 },
    headerTitle: { fontSize: 24, color: colors.text.primary, fontFamily: FONTS.bold, marginBottom: 4 },
    subTitle: { color: colors.text.secondary, fontFamily: FONTS.regular, marginBottom: 12 },
    statusCard: { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.color, borderRadius: 10, padding: 12, marginBottom: 10 },
    statusText: { color: colors.text.secondary, fontFamily: FONTS.medium },
    statusEmphasis: { color: colors.accent.primary, fontFamily: FONTS.bold },
    warningText: { color: colors.status.warning, fontFamily: FONTS.medium, marginTop: 6 },
    analyzeBtn: { backgroundColor: colors.accent.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
    analyzeBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 15 },
    emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: 40, fontFamily: FONTS.regular },
    card: { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.color, borderRadius: 12, padding: 12, marginBottom: 10 },
    cardTitle: { color: colors.text.primary, fontFamily: FONTS.bold, fontSize: 16, flex: 1, marginRight: 8 },
    cardSubtitle: { color: colors.text.secondary, fontFamily: FONTS.medium, marginLeft: 6, flex: 1 },
    confidence: { color: colors.accent.primary, fontFamily: FONTS.bold, fontSize: 12 },
    reasonText: { color: colors.text.muted, fontFamily: FONTS.regular, marginTop: 8, marginBottom: 10, fontSize: 12 },
    mergeBtn: { backgroundColor: colors.background.primary, borderColor: colors.border.color, borderWidth: 1, borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
    mergeBtnText: { color: colors.text.primary, fontFamily: FONTS.bold },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.background.secondary, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
    modalTitle: { color: colors.text.primary, fontSize: 18, fontFamily: FONTS.bold, marginBottom: 12 },
    label: { color: colors.text.secondary, fontFamily: FONTS.medium, marginBottom: 6, marginTop: 4 },
    input: { backgroundColor: colors.background.primary, borderWidth: 1, borderColor: colors.border.color, borderRadius: 10, color: colors.text.primary, padding: 10, marginBottom: 8, fontFamily: FONTS.regular },
    previewBtn: { borderWidth: 1, borderColor: colors.border.color, backgroundColor: colors.background.primary, borderRadius: 10, alignItems: 'center', paddingVertical: 10, marginTop: 4 },
    previewBtnText: { color: colors.text.primary, fontFamily: FONTS.bold },
    previewBox: { marginTop: 10, padding: 10, borderWidth: 1, borderColor: colors.border.color, borderRadius: 10, backgroundColor: colors.background.primary },
    previewTitle: { color: colors.text.primary, fontFamily: FONTS.bold, marginBottom: 6 },
    previewText: { color: colors.text.secondary, fontFamily: FONTS.regular },
    executeBtn: { marginTop: 12, backgroundColor: colors.accent.primary, borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
    executeBtnText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 15 },
  });
