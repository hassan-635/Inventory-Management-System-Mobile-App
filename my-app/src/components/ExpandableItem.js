import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { COLORS, FONTS, SHADOWS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ExpandableItem = ({ title, subtitle, rightText, detailsData, iconName = 'cube-outline', containerStyle }) => {
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
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.background.secondary,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border.color,
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
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: COLORS.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
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
        paddingTop: 8,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderTopWidth: 1,
        borderTopColor: COLORS.border.color,
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
});

export default ExpandableItem;
