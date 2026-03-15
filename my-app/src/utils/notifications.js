import { useEffect } from 'react';
import { io } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { productsService } from '../api/products';

// Load Socket server address from environment variable
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
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

// --- Custom Low Stock Notification Scheduler --- //

export const scheduleAllLowStockNotifications = async (timesArray = null) => {
    try {
        // Cancel all existing scheduled notifications first
        await Notifications.cancelAllScheduledNotificationsAsync();

        // 1. Get times
        let timesToSchedule = timesArray;
        if (!timesToSchedule) {
            const timesStr = await AsyncStorage.getItem('notification_times');
            timesToSchedule = timesStr ? JSON.parse(timesStr) : [];
        }

        if (!timesToSchedule || timesToSchedule.length === 0) return;

        // 2. Fetch limit and check if we even have low stock items right now
        const limitStr = await AsyncStorage.getItem('low_stock_limit');
        const limit = limitStr ? parseInt(limitStr, 10) : 10;
        
        let products = [];
        try {
            products = await productsService.getAll();
        } catch (e) {
            console.log("Could not fetch products for notification scheduling", e);
            return;
        }
        
        const lowStockItems = products.filter(p => parseInt(p.remaining_quantity, 10) <= limit);
        
        // If no low stock items, no need to schedule Daily Alarms right now.
        // But what if they drop tomorrow? Expo background fetch is better for that.
        // For local scheduling, we assume the user checks daily.
        // Setting daily triggers anyway:
        
        for (const timeStr of timesToSchedule) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "⚠️ Inventory Check Reminder",
                    body: `It's time to check your stock! Tap to view Low Stock items.`,
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: hours,
                    minute: minutes,
                },
            });
            console.log(`Scheduled daily stock alert for ${hours}:${minutes}`);
        }

    } catch (err) {
        console.error("Failed to schedule notifications:", err);
    }
};
