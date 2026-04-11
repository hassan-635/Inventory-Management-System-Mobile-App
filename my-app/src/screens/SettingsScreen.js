import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, Switch, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenStorage } from '../utils/tokenStorage';
import { clearAuthTokenCache } from '../api/apiClient';
import { useAppTheme } from '../theme/useAppTheme';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scheduleAllLowStockNotifications } from '../utils/notifications';

export default function SettingsScreen() {
    const { colors, FONTS } = useAppTheme();
    const { width } = useWindowDimensions();
    const isTablet = width > 768;
    const styles = useMemo(() => getStyles(colors, FONTS, isTablet), [colors, FONTS, isTablet]);

    const isDarkMode = useThemeStore((state) => state.isDarkMode);
    const toggleTheme = useThemeStore((state) => state.toggleTheme);
    const isDark = isDarkMode;
    const [notificationTimes, setNotificationTimes] = useState([]);
    const [showPicker, setShowPicker] = useState(false);
    const [tempTime, setTempTime] = useState(new Date());

    const [shopName, setShopName] = useState('My Store');
    const [shopAddress, setShopAddress] = useState('City, Pakistan');
    const [shopPhone, setShopPhone] = useState('0300-0000000');
    
    const logout = useAuthStore((state) => state.logout);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const timesStr = await AsyncStorage.getItem('notification_times');
                if (timesStr) {
                    setNotificationTimes(JSON.parse(timesStr));
                }
                const shopStr = await AsyncStorage.getItem('shop_settings');
                if (shopStr) {
                    const shop = JSON.parse(shopStr);
                    setShopName(shop.name || 'My Store');
                    setShopAddress(shop.address || 'City, Pakistan');
                    setShopPhone(shop.phone || '0300-0000000');
                }
            } catch (err) {
                console.error("Error loading settings", err);
            }
        };
        loadSettings();
    }, []);

    const saveSettings = async () => {
        try {
            await AsyncStorage.setItem('notification_times', JSON.stringify(notificationTimes));
            await AsyncStorage.setItem('shop_settings', JSON.stringify({
                name: shopName,
                address: shopAddress,
                phone: shopPhone
            }));
            
            // Reschedule notifications based on new times
            await scheduleAllLowStockNotifications(notificationTimes);
            
            useToastStore.getState().showToast('Success', 'Settings saved successfully', 'success');
        } catch (err) {
            useToastStore.getState().showToast('Error', 'Failed to save settings', 'error');
        }
    };

    const handleTimeChange = (event, selectedDate) => {
        if (Platform.OS !== 'ios') {
            setShowPicker(false);
        }
        
        if (selectedDate) {
            if (Platform.OS === 'ios') {
                setTempTime(selectedDate);
            } else {
                addTimeToList(selectedDate);
            }
        }
    };

    const addTimeToList = (dateObj) => {
        const hours = dateObj.getHours();
        const minutes = dateObj.getMinutes();
        
        // Format to HH:MM string (24-hour) for storage
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        if (!notificationTimes.includes(timeString)) {
            const newTimes = [...notificationTimes, timeString].sort();
            setNotificationTimes(newTimes);
        } else {
            Alert.alert('Already Added', 'This time is already in your notification list.');
        }
    };

    const removeTime = (timeToRemove) => {
        setNotificationTimes(notificationTimes.filter(t => t !== timeToRemove));
    };

    const formatTo12Hour = (timeString) => {
        const [h, m] = timeString.split(':');
        let hours = parseInt(h, 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        return `${hours}:${m} ${ampm}`;
    };

    const handleLogout = async () => {
        await tokenStorage.deleteItemAsync('token');
        clearAuthTokenCache();
        logout();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, isTablet && { paddingHorizontal: '15%' }]}>
            <Text style={styles.headerTitle}>App Settings</Text>

            {/* Shop Info Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shop Information</Text>
                <Text style={styles.description}>This information will appear on generated PDFs.</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Shop/Store Name</Text>
                    <TextInput
                        style={styles.textInputFull}
                        value={shopName}
                        onChangeText={setShopName}
                        placeholder="e.g. Jellani Hardware Store"
                        placeholderTextColor={colors.text.muted}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Shop Address</Text>
                    <TextInput
                        style={[styles.textInputFull, { minHeight: 60 }]}
                        value={shopAddress}
                        onChangeText={setShopAddress}
                        placeholder="e.g. Main Kallar Syedan Road..."
                        placeholderTextColor={colors.text.muted}
                        multiline
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                        style={styles.textInputFull}
                        value={shopPhone}
                        onChangeText={setShopPhone}
                        placeholder="e.g. 0329-5749291"
                        placeholderTextColor={colors.text.muted}
                    />
                </View>
            </View>

            {/* Appearance Section */}
            <View style={[styles.section, { marginTop: 16 }]}>
                <Text style={styles.sectionTitle}>Appearance</Text>
                <Text style={styles.description}>Customize the look and feel of your app.</Text>

                <View style={styles.appearanceRow}>
                    <View style={styles.themeInfo}>
                        <Icon name={isDark ? "moon" : "sunny"} size={24} color={isDark ? '#a78bfa' : '#f59e0b'} />
                        <Text style={styles.themeLabel}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
                    </View>
                    <Switch
                        value={isDark}
                        onValueChange={toggleTheme}
                        trackColor={{ false: '#d1d5db', true: colors.accent.primary }}
                        thumbColor={'#fff'}
                    />
                </View>
            </View>



            {/* Notifications Section */}
            <View style={[styles.section, { marginTop: 16 }]}>
                <Text style={styles.sectionTitle}>Notification Times</Text>
                <Text style={styles.description}>Select multiples times when you want to receive low stock notifications.</Text>

                <View style={styles.timeListContainer}>
                    {notificationTimes.length === 0 ? (
                        <Text style={styles.emptyText}>No notification times set.</Text>
                    ) : (
                        notificationTimes.map((time, idx) => (
                            <View key={idx} style={styles.timeTag}>
                                <Icon name="time-outline" size={16} color={colors.accent.primary} />
                                <Text style={styles.timeTagText}>{formatTo12Hour(time)}</Text>
                                <TouchableOpacity onPress={() => removeTime(time)} style={styles.removeTimeBtn}>
                                    <Icon name="close-circle" size={20} color={colors.status?.danger || '#ef4444'} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                {Platform.OS === 'ios' && showPicker ? (
                    <View style={styles.iosPickerContainer}>
                        <DateTimePicker
                            value={tempTime}
                            mode="time"
                            display="spinner"
                            onChange={handleTimeChange}
                            textColor={colors.text.primary}
                        />
                        <TouchableOpacity 
                            style={styles.iosConfirmBtn} 
                            onPress={() => {
                                addTimeToList(tempTime);
                                setShowPicker(false);
                            }}
                        >
                            <Text style={styles.iosConfirmText}>Add Time</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.addTimeBtn} onPress={() => setShowPicker(true)}>
                        <Icon name="add" size={20} color="#fff" />
                        <Text style={styles.addTimeText}>Add Notification Time</Text>
                    </TouchableOpacity>
                )}

                {Platform.OS === 'android' && showPicker && (
                    <DateTimePicker
                        value={tempTime}
                        mode="time"
                        display="default"
                        onChange={handleTimeChange}
                    />
                )}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
                <Text style={styles.saveBtnText}>Save All Settings</Text>
            </TouchableOpacity>

            <View style={[styles.section, { marginTop: 40 }]}>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutBtnText}>Logout Account</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const getStyles = (colors, FONTS, isTablet) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40
    },
    headerTitle: {
        fontSize: 24,
        color: colors.text.primary,
        fontFamily: FONTS.bold,
        marginBottom: 20,
    },
    section: {
        backgroundColor: colors.background.secondary,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border.color || 'rgba(255,255,255,0.05)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    sectionTitle: {
        fontSize: 18,
        color: colors.text.primary,
        fontFamily: FONTS.semibold,
        marginBottom: 8,
    },
    description: {
        color: colors.text.secondary,
        fontSize: 14,
        marginBottom: 16,
        fontFamily: FONTS.regular,
    },
    appearanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border.color || 'rgba(255,255,255,0.05)',
    },
    themeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    themeLabel: {
        fontSize: 16,
        fontFamily: FONTS.medium,
        color: colors.text.primary,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        color: colors.text.primary,
        fontSize: 16,
        marginRight: 10,
        fontFamily: FONTS.medium,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        color: colors.text.secondary,
        fontSize: 13,
        marginBottom: 6,
        fontFamily: FONTS.medium,
        textTransform: 'uppercase',
    },
    textInputFull: {
        backgroundColor: colors.background.tertiary,
        color: colors.text.primary,
        fontFamily: FONTS.medium,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border.color || 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    input: {
        backgroundColor: colors.background.tertiary,
        color: colors.text.primary,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        width: 70,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: colors.border.color,
        fontFamily: FONTS.bold,
        fontSize: 16
    },
    timeListContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    emptyText: {
        color: colors.text.muted,
        fontFamily: FONTS.regular,
        fontStyle: 'italic'
    },
    timeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 8,
    },
    timeTagText: {
        color: colors.text.primary,
        fontFamily: FONTS.medium,
        fontSize: 15,
    },
    removeTimeBtn: {
        marginLeft: 4,
    },
    addTimeBtn: {
        flexDirection: 'row',
        backgroundColor: colors.background.tertiary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border.color,
        gap: 8,
    },
    addTimeText: {
        color: colors.text.primary,
        fontFamily: FONTS.medium,
        fontSize: 15,
    },
    iosPickerContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    iosConfirmBtn: {
        backgroundColor: colors.accent.primary,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 10,
    },
    iosConfirmText: {
        color: '#fff',
        fontFamily: FONTS.bold,
    },
    saveBtn: {
        backgroundColor: colors.accent.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: colors.accent.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    saveBtnText: {
        color: '#fff',
        fontFamily: FONTS.bold,
        fontSize: 16,
    },
    logoutBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    logoutBtnText: {
        color: colors.status?.danger || '#ef4444',
        fontFamily: FONTS.bold,
        fontSize: 16,
    }
});
