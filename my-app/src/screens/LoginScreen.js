import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView,
    Platform, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { authService } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';
import { workspaceStorage } from '../utils/workspaceStorage';
import { primeAuthToken, setApiBaseUrl, getActiveBaseUrl } from '../api/apiClient';
import { COLORS, FONTS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

const WORKSPACES = [
    { key: 'UZAIR',  label: 'Uzair',  subtitle: 'ims-uzair.vercel.app',  color: '#8b5cf6' },
    { key: 'BURHAN', label: 'Burhan', subtitle: 'ims-burhan.vercel.app', color: '#10b981' },
    { key: 'TEST',   label: 'Test',   subtitle: 'localhost (local dev)',  color: '#f97316' },
];

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginType, setLoginType] = useState('salesman');
    const [workspace, setWorkspace] = useState('UZAIR');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const setAuth = useAuthStore((state) => state.setAuth);

    React.useEffect(() => {
        const loadWorkspace = async () => {
            const saved = await workspaceStorage.getWorkspace();
            if (saved && WORKSPACES.find(w => w.key === saved)) {
                setWorkspace(saved);
                setApiBaseUrl(saved);
            }
        };
        loadWorkspace();
    }, []);

    const handleLogin = async () => {
        if (!email || !password || !workspace) {
            Alert.alert('Error', 'Please fill in all fields and select a workspace');
            return;
        }

        try {
            setLoading(true);
            await workspaceStorage.setWorkspace(workspace);
            setApiBaseUrl(workspace);
            // Removed login attempt log for security

            const data = await authService.login(email.trim(), password, loginType);
            await tokenStorage.setItemAsync('token', data.token);
            primeAuthToken(data.token);
            const user = { id: data._id, name: data.name, email: data.email, role: data.role };
            setAuth(user, data.token);
        } catch (error) {
            // Removed error log for security

            let msg;
            if (!error.response) {
                msg = `Cannot reach server.\n\nCheck that:\n• Phone & PC on same WiFi\n• Backend is running\n• IP in .env is correct\n\n(Code: ${error.code || 'NETWORK_ERROR'})`;
            } else {
                msg = error.response.data?.error || error.response.data?.message || `Server error (${error.response.status})`;
            }
            Alert.alert('Login Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    const activeWS = WORKSPACES.find(w => w.key === workspace) || WORKSPACES[0];

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#e0e7ff', '#c7d2fe', '#f3f4f6']} style={StyleSheet.absoluteFillObject} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <View style={styles.formContainer}>
                    {/* Brand */}
                    <View style={styles.brandRow}>
                        <View style={styles.logoIconWrap}>
                            <Icon name="cube" size={28} color={COLORS.accent.primary} />
                        </View>
                        <Text style={styles.title}>Inventory Pro</Text>
                    </View>
                    <Text style={styles.subtitle}>Welcome back, login to your account</Text>

                    {/* Login Type Toggle */}
                    <View style={styles.roleSelector}>
                        <TouchableOpacity
                            style={[styles.roleTab, loginType === 'salesman' && styles.activeRoleTab]}
                            onPress={() => setLoginType('salesman')}
                        >
                            <Text style={[styles.roleTabText, loginType === 'salesman' && styles.activeRoleTabText]}>Salesman</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.roleTab, loginType === 'developer' && styles.activeRoleTab]}
                            onPress={() => setLoginType('developer')}
                        >
                            <Text style={[styles.roleTabText, loginType === 'developer' && styles.activeRoleTabText]}>Developer</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Workspace Dropdown */}
                    <Text style={styles.label}>Workspace</Text>
                    <TouchableOpacity
                        style={[styles.dropdownTrigger, { borderColor: activeWS.color }]}
                        onPress={() => setDropdownOpen(true)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.dropdownLeft}>
                            <View style={[styles.wsColorDot, { backgroundColor: activeWS.color }]} />
                            <View>
                                <Text style={styles.dropdownLabel}>{activeWS.label}</Text>
                                <Text style={styles.dropdownSub}>{activeWS.subtitle}</Text>
                            </View>
                        </View>
                        <Icon name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                    </TouchableOpacity>

                    {/* Dropdown Modal */}
                    <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
                        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownOpen(false)}>
                            <View style={styles.dropdownList}>
                                <Text style={styles.dropdownListTitle}>Select Workspace</Text>
                                {WORKSPACES.map((ws) => (
                                    <TouchableOpacity
                                        key={ws.key}
                                        style={[
                                            styles.dropdownItem,
                                            workspace === ws.key && styles.dropdownItemActive,
                                        ]}
                                        onPress={() => { setWorkspace(ws.key); setDropdownOpen(false); }}
                                    >
                                        <View style={[styles.wsColorDot, { backgroundColor: ws.color }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.dropdownItemLabel, workspace === ws.key && { color: ws.color }]}>
                                                {ws.label}
                                            </Text>
                                            <Text style={styles.dropdownItemSub}>{ws.subtitle}</Text>
                                        </View>
                                        {workspace === ws.key && (
                                            <Icon name="checkmark-circle" size={18} color={ws.color} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </TouchableOpacity>
                    </Modal>

                    {/* Email */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#9ca3af"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor="#9ca3af"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>
                                Sign In as {loginType === 'developer' ? 'Developer' : 'Salesman'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    keyboardView: { flex: 1, justifyContent: 'center' },
    formContainer: {
        padding: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        marginHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#a78bfa',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    brandRow: { alignItems: 'center', marginBottom: 8 },
    logoIconWrap: {
        width: 56, height: 56, borderRadius: 14,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    title: { color: '#1f2937', fontSize: 28, fontFamily: FONTS.bold, marginBottom: 8, textAlign: 'center' },
    subtitle: { color: '#6b7280', fontSize: 14, marginBottom: 20, textAlign: 'center' },

    roleSelector: {
        flexDirection: 'row', backgroundColor: '#f3f4f6',
        borderRadius: 12, marginBottom: 20, padding: 4,
        borderWidth: 1, borderColor: '#e5e7eb',
    },
    roleTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    activeRoleTab: {
        backgroundColor: COLORS.accent.primary,
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
    },
    roleTabText: { color: '#6b7280', fontFamily: FONTS.medium, fontSize: 14 },
    activeRoleTabText: { color: '#fff', fontFamily: FONTS.bold },

    // Dropdown
    dropdownTrigger: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#fff', borderWidth: 1.5, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18,
    },
    dropdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    wsColorDot: { width: 10, height: 10, borderRadius: 5 },
    dropdownLabel: { color: '#1f2937', fontFamily: FONTS.bold, fontSize: 14 },
    dropdownSub: { color: '#9ca3af', fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center',
    },
    dropdownList: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16,
        width: '80%',
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
    },
    dropdownListTitle: {
        color: '#374151', fontFamily: FONTS.bold, fontSize: 15,
        marginBottom: 12, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    },
    dropdownItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10,
    },
    dropdownItemActive: { backgroundColor: '#f9fafb' },
    dropdownItemLabel: { color: '#1f2937', fontFamily: FONTS.medium, fontSize: 14 },
    dropdownItemSub: { color: '#9ca3af', fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 },

    inputGroup: { marginBottom: 20 },
    label: { color: '#374151', marginBottom: 8, fontSize: 14, fontFamily: FONTS.medium },
    input: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
        borderRadius: 12, color: '#1f2937', padding: 16, fontSize: 16,
    },
    loginButton: {
        backgroundColor: COLORS.accent.primary, padding: 16, borderRadius: 12,
        alignItems: 'center', marginTop: 15,
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
    },
    loginButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
