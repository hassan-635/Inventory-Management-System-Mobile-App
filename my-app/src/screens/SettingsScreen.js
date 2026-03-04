import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { COLORS, FONTS } from '../theme/theme';
import { useAuthStore } from '../store/authStore';

export default function SettingsScreen() {
    const [stockLimit, setStockLimit] = useState('10');
    const logout = useAuthStore((state) => state.logout);

    useEffect(() => {
        const loadSettings = async () => {
            const limit = await AsyncStorage.getItem('low_stock_limit');
            if (limit) setStockLimit(limit);
        };
        loadSettings();
    }, []);

    const saveSettings = async () => {
        if (isNaN(stockLimit) || Number(stockLimit) < 0) {
            Alert.alert('Invalid Input', 'Please enter a valid positive number');
            return;
        }
        await AsyncStorage.setItem('low_stock_limit', stockLimit);
        Alert.alert('Success', 'Settings saved successfully');
    };

    const handleLogout = async () => {
        await SecureStore.deleteItemAsync('token');
        logout();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>App Settings</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                <Text style={styles.description}>Set the remaining quantity limit to trigger low stock alerts.</Text>

                <View style={styles.inputRow}>
                    <Text style={styles.label}>Low Stock Limit:</Text>
                    <TextInput
                        style={styles.input}
                        value={stockLimit}
                        onChangeText={setStockLimit}
                        keyboardType="numeric"
                        maxLength={4}
                    />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
                    <Text style={styles.saveBtnText}>Save Settings</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.section, { marginTop: 'auto' }]}>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutBtnText}>Logout Account</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background.primary,
        padding: 16,
    },
    headerTitle: {
        fontSize: 24,
        color: COLORS.text.primary,
        fontFamily: FONTS.bold,
        marginBottom: 24,
    },
    section: {
        backgroundColor: COLORS.background.secondary,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border.color,
    },
    sectionTitle: {
        fontSize: 18,
        color: COLORS.text.primary,
        fontFamily: FONTS.semibold,
        marginBottom: 8,
    },
    description: {
        color: COLORS.text.secondary,
        fontSize: 14,
        marginBottom: 16,
        fontFamily: FONTS.regular,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    label: {
        color: COLORS.text.primary,
        fontSize: 16,
        marginRight: 10,
        fontFamily: FONTS.medium,
    },
    input: {
        backgroundColor: COLORS.background.tertiary,
        color: COLORS.text.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        width: 60,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: COLORS.border.color,
    },
    saveBtn: {
        backgroundColor: COLORS.accent.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    logoutBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.status.danger,
    },
    logoutBtnText: {
        color: COLORS.status.danger,
        fontWeight: 'bold',
        fontSize: 16,
    }
});
