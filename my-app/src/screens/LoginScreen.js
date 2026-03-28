import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { authService } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';
import { COLORS, FONTS } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const setAuth = useAuthStore((state) => state.setAuth);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            setLoading(true);
            const data = await authService.login(email, password);
            // Save token securely (encrypted) instead of plain-text AsyncStorage
            await tokenStorage.setItemAsync('token', data.token);
            // Backend returns flat object: { _id, name, email, role, token }
            const user = { id: data._id, name: data.name, email: data.email, role: data.role };
            setAuth(user, data.token);
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.message || 'Login failed. Please check credentials.';
            Alert.alert('Login Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <View style={styles.formContainer}>
                    <View style={styles.brandRow}>
                        <View style={styles.logoIconWrap}>
                            <Icon name="cube" size={28} color={COLORS.accent.primary} />
                        </View>
                        <Text style={styles.title}>Inventory Pro</Text>
                    </View>
                    <Text style={styles.subtitle}>Welcome back, login to your account</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={COLORS.text.muted}
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
                            placeholderTextColor={COLORS.text.muted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Sign In</Text>
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
        backgroundColor: COLORS.background.primary,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
    },
    formContainer: {
        padding: 28,
        backgroundColor: COLORS.glass.bg || 'rgba(25, 26, 35, 0.85)',
        marginHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: COLORS.glass.border || 'rgba(255, 255, 255, 0.1)',
        shadowColor: COLORS.accent.primary || '#6366f1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
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
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.28)',
    },
    title: {
        color: '#fff',
        fontSize: 28,
        fontFamily: FONTS.bold,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        color: COLORS.text.secondary,
        fontSize: 14,
        marginBottom: 32,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: COLORS.text.secondary,
        marginBottom: 8,
        fontSize: 14,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: COLORS.border.color || 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        color: '#fff',
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
