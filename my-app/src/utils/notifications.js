import { useEffect } from 'react';
import { io } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';

// Replace with your actual IP
const SOCKET_URL = 'http://192.168.X.X:5000';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const useSocketNotifications = () => {
    const token = useAuthStore(state => state.token);

    useEffect(() => {
        // Request permission
        const requestPermissions = async () => {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get push token for push notification!');
                return;
            }
        };

        if (Platform.OS !== 'web') {
            requestPermissions();
        }

        if (!token) return;

        // Connect to Socket
        const socket = io(SOCKET_URL);

        socket.on('connect', () => {
            console.log('Connected to socket server');
        });

        // Listen for new sales
        socket.on('new_sale', async (data) => {
            console.log('New sale received via socket:', data);

            // Trigger local notification
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "🧾 New Sale Alert!",
                    body: `${data.sale?.quantity || 1}x ${data.sale?.product_name || 'Item'} sold for Rs. ${data.sale?.total_amount}`,
                    data: { data },
                },
                trigger: null, // trigger immediately
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [token]);
};
