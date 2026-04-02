import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useAppTheme } from '../theme/useAppTheme';
import api from '../api/apiClient';
import { tokenStorage } from '../utils/tokenStorage';
import { useAuthStore } from '../store/authStore';

const AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutes

export default function DatabaseExportScreen({ navigation }) {
    const { colors, FONTS } = useAppTheme();
    const logout = useAuthStore(state => state.logout);

    /* ── password-gate state ── */
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [enteredPassword, setEnteredPassword] = useState('');
    const [showEnteredPw, setShowEnteredPw] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(AUTO_LOCK_MS);

    /* ── export / clear state ── */
    const [isExporting, setIsExporting] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [confirmCode, setConfirmCode] = useState('');
    
    const lockTimer = useRef(null);
    const countdownTimer = useRef(null);

    // Styles memo
    const styles = useMemo(() => createStyles(colors, FONTS), [colors, FONTS]);

    const lockPage = useCallback(() => {
        setIsUnlocked(false);
        setEnteredPassword('');
        setPwError('');
        setTimeLeft(AUTO_LOCK_MS);
        clearTimeout(lockTimer.current);
        clearInterval(countdownTimer.current);
    }, []);

    const startAutoLock = useCallback(() => {
        clearTimeout(lockTimer.current);
        clearInterval(countdownTimer.current);
        setTimeLeft(AUTO_LOCK_MS);

        lockTimer.current = setTimeout(() => lockPage(), AUTO_LOCK_MS);

        countdownTimer.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1000) return 0;
                return prev - 1000;
            });
        }, 1000);
    }, [lockPage]);

    // Lock unconditionally when unmounting or leaving focus
    useFocusEffect(
        useCallback(() => {
            return () => {
                lockPage();
            };
        }, [lockPage])
    );

    useEffect(() => {
        return () => {
            clearTimeout(lockTimer.current);
            clearInterval(countdownTimer.current);
        };
    }, []);

    const handlePasswordSubmit = async () => {
        if (!enteredPassword.trim()) return;

        setPwLoading(true);
        setPwError('');

        try {
            await api.post('/auth/verify-password', { password: enteredPassword.trim() });
            // Password correct
            setIsUnlocked(true);
            startAutoLock();
        } catch (err) {
            setPwError('Galat password! Dobara koshish karein.');
            setEnteredPassword('');
        } finally {
            setPwLoading(false);
        }
    };

    const formatTime = (ms) => {
        const total = Math.ceil(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const token = await tokenStorage.getItemAsync('token');
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
            const endpoint = `${apiUrl}/export/export-csv`;
            
            const fileUri = FileSystem.documentDirectory + `database_export_${new Date().toISOString().split('T')[0]}.csv`;

            const downloadRes = await FileSystem.downloadAsync(endpoint, fileUri, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (downloadRes.status !== 200) {
                throw new Error("Download failed");
            }

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(downloadRes.uri);
            } else {
                Alert.alert("Info", `Database saved to: ${downloadRes.uri}`);
            }
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert("Error", "❌ Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    const handleClearData = async () => {
        if (confirmCode !== 'DELETE_MY_DATA') return;
        
        try {
            setIsClearing(true);
            await api.post('/export/clear-data', { confirmCode: 'DELETE_MY_DATA' });
            Alert.alert("Success", "✅ All data cleared successfully!");
            setShowClearConfirm(false);
            setConfirmCode('');
            
            // Wait shortly, then logout
            setTimeout(async () => {
                await tokenStorage.deleteItemAsync('token');
                logout();
            }, 1500);

        } catch (error) {
            Alert.alert("Error", '❌ Failed to clear data: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsClearing(false);
        }
    };

    if (!isUnlocked) {
        return (
            <View style={styles.protectedWrapper}>
                <View style={styles.pwCard}>
                    <View style={styles.pwIconWrap}>
                        <Icon name="lock-closed" size={36} color={colors.accent.primary} />
                    </View>
                    <Text style={styles.pwTitle}>Protected Area</Text>
                    <Text style={styles.pwSubtitle}>
                        This screen is restricted to authorized users only.{"\n"}
                        Enter your account login password to continue.
                    </Text>

                    <View style={styles.inputWrap}>
                        <TextInput
                            style={[styles.pwInput, pwError ? styles.pwInputError : null]}
                            value={enteredPassword}
                            onChangeText={(t) => { setEnteredPassword(t); setPwError(''); }}
                            placeholder="Enter your login password..."
                            placeholderTextColor={colors.text.muted}
                            secureTextEntry={!showEnteredPw}
                            editable={!pwLoading}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowEnteredPw(!showEnteredPw)}>
                            <Icon name={showEnteredPw ? "eye-off" : "eye"} size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {pwError ? <Text style={styles.pwErrorText}>⚠️ {pwError}</Text> : null}

                    <TouchableOpacity 
                        style={[styles.submitBtn, (pwLoading || !enteredPassword.trim()) ? styles.submitBtnDisabled : null]}
                        onPress={handlePasswordSubmit}
                        disabled={pwLoading || !enteredPassword.trim()}
                    >
                        {pwLoading ? (
                            <>
                                <ActivityIndicator size="small" color="#fff" style={{marginRight: 8}}/>
                                <Text style={styles.submitBtnText}>Verifying...</Text>
                            </>
                        ) : (
                            <>
                                <Icon name="key" size={16} color="#fff" style={{marginRight: 6}} />
                                <Text style={styles.submitBtnText}>Unlock Screen</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.unlockedWrapper}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.header}>
                    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8}}>
                        <Icon name="server" size={28} color={colors.text.primary} style={{marginRight: 10}}/>
                        <Text style={styles.headerTitle}>Database Management</Text>
                    </View>
                    <Text style={styles.headerSubtitle}>Export your complete data or clear everything</Text>
                </View>

                {/* Export Section */}
                <View style={[styles.actionCard, {borderColor: 'rgba(59, 130, 246, 0.3)'}]}>
                    <View style={styles.actionHeader}>
                        <View style={[styles.iconBox, {backgroundColor: 'rgba(59, 130, 246, 0.15)'}]}>
                            <Icon name="document-text" size={32} color="#3b82f6" />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.actionTitle}>Export Database</Text>
                            <Text style={styles.actionSub}>Download all your data as CSV file</Text>
                        </View>
                    </View>
                    <View style={styles.actionContent}>
                        <View style={styles.dataPreviewBox}>
                            <Text style={styles.previewHeading}>What will be exported:</Text>
                            <Text style={styles.previewLine}>📦 All Products</Text>
                            <Text style={styles.previewLine}>💰 All Sales Records</Text>
                            <Text style={styles.previewLine}>👥 All Buyers</Text>
                            <Text style={styles.previewLine}>🏪 All Suppliers</Text>
                            <Text style={styles.previewLine}>💸 All Expenses</Text>
                            <Text style={styles.previewLine}>📋 All Purchases</Text>
                        </View>
                        <TouchableOpacity 
                            style={[styles.exportBtn, isExporting && styles.btnDisabled]} 
                            onPress={handleExport}
                            disabled={isExporting}
                        >
                            <Icon name="download" size={20} color="#fff" style={{marginRight: 8}}/>
                            <Text style={styles.btnText}>{isExporting ? 'Exporting...' : 'Download CSV'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Clear Section */}
                <View style={[styles.actionCard, styles.dangerCard]}>
                    <View style={styles.actionHeader}>
                        <View style={[styles.iconBox, {backgroundColor: 'rgba(239, 68, 68, 0.15)'}]}>
                            <Icon name="warning" size={32} color="#ef4444" />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.actionTitle}>Clear Database</Text>
                            <Text style={styles.actionSub}>Permanently delete all your data</Text>
                        </View>
                    </View>
                    <View style={styles.actionContent}>
                        <View style={styles.warningBox}>
                            <Icon name="shield" size={22} color="#ef4444" style={{marginTop: 2, marginRight: 10}}/>
                            <View style={{flex: 1}}>
                                <Text style={styles.warningHeading}>⚠️ WARNING: This action cannot be undone!</Text>
                                <Text style={styles.warningLine}>All data will be permanently deleted including products, sales, history, and analytics.</Text>
                            </View>
                        </View>

                        {!showClearConfirm ? (
                            <TouchableOpacity 
                                style={[styles.dangerBtn, isClearing && styles.btnDisabled]}
                                onPress={() => setShowClearConfirm(true)}
                                disabled={isClearing}
                            >
                                <Icon name="trash" size={20} color="#fff" style={{marginRight: 8}}/>
                                <Text style={styles.btnText}>Clear All Data</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.confirmBox}>
                                <Text style={styles.confirmHeading}>Type "DELETE_MY_DATA" to confirm:</Text>
                                <TextInput
                                    style={styles.confirmInput}
                                    value={confirmCode}
                                    onChangeText={setConfirmCode}
                                    placeholder="DELETE_MY_DATA"
                                    placeholderTextColor={colors.text.muted}
                                    autoCapitalize="characters"
                                    editable={!isClearing}
                                />
                                <View style={styles.confirmBtnRow}>
                                    <TouchableOpacity 
                                        style={[styles.cancelBtn, isClearing && styles.btnDisabled]}
                                        onPress={() => { setShowClearConfirm(false); setConfirmCode(''); }}
                                        disabled={isClearing}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.confirmDangerBtn, (isClearing || confirmCode !== 'DELETE_MY_DATA') && styles.btnDisabled]}
                                        onPress={handleClearData}
                                        disabled={isClearing || confirmCode !== 'DELETE_MY_DATA'}
                                    >
                                        <Icon name="trash" size={18} color="#fff" style={{marginRight: 4}}/>
                                        <Text style={styles.btnText}>{isClearing ? 'Deleting...' : 'Delete Everything'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
                
                <View style={{height: 60}} />
            </ScrollView>

            {/* Countdown Badge overlay */}
            <View style={[styles.countdownBadge, timeLeft <= 30000 ? styles.countdownWarning : null]}>
                <Icon name="time" size={16} color={timeLeft <= 30000 ? "#f87171" : colors.accent.primary} />
                <Text style={[styles.countdownText, timeLeft <= 30000 && {color: '#f87171'}]}>
                    Auto-lock: {formatTime(timeLeft)}
                </Text>
                <TouchableOpacity onPress={lockPage} style={styles.lockNowBtn}>
                    <Text style={styles.lockNowText}>Lock Now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function createStyles(colors, FONTS) {
    return StyleSheet.create({
        protectedWrapper: {
            flex: 1,
            backgroundColor: colors.background.primary,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
        },
        unlockedWrapper: {
            flex: 1,
            backgroundColor: colors.background.primary,
        },
        scrollContainer: {
            padding: 20,
            paddingBottom: 40,
        },
        pwCard: {
            width: '100%',
            maxWidth: 400,
            backgroundColor: colors.background.secondary,
            borderRadius: 20,
            padding: 30,
            borderWidth: 1,
            borderColor: 'rgba(139, 92, 246, 0.35)',
            alignItems: 'center',
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
        },
        pwIconWrap: {
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(139,92,246,0.15)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 20,
            borderWidth: 1.5,
            borderColor: 'rgba(139, 92, 246, 0.4)',
        },
        pwTitle: {
            fontFamily: FONTS.bold,
            fontSize: 22,
            color: colors.text.primary,
            marginBottom: 8,
            textAlign: 'center'
        },
        pwSubtitle: {
            fontFamily: FONTS.regular,
            fontSize: 14,
            color: colors.text.secondary,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 20
        },
        inputWrap: {
            width: '100%',
            position: 'relative',
            marginBottom: 12
        },
        pwInput: {
            width: '100%',
            backgroundColor: colors.background.primary,
            borderWidth: 1,
            borderColor: colors.border.color,
            borderRadius: 12,
            padding: 14,
            paddingRight: 46,
            color: colors.text.primary,
            fontFamily: FONTS.medium,
            fontSize: 16
        },
        pwInputError: {
            borderColor: '#ef4444'
        },
        eyeBtn: {
            position: 'absolute',
            right: 12,
            top: 15,
            padding: 4
        },
        pwErrorText: {
            width: '100%',
            color: '#ef4444',
            fontFamily: FONTS.medium,
            fontSize: 13,
            marginBottom: 12,
            marginTop: -4
        },
        submitBtn: {
            width: '100%',
            flexDirection: 'row',
            backgroundColor: colors.accent.primary,
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8
        },
        submitBtnDisabled: {
            opacity: 0.6
        },
        submitBtnText: {
            color: '#fff',
            fontFamily: FONTS.bold,
            fontSize: 16
        },
        header: {
            alignItems: 'center',
            marginBottom: 30,
            marginTop: 10
        },
        headerTitle: {
            fontFamily: FONTS.bold,
            fontSize: 24,
            color: colors.text.primary
        },
        headerSubtitle: {
            fontFamily: FONTS.regular,
            fontSize: 15,
            color: colors.text.secondary,
            textAlign: 'center'
        },
        actionCard: {
            backgroundColor: colors.background.secondary,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border.color,
            marginBottom: 20,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
        },
        dangerCard: {
            borderColor: 'rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)'
        },
        actionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20
        },
        iconBox: {
            width: 52,
            height: 52,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16
        },
        actionTitle: {
            fontFamily: FONTS.bold,
            fontSize: 18,
            color: colors.text.primary,
            marginBottom: 4
        },
        actionSub: {
            fontFamily: FONTS.medium,
            fontSize: 13,
            color: colors.text.secondary
        },
        actionContent: {
            width: '100%'
        },
        dataPreviewBox: {
            backgroundColor: colors.background.primary,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.color,
            marginBottom: 20
        },
        previewHeading: {
            fontFamily: FONTS.semibold,
            color: colors.text.primary,
            marginBottom: 10,
            fontSize: 15
        },
        previewLine: {
            fontFamily: FONTS.regular,
            color: colors.text.secondary,
            fontSize: 14,
            marginBottom: 6,
            marginLeft: 4
        },
        exportBtn: {
            flexDirection: 'row',
            backgroundColor: '#3b82f6',
            padding: 14,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center'
        },
        btnText: {
            fontFamily: FONTS.bold,
            color: '#fff',
            fontSize: 15
        },
        dangerBtn: {
            flexDirection: 'row',
            backgroundColor: '#ef4444',
            padding: 14,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center'
        },
        btnDisabled: {
            opacity: 0.6
        },
        warningBox: {
            flexDirection: 'row',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
            borderWidth: 1,
            padding: 16,
            borderRadius: 12,
            marginBottom: 20
        },
        warningHeading: {
            fontFamily: FONTS.bold,
            color: '#ef4444',
            fontSize: 14,
            marginBottom: 6
        },
        warningLine: {
            fontFamily: FONTS.regular,
            color: colors.text.primary,
            fontSize: 13,
            lineHeight: 18
        },
        confirmBox: {
            backgroundColor: colors.background.primary,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border.color
        },
        confirmHeading: {
            fontFamily: FONTS.semibold,
            color: colors.text.primary,
            fontSize: 15,
            marginBottom: 12
        },
        confirmInput: {
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.color,
            borderRadius: 8,
            padding: 12,
            color: colors.text.primary,
            fontFamily: 'monospace',
            fontSize: 16,
            marginBottom: 16
        },
        confirmBtnRow: {
            flexDirection: 'row',
            gap: 12
        },
        cancelBtn: {
            flex: 1,
            padding: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border.color,
            borderRadius: 8
        },
        cancelBtnText: {
            fontFamily: FONTS.bold,
            color: colors.text.secondary,
            fontSize: 15
        },
        confirmDangerBtn: {
            flex: 1,
            flexDirection: 'row',
            padding: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#dc2626',
            borderRadius: 8
        },
        countdownBadge: {
            position: 'absolute',
            bottom: 24,
            right: 20,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderWidth: 1,
            borderColor: 'rgba(139, 92, 246, 0.4)',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 30,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
        },
        countdownWarning: {
            borderColor: 'rgba(239, 68, 68, 0.6)',
        },
        countdownText: {
            fontFamily: FONTS.bold,
            color: colors.accent.primary,
            fontSize: 13,
            marginLeft: 8,
            marginRight: 10
        },
        lockNowBtn: {
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            borderWidth: 1,
            borderColor: 'rgba(139, 92, 246, 0.4)',
            paddingVertical: 4,
            paddingHorizontal: 12,
            borderRadius: 20
        },
        lockNowText: {
            fontFamily: FONTS.bold,
            color: colors.accent.primary,
            fontSize: 12
        }
    });
}
