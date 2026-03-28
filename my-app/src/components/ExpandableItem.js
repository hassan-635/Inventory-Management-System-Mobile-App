import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    LayoutAnimation,
    Platform,
    UIManager,
    useWindowDimensions,
} from 'react-native';
import { useAppTheme } from '../theme/useAppTheme';
import Icon from 'react-native-vector-icons/Ionicons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Companies-style expandable card: icon row, primary/secondary right column, optional 3 summary boxes, then detail rows.
 */
const ExpandableItem = ({
    title,
    subtitle,
    rightText,
    rightSubText,
    rightTextColor,
    summaryBoxes,
    detailsData,
    iconName = 'cube-outline',
    iconSize = 22,
    containerStyle,
    renderActions,
    renderExtra,
}) => {
    const { colors, FONTS } = useAppTheme();
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const styles = useMemo(() => getStyles(colors, FONTS, SCREEN_WIDTH), [colors, FONTS, SCREEN_WIDTH]);
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const entries = detailsData && typeof detailsData === 'object' ? Object.entries(detailsData) : [];
    const primaryColor = rightTextColor ?? colors.text.primary;

    return (
        <View style={[styles.card, containerStyle]}>
            <TouchableOpacity style={styles.cardHeader} onPress={toggleExpand} activeOpacity={0.85}>
                <View style={styles.cardIconWrap}>
                    <Icon name={iconName} size={iconSize} color={colors.accent.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.titleText} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text style={styles.subtitleText} numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    {rightText ? (
                        <Text style={[styles.rightPrimary, { color: primaryColor }]} numberOfLines={1}>
                            {rightText}
                        </Text>
                    ) : null}
                    {rightSubText ? (
                        <Text style={styles.rightSecondary} numberOfLines={1}>
                            {rightSubText}
                        </Text>
                    ) : null}
                </View>
                <Icon
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.text.muted || colors.text.secondary}
                    style={{ marginLeft: 8 }}
                />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.expandedContent}>
                    {summaryBoxes && summaryBoxes.length > 0 ? (
                        <View style={styles.summaryRow}>
                            {summaryBoxes.map((box, i) => (
                                <View
                                    key={i}
                                    style={[styles.summaryBox, box.borderColor ? { borderColor: box.borderColor } : null]}
                                >
                                    <Text style={styles.summaryBoxLabel}>{box.label}</Text>
                                    <Text
                                        style={[
                                            styles.summaryBoxValue,
                                            box.valueColor ? { color: box.valueColor } : null,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {box.value}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    {entries.map(([key, value], index) => (
                        <View key={`${key}-${index}`} style={styles.detailRow}>
                            <Text style={styles.detailKey}>{key}</Text>
                            <Text style={styles.detailValue}>{value ?? '—'}</Text>
                        </View>
                    ))}

                    {renderExtra ? renderExtra() : null}

                    {renderActions ? <View style={styles.actionRowWrap}>{renderActions()}</View> : null}
                </View>
            )}
        </View>
    );
};

const getStyles = (colors, FONTS, SCREEN_WIDTH) =>
    StyleSheet.create({
        card: {
            backgroundColor: colors.background.secondary,
            borderRadius: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border.color || 'rgba(255,255,255,0.05)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
            overflow: 'hidden',
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            gap: 10,
        },
        cardIconWrap: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(99,102,241,0.15)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        titleText: {
            color: colors.text.primary,
            fontFamily: FONTS.bold,
            fontSize: Math.min(15, SCREEN_WIDTH * 0.038),
        },
        subtitleText: {
            color: colors.text.secondary,
            fontFamily: FONTS.regular,
            fontSize: 12,
            marginTop: 2,
        },
        rightPrimary: {
            fontFamily: FONTS.bold,
            fontSize: Math.min(14, SCREEN_WIDTH * 0.035),
        },
        rightSecondary: {
            color: colors.text.secondary,
            fontFamily: FONTS.regular,
            fontSize: 11,
            marginTop: 2,
        },
        expandedContent: {
            borderTopWidth: 1,
            borderTopColor: colors.border.color,
            padding: 14,
            paddingTop: 10,
        },
        summaryRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
        },
        summaryBox: {
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border.color,
            borderRadius: 8,
            padding: 8,
            alignItems: 'center',
        },
        summaryBoxLabel: {
            color: colors.text.secondary,
            fontSize: 10,
            fontFamily: FONTS.medium,
            marginBottom: 3,
        },
        summaryBoxValue: {
            color: colors.text.primary,
            fontSize: 12,
            fontFamily: FONTS.bold,
            textAlign: 'center',
        },
        detailRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.color,
        },
        detailKey: {
            color: colors.text.secondary,
            fontSize: 13,
            fontFamily: FONTS.medium,
            flex: 1,
        },
        detailValue: {
            color: colors.text.secondary,
            fontFamily: FONTS.regular,
            fontSize: 13,
            flex: 1.2,
            textAlign: 'right',
        },
        actionRowWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 12,
        },
    });

export default ExpandableItem;
