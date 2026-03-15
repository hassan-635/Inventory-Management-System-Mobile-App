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

// Register notification categories
Notifications.setNotificationCategoryAsync('LOW_STOCK_ZERO', [
    {
        identifier: 'DELETE_ITEM',
        buttonTitle: '🗑️ Delete Item',
        options: { isDestructive: true },
    },
]);

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

        // --- Notification Response Listener for Actions --- //
        const responseListener = Notifications.addNotificationResponseReceivedListener(async response => {
            const actionIdentifier = response.actionIdentifier;
            const data = response.notification.request.content.data;
            
            if (actionIdentifier === 'DELETE_ITEM' && data?.product_id) {
                console.log("Delete action triggered for product:", data.product_id);
                try {
                    await productsService.delete(data.product_id);
                    // Dismiss the notification since we handled it
                    await Notifications.dismissNotificationAsync(response.notification.request.identifier);
                    console.log(`Product ${data.product_id} deleted successfully from notification`);
                } catch (err) {
                    console.error("Failed to delete product from notification", err);
                }
            }
        });

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
            Notifications.removeNotificationSubscription(responseListener);
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
        
        if (lowStockItems.length === 0) return;
        
        // Loop through configured times
        for (const timeStr of timesToSchedule) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            // Loop through each low stock item to create individual notifications
            for (let i = 0; i < lowStockItems.length; i++) {
                const item = lowStockItems[i];
                const qty = parseInt(item.remaining_quantity, 10);
                const isZero = qty === 0;
                
                // Add a small delay/offset to prevent Notification engine spamming failure
                // We space them out by a few seconds per item if there are many.
                // However, Daily triggers require hour/minute. We can't easily offset by seconds in expo daily triggers
                // Instead, they will group up in the notification tray.

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: isZero ? "❌ Out of Stock Alert" : "⚠️ Low Stock Alert",
                        body: `${item.name}: ${qty} remaining.`,
                        sound: true,
                        priority: Notifications.AndroidNotificationPriority.HIGH,
                        categoryIdentifier: isZero ? 'LOW_STOCK_ZERO' : null,
                        data: { product_id: item.id },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DAILY,
                        hour: hours,
                        minute: minutes,
                    },
                });
            }
            console.log(`Scheduled ${lowStockItems.length} individual daily stock alerts for ${hours}:${minutes}`);
        }

    } catch (err) {
        console.error("Failed to schedule notifications:", err);
    }
};
