import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, TextInput, 
    ScrollView, Alert, ActivityIndicator, SafeAreaView, Platform, KeyboardAvoidingView 
} from 'react-native';
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
        await tokenStorage.removeItemAsync('token');
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
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Icon name="hardware-chip" size={28} color={COLORS.accent.primary} />
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.headerTitle}>Developer Panel</Text>
                        <Text style={styles.headerSubtitle}>{user?.email}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Icon name="log-out-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
            </View>

            <View style={styles.timerBanner}>
                <Icon name="time-outline" size={16} color="#fff" />
                <Text style={styles.timerText}>Auto-logout in: {formatTime(timeLeft)}</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'create' && styles.activeTab]} onPress={() => setActiveTab('create')}>
                    <Icon name="person-add" size={18} color={activeTab === 'create' ? '#fff' : COLORS.text.secondary} />
                    <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'my-creds' && styles.activeTab]} onPress={() => setActiveTab('my-creds')}>
                    <Icon name="shield-checkmark" size={18} color={activeTab === 'my-creds' ? '#fff' : COLORS.text.secondary} />
                    <Text style={[styles.tabText, activeTab === 'my-creds' && styles.activeTabText]}>My Creds</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'salesman' && styles.activeTab]} onPress={() => setActiveTab('salesman')}>
                    <Icon name="people" size={18} color={activeTab === 'salesman' ? '#fff' : COLORS.text.secondary} />
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
                            <TextInput style={styles.input} placeholder="Ali Khan" placeholderTextColor={COLORS.text.muted} value={csName} onChangeText={setCsName} />

                            <Text style={styles.label}>Email Address</Text>
                            <TextInput style={styles.input} placeholder="alikhan@inventorypro.com" placeholderTextColor={COLORS.text.muted} value={csEmail} onChangeText={setCsEmail} autoCapitalize="none" keyboardType="email-address" />

                            <Text style={styles.label}>Password</Text>
                            <View style={styles.pwdWrapper}>
                                <TextInput style={styles.pwdInput} placeholder="••••••••" placeholderTextColor={COLORS.text.muted} value={csPassword} onChangeText={setCsPassword} secureTextEntry={!csShowPwd} />
                                <TouchableOpacity onPress={() => setCsShowPwd(!csShowPwd)} style={styles.pwdToggle}>
                                    <Icon name={csShowPwd ? 'eye-off' : 'eye'} size={20} color={COLORS.text.muted} />
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
                            <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={COLORS.text.muted} value={myName} onChangeText={setMyName} />

                            <Text style={styles.label}>Email</Text>
                            <TextInput style={styles.input} placeholder="Your email" placeholderTextColor={COLORS.text.muted} value={myEmail} onChangeText={setMyEmail} autoCapitalize="none" keyboardType="email-address" />

                            <Text style={styles.label}>New Password (Optional)</Text>
                            <View style={styles.pwdWrapper}>
                                <TextInput style={styles.pwdInput} placeholder="Leave blank to keep current" placeholderTextColor={COLORS.text.muted} value={myPassword} onChangeText={setMyPassword} secureTextEntry={!myShowPwd} />
                                <TouchableOpacity onPress={() => setMyShowPwd(!myShowPwd)} style={styles.pwdToggle}>
                                    <Icon name={myShowPwd ? 'eye-off' : 'eye'} size={20} color={COLORS.text.muted} />
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
                                    <TextInput style={styles.input} value={smName} onChangeText={setSmName} placeholderTextColor={COLORS.text.muted} />

                                    <Text style={styles.label}>Email</Text>
                                    <TextInput style={styles.input} value={smEmail} onChangeText={setSmEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={COLORS.text.muted} />

                                    <Text style={styles.label}>New Password (Optional)</Text>
                                    <View style={styles.pwdWrapper}>
                                        <TextInput style={styles.pwdInput} placeholder="Leave blank to keep current" placeholderTextColor={COLORS.text.muted} value={smPassword} onChangeText={setSmPassword} secureTextEntry={!smShowPwd} />
                                        <TouchableOpacity onPress={() => setSmShowPwd(!smShowPwd)} style={styles.pwdToggle}>
                                            <Icon name={smShowPwd ? 'eye-off' : 'eye'} size={20} color={COLORS.text.muted} />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#10b981'}]} onPress={handleUpdateSalesmanCredentials} disabled={smLoading}>
                                        {smLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Save Salesman Credentials</Text>}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Text style={{ color: COLORS.text.secondary, textAlign: 'center' }}>Select a salesman from above to edit.</Text>
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
        backgroundColor: COLORS.background.primary,
    },
    header: {
        flexDirection: 'row',
        padding: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.color,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontFamily: FONTS.bold,
    },
    headerSubtitle: {
        color: COLORS.text.secondary,
        fontSize: 12,
        fontFamily: FONTS.regular,
    },
    logoutBtn: {
        padding: 8,
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 8,
    },
    timerBanner: {
        backgroundColor: '#ef4444',
        padding: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: FONTS.bold,
        marginLeft: 6,
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: COLORS.accent.primary,
    },
    tabText: {
        color: COLORS.text.secondary,
        fontFamily: FONTS.medium,
        fontSize: 13,
        marginLeft: 6,
    },
    activeTabText: {
        color: '#fff',
        fontFamily: FONTS.bold,
    },
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border.color,
    },
    cardTitle: {
        color: '#fff',
        fontSize: 18,
        fontFamily: FONTS.bold,
        marginBottom: 4,
    },
    cardSubtitle: {
        color: COLORS.text.secondary,
        fontSize: 13,
        marginBottom: 20,
    },
    label: {
        color: COLORS.text.secondary,
        fontSize: 13,
        marginBottom: 8,
        fontFamily: FONTS.medium,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: COLORS.border.color,
        borderRadius: 10,
        padding: 14,
        color: '#fff',
        marginBottom: 16,
        fontSize: 15,
    },
    pwdWrapper: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: COLORS.border.color,
        borderRadius: 10,
        marginBottom: 20,
        alignItems: 'center',
    },
    pwdInput: {
        flex: 1,
        padding: 14,
        color: '#fff',
        fontSize: 15,
    },
    pwdToggle: {
        padding: 14,
    },
    actionBtn: {
        backgroundColor: COLORS.accent.primary,
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#fff',
        fontFamily: FONTS.bold,
        fontSize: 15,
    },
    smChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: COLORS.border.color,
    },
    smChipSelected: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    smChipText: {
        color: COLORS.text.secondary,
        fontFamily: FONTS.medium,
    }
});
