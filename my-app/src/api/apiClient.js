import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In development with physical device, use your computer's local IP address instead of localhost.
// Replace with your actual IP, e.g., 'http://192.168.1.X:5000/api'
const API_URL = 'http://192.168.X.X:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
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

export default api;
