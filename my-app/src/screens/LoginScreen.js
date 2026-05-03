import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { authService } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';
import { workspaceStorage } from '../utils/workspaceStorage';
import { primeAuthToken, setApiBaseUrl, getActiveBaseUrl } from '../api/apiClient';
import { COLORS, FONTS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [loginType, setLoginType] = useState('salesman'); // 'salesman' or 'developer'
    const [workspace, setWorkspace] = useState('UZAIR'); // Default to UZAIR
    const setAuth = useAuthStore((state) => state.setAuth);

    React.useEffect(() => {
        const loadWorkspace = async () => {
            const savedWorkspace = await workspaceStorage.getWorkspace();
            if (savedWorkspace) {
                setWorkspace(savedWorkspace);
                setApiBaseUrl(savedWorkspace);
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
            
            // Set and save the base URL before attempting login
            await workspaceStorage.setWorkspace(workspace);
            setApiBaseUrl(workspace);
            console.log('[Login] Attempting login to:', getActiveBaseUrl());
            const data = await authService.login(email, password, loginType);
            // Save token securely (encrypted) instead of plain-text AsyncStorage
            await tokenStorage.setItemAsync('token', data.token);
            primeAuthToken(data.token);
            // Backend returns flat object: { _id, name, email, role, token }
            const user = { id: data._id, name: data.name, email: data.email, role: data.role };
            setAuth(user, data.token);
        } catch (error) {
            // Log full error so developer can inspect in Metro console
            console.error('[Login Error]', JSON.stringify({
                message: error.message,
                code: error.code,
                status: error.response?.status,
                data: error.response?.data,
            }, null, 2));

            let msg;
            if (!error.response) {
                // No response = network failure (wrong IP, server down, phone not on same WiFi)
                msg = `Cannot reach server.\n\nCheck that:\n• Your phone & PC are on the same WiFi\n• Backend is running (npm run dev)\n• IP in .env is correct\n\n(Code: ${error.code || 'NETWORK_ERROR'})`;
            } else {
                // Server responded with an error (wrong credentials, rate-limited, etc.)
                msg = error.response.data?.error || error.response.data?.message || `Server error (${error.response.status})`;
            }
            Alert.alert('Login Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#e0e7ff', '#c7d2fe', '#f3f4f6']} style={StyleSheet.absoluteFillObject} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <View style={styles.formContainer}>
                    <View style={styles.brandRow}>
                        <View style={styles.logoIconWrap}>
                            <Icon name="cube" size={28} color={COLORS.accent.primary} />
                        </View>
                        <Text style={styles.title}>Inventory Pro</Text>
                    </View>
                    <Text style={styles.subtitle}>Welcome back, login to your account</Text>

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

                    <Text style={styles.label}>Select Workspace</Text>
                    <View style={styles.roleSelector}>
                        <TouchableOpacity 
                            style={[styles.roleTab, workspace === 'UZAIR' && styles.activeWorkspaceTab]} 
                            onPress={() => setWorkspace('UZAIR')}
                        >
                            <Text style={[styles.roleTabText, workspace === 'UZAIR' && styles.activeRoleTabText]}>Uzair</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.roleTab, workspace === 'BURHAN' && styles.activeWorkspaceTab]} 
                            onPress={() => setWorkspace('BURHAN')}
                        >
                            <Text style={[styles.roleTabText, workspace === 'BURHAN' && styles.activeRoleTabText]}>Burhan</Text>
                        </TouchableOpacity>
                    </View>

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
                            <Text style={styles.loginButtonText}>Sign In as {loginType === 'developer' ? 'Developer' : 'Salesman'}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
    },
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
    brandRow: {
        alignItems: 'center',
        marginBottom: 8,
    },
    logoIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.2)',
    },
    title: {
        color: '#1f2937',
        fontSize: 28,
        fontFamily: FONTS.bold,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        color: '#6b7280',
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    roleSelector: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        marginBottom: 20,
        padding: 4,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    roleTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeRoleTab: {
        backgroundColor: COLORS.accent.primary,
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    activeWorkspaceTab: {
        backgroundColor: '#10b981', // green shade for workspace to distinguish
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    roleTabText: {
        color: '#6b7280',
        fontFamily: FONTS.medium,
        fontSize: 14,
    },
    activeRoleTabText: {
        color: '#fff',
        fontFamily: FONTS.bold,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#374151',
        marginBottom: 8,
        fontSize: 14,
        fontFamily: FONTS.medium,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 12,
        color: '#1f2937',
        padding: 16,
        fontSize: 16,
    },
    loginButton: {
        backgroundColor: COLORS.accent.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 15,
        shadowColor: COLORS.accent.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    loginButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
