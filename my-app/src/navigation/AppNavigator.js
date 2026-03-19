import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { tokenStorage } from '../utils/tokenStorage';
import { ActivityIndicator, View, Dimensions } from 'react-native';

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
import CompaniesScreen from '../screens/CompaniesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

import { useSocketNotifications } from '../utils/notifications';

// Responsive tab icon size
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_ICON_SIZE = Math.min(22, SCREEN_WIDTH * 0.058);
const TAB_LABEL_SIZE = Math.min(10, SCREEN_WIDTH * 0.026);

const ICON_MAP = {
    Billing: { focused: 'document-text', outline: 'document-text-outline' },
    Products: { focused: 'cube', outline: 'cube-outline' },
    Buyers: { focused: 'people', outline: 'people-outline' },
    Suppliers: { focused: 'business', outline: 'business-outline' },
    Sales: { focused: 'receipt', outline: 'receipt-outline' },
    Companies: { focused: 'briefcase', outline: 'briefcase-outline' },
    Expenses: { focused: 'cash', outline: 'cash-outline' },
    Report: { focused: 'pie-chart', outline: 'pie-chart-outline' },
    Settings: { focused: 'settings', outline: 'settings-outline' },
};

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
                    paddingBottom: 6,
                    paddingTop: 6,
                    height: Math.max(58, SCREEN_WIDTH * 0.14),
                },
                tabBarActiveTintColor: COLORS.accent.primary,
                tabBarInactiveTintColor: COLORS.text.secondary,
                tabBarLabelStyle: {
                    fontFamily: FONTS.medium,
                    fontSize: TAB_LABEL_SIZE,
                },
                tabBarIcon: ({ focused, color }) => {
                    const icons = ICON_MAP[route.name];
                    const iconName = icons ? (focused ? icons.focused : icons.outline) : 'apps-outline';
                    return <Icon name={iconName} size={TAB_ICON_SIZE} color={color} />;
                },
            })}
        >
            {/* Tab order: Billing > Products > Buyers > Suppliers > Sales > Companies > Expenses > Report > Settings */}
            <Tab.Screen name="Billing" component={BillingScreen} />
            <Tab.Screen name="Products" component={ProductsScreen} />
            <Tab.Screen name="Buyers" component={BuyersScreen} />
            <Tab.Screen name="Suppliers" component={SuppliersScreen} />
            <Tab.Screen name="Sales" component={SalesScreen} />
            <Tab.Screen name="Companies" component={CompaniesScreen} />
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
                const storedToken = await tokenStorage.getItemAsync('token');
                if (storedToken) {
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
