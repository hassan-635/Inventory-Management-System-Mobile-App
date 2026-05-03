import axios from 'axios';
import { tokenStorage } from '../utils/tokenStorage';

const SERVER_MAP = {
    UZAIR: process.env.EXPO_PUBLIC_API_URL_UZAIR,
    BURHAN: process.env.EXPO_PUBLIC_API_URL_BURHAN,
};

const SOCKET_MAP = {
    UZAIR: process.env.EXPO_PUBLIC_SOCKET_URL_UZAIR,
    BURHAN: process.env.EXPO_PUBLIC_SOCKET_URL_BURHAN,
};

// Initial base URL defaults to UZAIR for backward compatibility with already logged-in users
let currentBaseURL = SERVER_MAP.UZAIR;
let currentSocketURL = SOCKET_MAP.UZAIR;

const api = axios.create({
    baseURL: currentBaseURL,
    headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
});

export function setApiBaseUrl(workspace) {
    if (SERVER_MAP[workspace]) {
        currentBaseURL = SERVER_MAP[workspace];
        currentSocketURL = SOCKET_MAP[workspace];
        api.defaults.baseURL = currentBaseURL;
        console.log(`[API] Switched to workspace: ${workspace} (${currentBaseURL})`);
    } else {
        console.warn(`[API] Invalid workspace selected: ${workspace}`);
    }
}

export function getSocketUrl() {
    return currentSocketURL;
}

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
        // Skip auto-logout if the error comes from password verification
        const isVerifyEndpoint = error.config && error.config.url && error.config.url.includes('/auth/verify-password');

        if (error.response && error.response.status === 401 && !isVerifyEndpoint) {
            console.warn("Unauthorized request detected (401). Forcing logout.");
            authTokenCache = null;
            await tokenStorage.deleteItemAsync('token');
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);

export default api;
