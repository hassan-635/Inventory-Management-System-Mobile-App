import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fetching URL securely from Environment variables
const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
    console.warn("⚠️ EXPO_PUBLIC_API_URL is missing in .env file! App network requests will fail.");
}

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
});

api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Global Error Handler for Security
import { useAuthStore } from '../store/authStore';

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("Unauthorized request detected (401). Forcing logout.");
            await AsyncStorage.removeItem('token');
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);

export default api;
