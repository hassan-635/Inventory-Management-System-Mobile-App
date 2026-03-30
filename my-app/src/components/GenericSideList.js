import React, { useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    Modal, 
    TouchableOpacity, 
    ScrollView, 
    ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const GenericSideList = ({ 
    visible, 
    onClose, 
    pendingItems, 
    onRemoveItem, 
    onClearAll, 
    onProcessItems,
    isProcessing,
    colors,
    FONTS,
    entityType = 'item' // 'product', 'customer', 'supplier', 'company'
}) => {
    const addCount = pendingItems.filter(item => item.action === 'add').length;
    const deleteCount = pendingItems.filter(item => item.action === 'delete').length;

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    };

    const formatCurrency = (amount) => {
        if (!amount) return 'N/A';
        return `Rs. ${parseFloat(amount).toLocaleString()}`;
    };

    const styles = getStyles(colors, FONTS);

    // Helper component for detail rows
    const DetailRow = ({ label, value, colors, FONTS }) => (
        <View style={detailStyles.row}>
            <Text style={[detailStyles.label, { color: colors.text.secondary, fontFamily: FONTS.medium }]}>
                {label}:
            </Text>
            <Text style={[detailStyles.value, { color: colors.text.primary, fontFamily: FONTS.regular }]}>
                {value}
            </Text>
        </View>
    );

    const renderItemDetails = (item) => {
        if (item.action === 'add' && item.data) {
            // Render details based on entity type
            switch (entityType) {
                case 'customer':
                    return (
                        <>
                            <DetailRow label="Name" value={item.data.name || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Phone" value={item.data.phone || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Email" value={item.data.email || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Company" value={item.data.company_name || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Address" value={item.data.address || 'N/A'} colors={colors} FONTS={FONTS} />
                        </>
                    );
                case 'supplier':
                    return (
                        <>
                            <DetailRow label="Name" value={item.data.name || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Phone" value={item.data.phone || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Company" value={item.data.company_name || 'N/A'} colors={colors} FONTS={FONTS} />
                        </>
                    );
                case 'company':
                    return (
                        <>
                            <DetailRow label="Name" value={item.data.name || 'N/A'} colors={colors} FONTS={FONTS} />
                        </>
                    );
                case 'expense':
                    return (
                        <>
                            <DetailRow label="Category" value={item.data.category || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Amount" value={formatCurrency(item.data.amount)} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Description" value={item.data.description || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Date" value={formatDate(item.data.date)} colors={colors} FONTS={FONTS} />
                        </>
                    );
                default: // product
                    return (
                        <>
                            <DetailRow label="Category" value={item.data.category || 'Uncategorized'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Price" value={formatCurrency(item.data.price)} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Quantity" value={`${item.data.total_quantity} ${item.data.quantity_unit || 'pieces'}`} colors={colors} FONTS={FONTS} />
                            {item.data.purchase_rate && (
                                <DetailRow label="Purchase Rate" value={formatCurrency(item.data.purchase_rate)} colors={colors} FONTS={FONTS} />
                            )}
                            {item.data.purchased_from && (
                                <DetailRow label="Supplier" value={item.data.purchased_from} colors={colors} FONTS={FONTS} />
                            )}
                            {item.data.purchase_date && (
                                <DetailRow label="Purchase Date" value={formatDate(item.data.purchase_date)} colors={colors} FONTS={FONTS} />
                            )}
                        </>
                    );
            }
        } else if (item.action === 'delete' && item.data) {
            // Render delete details based on entity type
            switch (entityType) {
                case 'customer':
                    return (
                        <>
                            <DetailRow label="ID" value={item.data.id} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Name" value={item.data.name || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Phone" value={item.data.phone || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Email" value={item.data.email || 'N/A'} colors={colors} FONTS={FONTS} />
                            {item.data.balance !== undefined && (
                                <DetailRow label="Balance" value={formatCurrency(item.data.balance)} colors={colors} FONTS={FONTS} />
                            )}
                        </>
                    );
                case 'supplier':
                    return (
                        <>
                            <DetailRow label="ID" value={item.data.id} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Name" value={item.data.name || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Phone" value={item.data.phone || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Company" value={item.data.company_name || 'N/A'} colors={colors} FONTS={FONTS} />
                            {item.data.balance !== undefined && (
                                <DetailRow label="Balance" value={formatCurrency(item.data.balance)} colors={colors} FONTS={FONTS} />
                            )}
                        </>
                    );
                case 'company':
                    return (
                        <>
                            <DetailRow label="ID" value={item.data.id} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Name" value={item.data.name || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Contact" value={item.data.contact || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Phone" value={item.data.phone || 'N/A'} colors={colors} FONTS={FONTS} />
                            {item.data.balance !== undefined && (
                                <DetailRow label="Balance" value={formatCurrency(item.data.balance)} colors={colors} FONTS={FONTS} />
                            )}
                        </>
                    );
                case 'expense':
                    return (
                        <>
                            <DetailRow label="Category" value={item.data.category || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Amount" value={formatCurrency(item.data.amount)} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Description" value={item.data.description || 'N/A'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Date" value={formatDate(item.data.date)} colors={colors} FONTS={FONTS} />
                        </>
                    );
                default: // product
                    return (
                        <>
                            <DetailRow label="ID" value={item.data.id} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Category" value={item.data.category || 'Uncategorized'} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Current Stock" value={`${item.data.remaining_quantity || 0} pieces`} colors={colors} FONTS={FONTS} />
                            <DetailRow label="Price" value={formatCurrency(item.data.price)} colors={colors} FONTS={FONTS} />
                        </>
                    );
            }
        }
        return null;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity 
                    style={styles.backdrop} 
                    activeOpacity={1} 
                    onPress={onClose} 
                />
                
                <View style={styles.bottomSheet}>
                    {/* Drag Handle */}
                    <View style={styles.dragHandle}>
                        <View style={styles.dragBar} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Pending {entityType.charAt(0).toUpperCase() + entityType.slice(1)} Changes</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Icon name="close" size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView 
                        style={styles.content}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                        momentum={true}
                        decelerationRate="normal"
                        snapToInterval={16}
                    >
                        {pendingItems.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Icon name="cube-outline" size={48} color={colors.text.muted} />
                                <Text style={styles.emptyTitle}>No pending changes</Text>
                                <Text style={styles.emptySubtitle}>Add or delete {entityType}s to see them here</Text>
                            </View>
                        ) : (
                            <>
                                {/* Summary at top */}
                                <View style={styles.topSummary}>
                                    <Text style={styles.summaryTitle}>Pending Changes</Text>
                                    <Text style={styles.summaryText}>
                                        {addCount > 0 && `${addCount} to add`} 
                                        {addCount > 0 && deleteCount > 0 && ', '}
                                        {deleteCount > 0 && `${deleteCount} to delete`}
                                    </Text>
                                </View>
                                
                                {/* List of all items */}
                                {pendingItems.map((item, index) => (
                                    <View key={index} style={[
                                        styles.itemCard, 
                                        item.action === 'add' ? styles.addItemCard : styles.deleteItemCard,
                                        index === pendingItems.length - 1 && styles.lastItemCard
                                    ]}>
                                        <View style={styles.itemHeader}>
                                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                            <View style={[styles.actionBadge, item.action === 'add' ? styles.addBadge : styles.deleteBadge]}>
                                                <Text style={[styles.actionText, item.action === 'add' ? styles.addText : styles.deleteText]}>
                                                    {item.action === 'add' ? 'ADD' : 'DELETE'}
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        <View style={styles.itemDetails}>
                                            {renderItemDetails(item)}
                                        </View>

                                        <TouchableOpacity 
                                            style={styles.removeBtn}
                                            onPress={() => onRemoveItem(index)}
                                        >
                                            <Icon name="remove-circle-outline" size={16} color={colors.status.danger} />
                                            <Text style={styles.removeBtnText}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </>
                        )}
                    </ScrollView>

                    {/* Fixed Bottom Actions */}
                    {pendingItems.length > 0 && (
                        <View style={styles.fixedBottomActions}>
                            <View style={styles.footerActions}>
                                <TouchableOpacity 
                                    style={styles.clearBtn} 
                                    onPress={onClearAll}
                                >
                                    <Text style={styles.clearBtnText}>Clear All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.processBtn, isProcessing && styles.processBtnDisabled]} 
                                    onPress={onProcessItems}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.processBtnText}>Process All</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const detailStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        flex: 1,
    },
    value: {
        fontSize: 12,
        flex: 2,
        textAlign: 'right',
    },
});

const getStyles = (colors, FONTS) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
    },
    bottomSheet: {
        backgroundColor: colors.background.primary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 8,
    },
    dragHandle: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    dragBar: {
        width: 40,
        height: 4,
        backgroundColor: colors.border.color,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.color,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: FONTS.bold,
        color: colors.text.primary,
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 80,
    },
    topSummary: {
        backgroundColor: colors.background.secondary,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border.color,
    },
    summaryTitle: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: colors.text.primary,
        marginBottom: 4,
    },
    fixedBottomActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background.secondary,
        borderTopWidth: 1,
        borderTopColor: colors.border.color,
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: FONTS.medium,
        color: colors.text.primary,
        marginTop: 16,
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: colors.text.muted,
        textAlign: 'center',
    },
    itemCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    addItemCard: {
        borderLeftColor: colors.status.success,
    },
    deleteItemCard: {
        borderLeftColor: colors.status.danger,
    },
    lastItemCard: {
        marginBottom: 100,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    itemName: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: colors.text.primary,
        flex: 1,
        marginRight: 12,
    },
    actionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    addBadge: {
        backgroundColor: `${colors.status.success}20`,
    },
    deleteBadge: {
        backgroundColor: `${colors.status.danger}20`,
    },
    actionText: {
        fontSize: 11,
        fontFamily: FONTS.bold,
    },
    addText: {
        color: colors.status.success,
    },
    deleteText: {
        color: colors.status.danger,
    },
    itemDetails: {
        marginBottom: 12,
    },
    removeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: `${colors.status.danger}10`,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    removeBtnText: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: colors.status.danger,
        marginLeft: 4,
    },
    footerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    clearBtn: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border.color,
        borderRadius: 8,
        alignItems: 'center',
    },
    clearBtnText: {
        fontSize: 14,
        fontFamily: FONTS.medium,
        color: colors.text.secondary,
    },
    processBtn: {
        flex: 2,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.accent.primary,
        borderRadius: 8,
        alignItems: 'center',
    },
    processBtnDisabled: {
        backgroundColor: colors.text.muted,
    },
    processBtnText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: '#fff',
    },
});

export default GenericSideList;
