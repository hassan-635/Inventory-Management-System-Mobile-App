import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

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

/** undefined = not loaded yet; avoids AsyncStorage on every request after first read */
let authTokenCache = undefined;

export function primeAuthToken(token) {
    authTokenCache = token ? String(token) : null;
}

export function clearAuthTokenCache() {
    authTokenCache = undefined;
}

api.interceptors.request.use(
    async (config) => {
        if (authTokenCache === undefined) {
            const t = await tokenStorage.getItemAsync('token');
            authTokenCache = t ? String(t) : null;
        }
        if (authTokenCache) {
            config.headers.Authorization = `Bearer ${authTokenCache}`;
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
            authTokenCache = null;
            await tokenStorage.deleteItemAsync('token');
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);

export default api;
