import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { COLORS, FONTS, SHADOWS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ExpandableItem = ({ title, subtitle, rightText, detailsData, iconName = 'cube-outline', containerStyle, renderActions, renderExtra }) => {
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View style={[styles.container, containerStyle]}>
            <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.8}>
                <View style={styles.headerLeft}>
                    <View style={styles.iconContainer}>
                        <Icon name={iconName} size={20} color={COLORS.accent.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
                        {subtitle && <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">{subtitle}</Text>}
                    </View>
                </View>
                <View style={styles.headerRight}>
                    {rightText && <Text style={styles.rightText}>{rightText}</Text>}
                    <Icon name={expanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.text.secondary} style={{ marginLeft: 8 }} />
                </View>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.detailsContainer}>
                    {Object.entries(detailsData).map(([key, value], index) => (
                        <View key={index} style={styles.detailRow}>
                            <Text style={styles.detailKey}>{key}:</Text>
                            <Text style={styles.detailValue}>{value || '-'}</Text>
                        </View>
                    ))}
                    {renderExtra && renderExtra()}
                    {renderActions && (
                        <View style={styles.actionsContainer}>
                            {renderActions()}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.background.secondary,
        borderRadius: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: COLORS.border.color || 'rgba(255,255,255,0.05)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.background.tertiary || 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    title: {
        color: COLORS.text.primary,
        fontSize: 16,
        fontWeight: '600',
        fontFamily: FONTS.semibold,
    },
    subtitle: {
        color: COLORS.text.secondary,
        fontSize: 13,
        marginTop: 2,
        fontFamily: FONTS.regular,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rightText: {
        color: COLORS.text.primary,
        fontSize: 15,
        fontWeight: '600',
        fontFamily: FONTS.semibold,
    },
    detailsContainer: {
        padding: 16,
        paddingTop: 12,
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderTopWidth: 1,
        borderTopColor: COLORS.border.color || 'rgba(255,255,255,0.02)',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    detailKey: {
        color: COLORS.text.secondary,
        fontSize: 14,
        fontFamily: FONTS.medium,
        flex: 1,
    },
    detailValue: {
        color: COLORS.text.primary,
        fontSize: 14,
        fontFamily: FONTS.regular,
        flex: 2,
        textAlign: 'right',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        gap: 12,
    },
});

export default ExpandableItem;
