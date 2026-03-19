import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { authService } from '../api/auth';
import { tokenStorage } from '../utils/tokenStorage';
import { COLORS, FONTS } from '../theme/theme';

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
                    <Text style={styles.title}>Inventory Pro</Text>
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
        padding: 24,
        backgroundColor: COLORS.glass.bg,
        marginHorizontal: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.glass.border,
    },
    title: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
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
        borderColor: COLORS.border.color,
        borderRadius: 8,
        color: '#fff',
        padding: 14,
        fontSize: 16,
    },
    loginButton: {
        backgroundColor: COLORS.accent.primary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    loginButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
