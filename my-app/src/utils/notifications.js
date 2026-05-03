import { useEffect } from 'react';
import { io } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { productsService } from '../api/products';
import { useDataRefreshStore } from '../store/dataRefreshStore';

import { getSocketUrl, subscribeSocketUrl } from '../api/apiClient';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// Android requires a notification channel — without this, ALL notifications are silently dropped
async function setupAndroidChannel() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('sales-alerts', {
            name: 'Sales Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
            enableLights: true,
            lightColor: '#8b5cf6',
        });
        await Notifications.setNotificationChannelAsync('stock-alerts', {
            name: 'Stock Alerts',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
        });
        console.log('[Notifications] Android channels registered');
    }
}

// Run once at module load
setupAndroidChannel();

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
                    await Notifications.dismissNotificationAsync(response.notification.request.identifier);
                    console.log(`Product ${data.product_id} deleted successfully from notification`);
                } catch (err) {
                    console.error("Failed to delete product from notification", err);
                }
            }
        });

        if (!token) return;

        // --- Socket connection helper --- //
        // Returns the socket instance so we can disconnect it later
        const connectSocket = (socketUrl) => {
            console.log('[Notifications] Connecting socket to:', socketUrl);
            const socket = io(socketUrl);

            socket.on('connect', () => {
                console.log('[Notifications] Socket connected:', socketUrl);
            });

            socket.on('disconnect', () => {
                console.log('[Notifications] Socket disconnected from:', socketUrl);
            });

            // Listen for new sales from THIS workspace's server only
            socket.on('new_sale', async (data) => {
                console.log('[Notifications] New sale received:', data);
                useDataRefreshStore.getState().bumpInventory();

                let notifBody = '';
                const cartItems = data.cart_items; // only present from billing.controller

                if (cartItems && cartItems.length > 0) {
                    // Multi-item bill: one line per product
                    notifBody = cartItems
                        .map(item => `${item.quantity}x ${item.product_name} — Rs. ${Number(item.total_amount).toLocaleString()}`)
                        .join('\n');
                } else {
                    // Single sale from sales.controller
                    const sale = data.sale || {};
                    const name   = sale.product_name || 'Unknown Item';
                    const qty    = sale.quantity ?? 1;
                    const amount = sale.total_amount != null
                        ? `Rs. ${Number(sale.total_amount).toLocaleString()}`
                        : 'N/A';
                    notifBody = `${qty}x ${name} — ${amount}`;
                }

                const isCredit = data.bill_type === 'CREDIT';
                const notifTitle = isCredit ? '🧾 New Credit Bill!' : '🧾 New Paid Bill!';

                const total = data.total_amount != null ? Number(data.total_amount).toLocaleString() : '0';
                const paid = data.paid_amount != null ? Number(data.paid_amount).toLocaleString() : total;
                const method = data.payment_method || 'Cash';

                notifBody += `\n---\nTotal: Rs. ${total}`;
                notifBody += `\nPaid: Rs. ${paid} (${method})`;

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: notifTitle,
                        body: notifBody,
                        data: { data },
                        sound: 'default',
                        ...(Platform.OS === 'android' && { channelId: 'sales-alerts' }),
                    },
                    trigger: null,
                });
            });

            return socket;
        };

        // Initial connection to current workspace
        let activeSocket = connectSocket(getSocketUrl());

        // Subscribe to workspace switches — disconnect old, connect new
        const unsubscribe = subscribeSocketUrl((newSocketUrl) => {
            console.log('[Notifications] Workspace changed, reconnecting socket...');
            activeSocket.disconnect();
            activeSocket = connectSocket(newSocketUrl);
        });

        return () => {
            activeSocket.disconnect();
            unsubscribe();
            if (responseListener) {
                responseListener.remove();
            }
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

        // 2. Fetch products and check if we have low stock items right now
        let products = [];
        try {
            products = await productsService.getAll();
        } catch (e) {
            console.log("Could not fetch products for notification scheduling", e);
            return;
        }
        
        const lowStockItems = products.filter(p => {
            const rem = parseInt(p.remaining_quantity, 10);
            const thr = p.low_stock_threshold !== undefined && p.low_stock_threshold !== null ? parseInt(p.low_stock_threshold, 10) : 10;
            return rem <= thr;
        });
        
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
                        sound: 'default',
                        priority: Notifications.AndroidNotificationPriority.HIGH,
                        categoryIdentifier: isZero ? 'LOW_STOCK_ZERO' : null,
                        data: { product_id: item.id },
                        ...(Platform.OS === 'android' && { channelId: 'stock-alerts' }),
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
