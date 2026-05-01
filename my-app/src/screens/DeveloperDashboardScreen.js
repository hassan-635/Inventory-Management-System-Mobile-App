import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, TextInput, 
    ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView, ImageBackground 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '../store/authStore';
import { tokenStorage } from '../utils/tokenStorage';
import api from '../api/apiClient';
import { COLORS, FONTS } from '../theme/theme';

const AUTO_LOGOUT_MS = 3 * 60 * 1000;

export default function DeveloperDashboardScreen() {
    const { user, setAuth } = useAuthStore();
    const [activeTab, setActiveTab] = useState('create');
    const [timeLeft, setTimeLeft] = useState(AUTO_LOGOUT_MS);

    const logoutTimer = useRef(null);
    const countdownTimer = useRef(null);

    // Create Salesman State
    const [csName, setCsName] = useState('');
    const [csEmail, setCsEmail] = useState('');
    const [csPassword, setCsPassword] = useState('');
    const [csShowPwd, setCsShowPwd] = useState(false);
    const [csLoading, setCsLoading] = useState(false);

    // My Credentials State
    const [myName, setMyName] = useState(user?.name || '');
    const [myEmail, setMyEmail] = useState(user?.email || '');
    const [myPassword, setMyPassword] = useState('');
    const [myShowPwd, setMyShowPwd] = useState(false);
    const [myLoading, setMyLoading] = useState(false);

    // Salesman Credentials State
    const [salesmen, setSalesmen] = useState([]);
    const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
    const [smName, setSmName] = useState('');
    const [smEmail, setSmEmail] = useState('');
    const [smPassword, setSmPassword] = useState('');
    const [smShowPwd, setSmShowPwd] = useState(false);
    const [smLoading, setSmLoading] = useState(false);
    const [smListLoading, setSmListLoading] = useState(false);

    const handleLogout = useCallback(async () => {
        clearTimeout(logoutTimer.current);
        clearInterval(countdownTimer.current);
        await tokenStorage.deleteItemAsync('token');
        setAuth(null, null);
    }, [setAuth]);

    const startAutoLogout = useCallback(() => {
        clearTimeout(logoutTimer.current);
        clearInterval(countdownTimer.current);
        setTimeLeft(AUTO_LOGOUT_MS);

        logoutTimer.current = setTimeout(() => {
            Alert.alert('Session Expired', 'You have been automatically logged out for security.', [
                { text: 'OK', onPress: handleLogout }
            ]);
        }, AUTO_LOGOUT_MS);

        countdownTimer.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1000) {
                    clearInterval(countdownTimer.current);
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);
    }, [handleLogout]);

    useEffect(() => {
        startAutoLogout();
        return () => {
            clearTimeout(logoutTimer.current);
            clearInterval(countdownTimer.current);
        };
    }, [startAutoLogout]);

    useEffect(() => {
        if (activeTab === 'salesman') {
            fetchSalesmen();
        }
    }, [activeTab]);

    const fetchSalesmen = async () => {
        setSmListLoading(true);
        try {
            const res = await api.get('/auth/salesmen');
            setSalesmen(res.data.salesmen || []);
        } catch (err) {
            Alert.alert('Error', 'Failed to load salesmen');
        } finally {
            setSmListLoading(false);
        }
    };

    const handleCreateSalesman = async () => {
        if (!csName || !csEmail || !csPassword) {
            Alert.alert('Validation', 'Please fill in all fields.');
            return;
        }
        setCsLoading(true);
        try {
            const response = await api.post('/auth/create-salesman', {
                name: csName, email: csEmail, password: csPassword
            });
            Alert.alert('Success', `Salesman account for "${response.data.salesman.name}" created!`);
            setCsName(''); setCsEmail(''); setCsPassword('');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to create salesman.');
        } finally {
            setCsLoading(false);
        }
    };

    const handleUpdateMyCredentials = async () => {
        setMyLoading(true);
        try {
            const payload = {};
            if (myName.trim()) payload.name = myName.trim();
            if (myEmail.trim()) payload.email = myEmail.trim();
            if (myPassword.trim()) payload.password = myPassword.trim();

            const res = await api.put('/auth/update-credentials', payload);
            setAuth({ ...user, name: res.data.user.name, email: res.data.user.email }, useAuthStore.getState().token);
            setMyPassword('');
            Alert.alert('Success', 'Your credentials have been updated successfully!');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to update credentials.');
        } finally {
            setMyLoading(false);
        }
    };

    const handleSelectSalesman = (id) => {
        setSelectedSalesmanId(id);
        const found = salesmen.find(s => s.id === id || s._id === id);
        if (found) {
            setSmName(found.name);
            setSmEmail(found.email);
            setSmPassword('');
        }
    };

    const handleUpdateSalesmanCredentials = async () => {
        if (!selectedSalesmanId) return;
        setSmLoading(true);
        try {
            const payload = { targetId: selectedSalesmanId };
            if (smName.trim()) payload.name = smName.trim();
            if (smEmail.trim()) payload.email = smEmail.trim();
            if (smPassword.trim()) payload.password = smPassword.trim();

            await api.put('/auth/update-credentials', payload);
            await fetchSalesmen();
            setSmPassword('');
            Alert.alert('Success', 'Salesman credentials updated successfully!');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to update salesman.');
        } finally {
            setSmLoading(false);
        }
    };

    const formatTime = (ms) => {
        const total = Math.ceil(ms / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#e0e7ff', '#c7d2fe', '#f3f4f6']} style={StyleSheet.absoluteFillObject} />
            
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.iconGlow}>
                        <Icon name="hardware-chip" size={32} color={COLORS.accent.primary} />
                    </View>
                    <View style={{ marginLeft: 14 }}>
                        <Text style={styles.headerTitle}>Developer Panel</Text>
                        <Text style={styles.headerSubtitle}>{user?.email}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.logoutGradient}>
                        <Icon name="log-out-outline" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <View style={styles.timerBanner}>
                <Icon name="shield-checkmark" size={18} color="#fff" />
                <Text style={styles.timerText}>Secure Session: {formatTime(timeLeft)}</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'create' && styles.activeTab]} onPress={() => setActiveTab('create')}>
                    <Icon name="person-add" size={18} color={activeTab === 'create' ? '#fff' : '#6b7280'} />
                    <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'my-creds' && styles.activeTab]} onPress={() => setActiveTab('my-creds')}>
                    <Icon name="shield-checkmark" size={18} color={activeTab === 'my-creds' ? '#fff' : '#6b7280'} />
                    <Text style={[styles.tabText, activeTab === 'my-creds' && styles.activeTabText]}>My Creds</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'salesman' && styles.activeTab]} onPress={() => setActiveTab('salesman')}>
                    <Icon name="people" size={18} color={activeTab === 'salesman' ? '#fff' : '#6b7280'} />
                    <Text style={[styles.tabText, activeTab === 'salesman' && styles.activeTabText]}>Salesmen</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    
                    {/* CREATE SALESMAN */}
                    {activeTab === 'create' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Register New Salesman</Text>
                            <Text style={styles.cardSubtitle}>Fill in details to create a new salesman account.</Text>

                            <Text style={styles.label}>Full Name</Text>
                            <TextInput style={styles.input} placeholder="Ali Khan" placeholderTextColor="#9ca3af" value={csName} onChangeText={setCsName} />

                            <Text style={styles.label}>Email Address</Text>
                            <TextInput style={styles.input} placeholder="alikhan@inventorypro.com" placeholderTextColor="#9ca3af" value={csEmail} onChangeText={setCsEmail} autoCapitalize="none" keyboardType="email-address" />

                            <Text style={styles.label}>Password</Text>
                            <View style={styles.pwdWrapper}>
                                <TextInput style={styles.pwdInput} placeholder="••••••••" placeholderTextColor="#9ca3af" value={csPassword} onChangeText={setCsPassword} secureTextEntry={!csShowPwd} />
                                <TouchableOpacity onPress={() => setCsShowPwd(!csShowPwd)} style={styles.pwdToggle}>
                                    <Icon name={csShowPwd ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.actionBtn} onPress={handleCreateSalesman} disabled={csLoading}>
                                {csLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Create Salesman Account</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* MY CREDENTIALS */}
                    {activeTab === 'my-creds' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Update My Credentials</Text>
                            <Text style={styles.cardSubtitle}>Update your name, email or password.</Text>

                            <Text style={styles.label}>Name</Text>
                            <TextInput style={styles.input} placeholder="Your name" placeholderTextColor="#9ca3af" value={myName} onChangeText={setMyName} />

                            <Text style={styles.label}>Email</Text>
                            <TextInput style={styles.input} placeholder="Your email" placeholderTextColor="#9ca3af" value={myEmail} onChangeText={setMyEmail} autoCapitalize="none" keyboardType="email-address" />

                            <Text style={styles.label}>New Password (Optional)</Text>
                            <View style={styles.pwdWrapper}>
                                <TextInput style={styles.pwdInput} placeholder="Leave blank to keep current" placeholderTextColor="#9ca3af" value={myPassword} onChangeText={setMyPassword} secureTextEntry={!myShowPwd} />
                                <TouchableOpacity onPress={() => setMyShowPwd(!myShowPwd)} style={styles.pwdToggle}>
                                    <Icon name={myShowPwd ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#8b5cf6'}]} onPress={handleUpdateMyCredentials} disabled={myLoading}>
                                {myLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Save My Credentials</Text>}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* SALESMAN CREDENTIALS */}
                    {activeTab === 'salesman' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Update Salesman Credentials</Text>
                            
                            {smListLoading ? (
                                <ActivityIndicator color={COLORS.accent.primary} style={{ marginVertical: 20 }} />
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                    {salesmen.map(s => {
                                        const id = s.id || s._id;
                                        const isSelected = selectedSalesmanId === id;
                                        return (
                                            <TouchableOpacity 
                                                key={id} 
                                                style={[styles.smChip, isSelected && styles.smChipSelected]}
                                                onPress={() => handleSelectSalesman(id)}
                                            >
                                                <Text style={[styles.smChipText, isSelected && {color: '#fff'}]}>{s.name}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            {selectedSalesmanId ? (
                                <View>
                                    <Text style={styles.label}>Name</Text>
                                    <TextInput style={styles.input} value={smName} onChangeText={setSmName} placeholderTextColor="#9ca3af" />

                                    <Text style={styles.label}>Email</Text>
                                    <TextInput style={styles.input} value={smEmail} onChangeText={setSmEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#9ca3af" />

                                    <Text style={styles.label}>New Password (Optional)</Text>
                                    <View style={styles.pwdWrapper}>
                                        <TextInput style={styles.pwdInput} placeholder="Leave blank to keep current" placeholderTextColor="#9ca3af" value={smPassword} onChangeText={setSmPassword} secureTextEntry={!smShowPwd} />
                                        <TouchableOpacity onPress={() => setSmShowPwd(!smShowPwd)} style={styles.pwdToggle}>
                                            <Icon name={smShowPwd ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#10b981'}]} onPress={handleUpdateSalesmanCredentials} disabled={smLoading}>
                                        {smLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Save Salesman Credentials</Text>}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={{ color: '#6b7280', textAlign: 'center' }}>Select a salesman from above to edit.</Text>
                            )}
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 40 : 20,
        paddingBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconGlow: {
        width: 50,
        height: 50,
        borderRadius: 16,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    headerTitle: {
        color: '#1f2937',
        fontSize: 22,
        fontFamily: FONTS.bold,
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        color: '#6b7280',
        fontSize: 13,
        fontFamily: FONTS.medium,
        marginTop: 2,
    },
    logoutBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    logoutGradient: {
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerBanner: {
        backgroundColor: '#ecfdf5',
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#a7f3d0',
    },
    timerText: {
        color: '#059669',
        fontSize: 13,
        fontFamily: FONTS.bold,
        marginLeft: 8,
        letterSpacing: 0.5,
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 20,
        backgroundColor: '#e5e7eb',
        borderRadius: 16,
        padding: 6,
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: COLORS.accent.primary,
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    tabText: {
        color: '#4b5563',
        fontFamily: FONTS.medium,
        fontSize: 13,
        marginLeft: 8,
    },
    activeTabText: {
        color: '#fff',
        fontFamily: FONTS.bold,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#a78bfa',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    cardTitle: {
        color: '#1f2937',
        fontSize: 20,
        fontFamily: FONTS.bold,
        marginBottom: 6,
    },
    cardSubtitle: {
        color: '#6b7280',
        fontSize: 14,
        fontFamily: FONTS.regular,
        marginBottom: 24,
    },
    label: {
        color: '#4b5563',
        fontSize: 13,
        marginBottom: 8,
        fontFamily: FONTS.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 14,
        padding: 16,
        color: '#1f2937',
        marginBottom: 20,
        fontSize: 16,
        fontFamily: FONTS.regular,
    },
    pwdWrapper: {
        flexDirection: 'row',
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 14,
        marginBottom: 24,
        alignItems: 'center',
    },
    pwdInput: {
        flex: 1,
        padding: 16,
        color: '#1f2937',
        fontSize: 16,
        fontFamily: FONTS.regular,
    },
    pwdToggle: {
        padding: 16,
    },
    actionBtn: {
        backgroundColor: COLORS.accent.primary,
        padding: 18,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    actionBtnText: {
        color: '#fff',
        fontFamily: FONTS.bold,
        fontSize: 16,
        letterSpacing: 0.5,
    },
    smChip: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        backgroundColor: '#f3f4f6',
        borderRadius: 24,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    smChipSelected: {
        backgroundColor: '#10b981',
        borderColor: '#059669',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    smChipText: {
        color: '#374151',
        fontFamily: FONTS.medium,
        fontSize: 14,
    }
});
