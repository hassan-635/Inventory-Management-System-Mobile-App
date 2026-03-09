import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '../store/authStore';
import { COLORS, FONTS } from '../theme/theme';

// Screens
import LoginScreen from '../screens/LoginScreen';
import ProductsScreen from '../screens/ProductsScreen';
import BuyersScreen from '../screens/BuyersScreen';
import SuppliersScreen from '../screens/SuppliersScreen';
import SalesScreen from '../screens/SalesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import BillingScreen from '../screens/BillingScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import MonthlyReportScreen from '../screens/MonthlyReportScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

import { useSocketNotifications } from '../utils/notifications';

const TabNavigator = () => {
    useSocketNotifications(); // Initialize Real-time Sales Alerts

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: COLORS.background.secondary },
                headerTintColor: COLORS.text.primary,
                headerTitleStyle: { fontFamily: FONTS.bold },
                tabBarStyle: {
                    backgroundColor: COLORS.background.secondary,
                    borderTopColor: COLORS.border.color,
                    paddingBottom: 5,
                    paddingTop: 5,
                },
                tabBarActiveTintColor: COLORS.accent.primary,
                tabBarInactiveTintColor: COLORS.text.secondary,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Products') iconName = focused ? 'cube' : 'cube-outline';
                    else if (route.name === 'Buyers') iconName = focused ? 'people' : 'people-outline';
                    else if (route.name === 'Suppliers') iconName = focused ? 'business' : 'business-outline';
                    else if (route.name === 'Sales') iconName = focused ? 'receipt' : 'receipt-outline';
                    else if (route.name === 'Billing') iconName = focused ? 'document-text' : 'document-text-outline';
                    else if (route.name === 'Report') iconName = focused ? 'pie-chart' : 'pie-chart-outline';
                    else if (route.name === 'Expenses') iconName = focused ? 'cash' : 'cash-outline';
                    else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline';
                    return <Icon name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Products" component={ProductsScreen} />
            <Tab.Screen name="Billing" component={BillingScreen} />
            <Tab.Screen name="Buyers" component={BuyersScreen} />
            <Tab.Screen name="Suppliers" component={SuppliersScreen} />
            <Tab.Screen name="Sales" component={SalesScreen} />
            <Tab.Screen name="Expenses" component={ExpensesScreen} />
            <Tab.Screen name="Report" component={MonthlyReportScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

export default function AppNavigator() {
    const { token, isLoading, setAuth, setLoading } = useAuthStore();

    useEffect(() => {
        const checkToken = async () => {
            try {
                const storedToken = await SecureStore.getItemAsync('token');
                if (storedToken) {
                    // You ideally want to validate the token/get user here
                    setAuth(null, storedToken);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                setLoading(false);
            }
        };
        checkToken();
    }, []);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background.primary }}>
                <ActivityIndicator size="large" color={COLORS.accent.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: COLORS.background.primary } }}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {token == null ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : (
                    <Stack.Screen name="MainTabs" component={TabNavigator} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
