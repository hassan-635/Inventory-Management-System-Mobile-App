import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useToastStore } from '../store/toastStore';
import { COLORS, FONTS } from '../theme/theme';

const { width } = Dimensions.get('window');

const CustomToast = () => {
    const { visible, title, message, type, hideToast } = useToastStore();
    const translateY = useRef(new Animated.Value(-150)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(translateY, {
                toValue: 50, // slide down distance
                useNativeDriver: true,
                friction: 6,
                tension: 40
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: -150,
                duration: 300,
                useNativeDriver: true
            }).start();
        }
    }, [visible]);

    const getIcon = () => {
        switch (type) {
            case 'success': return 'checkmark-circle';
            case 'error': return 'close-circle';
            case 'info': return 'information-circle';
            default: return 'alert-circle';
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', icon: '#22c55e' };
            case 'error': return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', icon: '#ef4444' };
            case 'info': return { bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', icon: '#38bdf8' };
            default: return { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.2)', icon: '#fff' };
        }
    };

    const themeColors = getColors();

    return (
        <Animated.View style={[
            styles.container, 
            { transform: [{ translateY }] },
            { backgroundColor: COLORS.glass.bg, borderColor: themeColors.border }
        ]}>
            <View style={[styles.iconContainer, { backgroundColor: themeColors.bg }]}>
                <Icon name={getIcon()} size={28} color={themeColors.icon} />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {message ? <Text style={styles.message} numberOfLines={2}>{message}</Text> : null}
            </View>
            <TouchableOpacity onPress={hideToast} style={styles.closeBtn}>
                <Icon name="close" size={20} color={COLORS.text.muted} />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        alignSelf: 'center',
        width: width * 0.9,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
        zIndex: 99999, // Ensure it's on top of everything including Modals theoretically (if outside standard tree)
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        color: COLORS.text.primary,
        fontFamily: FONTS.bold,
        fontSize: 16,
        marginBottom: 2,
    },
    message: {
        color: COLORS.text.secondary,
        fontFamily: FONTS.regular,
        fontSize: 13,
    },
    closeBtn: {
        padding: 8,
        marginLeft: 8,
    }
});

export default CustomToast;
