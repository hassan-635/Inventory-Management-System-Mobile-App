import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { COLORS, FONTS } from '../theme/theme';
import { useAuthStore } from '../store/authStore';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scheduleAllLowStockNotifications } from '../utils/notifications';

export default function SettingsScreen() {
    const [stockLimit, setStockLimit] = useState('10');
    const [notificationTimes, setNotificationTimes] = useState([]);
    const [showPicker, setShowPicker] = useState(false);
    const [tempTime, setTempTime] = useState(new Date());
    
    const logout = useAuthStore((state) => state.logout);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const limit = await AsyncStorage.getItem('low_stock_limit');
                if (limit) setStockLimit(limit);

                const timesStr = await AsyncStorage.getItem('notification_times');
                if (timesStr) {
                    setNotificationTimes(JSON.parse(timesStr));
                }
            } catch (err) {
                console.error("Error loading settings", err);
            }
        };
        loadSettings();
    }, []);

    const saveSettings = async () => {
        if (isNaN(stockLimit) || Number(stockLimit) < 0) {
            Alert.alert('Invalid Input', 'Please enter a valid positive number for stock limit');
            return;
        }

        try {
            await AsyncStorage.setItem('low_stock_limit', stockLimit);
            await AsyncStorage.setItem('notification_times', JSON.stringify(notificationTimes));
            
            // Reschedule notifications based on new times
            await scheduleAllLowStockNotifications(notificationTimes);
            
            Alert.alert('Success', 'Settings saved successfully');
        } catch (err) {
            Alert.alert('Error', 'Failed to save settings');
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
        await SecureStore.deleteItemAsync('token');
        logout();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.headerTitle}>App Settings</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stock Rules</Text>
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
            </View>

            <View style={[styles.section, { marginTop: 16 }]}>
                <Text style={styles.sectionTitle}>Notification Times</Text>
                <Text style={styles.description}>Select multiples times when you want to receive low stock notifications.</Text>

                <View style={styles.timeListContainer}>
                    {notificationTimes.length === 0 ? (
                        <Text style={styles.emptyText}>No notification times set.</Text>
                    ) : (
                        notificationTimes.map((time, idx) => (
                            <View key={idx} style={styles.timeTag}>
                                <Icon name="time-outline" size={16} color={COLORS.accent.primary} />
                                <Text style={styles.timeTagText}>{formatTo12Hour(time)}</Text>
                                <TouchableOpacity onPress={() => removeTime(time)} style={styles.removeTimeBtn}>
                                    <Icon name="close-circle" size={20} color={COLORS.status.danger} />
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
                            textColor="white"
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
        marginBottom: 20,
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
        marginBottom: 8,
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
        width: 70,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: COLORS.border.color,
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
        color: COLORS.text.muted,
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
        color: COLORS.text.primary,
        fontFamily: FONTS.medium,
        fontSize: 15,
    },
    removeTimeBtn: {
        marginLeft: 4,
    },
    addTimeBtn: {
        flexDirection: 'row',
        backgroundColor: COLORS.background.tertiary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border.color,
        gap: 8,
    },
    addTimeText: {
        color: '#fff',
        fontFamily: FONTS.medium,
        fontSize: 15,
    },
    iosPickerContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    iosConfirmBtn: {
        backgroundColor: COLORS.accent.primary,
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
        backgroundColor: COLORS.accent.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
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
