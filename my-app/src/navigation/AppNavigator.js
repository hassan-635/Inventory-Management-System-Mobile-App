import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/Ionicons';
import { tokenStorage } from '../utils/tokenStorage';
import { ActivityIndicator, View, Dimensions, TouchableOpacity } from 'react-native';

import { useAuthStore } from '../store/authStore';
import { useAppTheme } from '../theme/useAppTheme';

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
const Drawer = createDrawerNavigator();

import { useSocketNotifications } from '../utils/notifications';

// Responsive icon size
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_ICON_SIZE = Math.min(22, SCREEN_WIDTH * 0.058);

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

const DrawerNavigator = () => {
    useSocketNotifications(); // Initialize Real-time Sales Alerts
    const { colors, FONTS, isDarkMode } = useAppTheme();

    return (
        <Drawer.Navigator
            screenOptions={({ route, navigation }) => ({
                headerStyle: { backgroundColor: colors.background.secondary },
                headerTintColor: colors.text.primary,
                headerTitleStyle: { fontFamily: FONTS.bold },
                drawerStyle: {
                    backgroundColor: colors.background.secondary,
                    width: Math.min(SCREEN_WIDTH * 0.75, 320),
                },
                drawerActiveBackgroundColor: colors.accent.glow,
                drawerActiveTintColor: colors.accent.primary,
                drawerInactiveTintColor: colors.text.secondary,
                drawerLabelStyle: {
                    fontFamily: FONTS.medium,
                    fontSize: 16,
                },
                headerLeft: () => (
                    <TouchableOpacity 
                        onPress={() => navigation.toggleDrawer()} 
                        style={{ marginLeft: 16 }}
                    >
                        <Icon name="menu" size={26} color={colors.text.primary} />
                    </TouchableOpacity>
                ),
                drawerIcon: ({ focused, color }) => {
                    const icons = ICON_MAP[route.name];
                    const iconName = icons ? (focused ? icons.focused : icons.outline) : 'apps-outline';
                    return <Icon name={iconName} size={DRAWER_ICON_SIZE} color={color} />;
                },
            })}
        >
            <Drawer.Screen name="Billing" component={BillingScreen} />
            <Drawer.Screen name="Products" component={ProductsScreen} />
            <Drawer.Screen name="Buyers" component={BuyersScreen} />
            <Drawer.Screen name="Suppliers" component={SuppliersScreen} />
            <Drawer.Screen name="Sales" component={SalesScreen} />
            <Drawer.Screen name="Companies" component={CompaniesScreen} />
            <Drawer.Screen name="Expenses" component={ExpensesScreen} />
            <Drawer.Screen name="Report" component={MonthlyReportScreen} />
            <Drawer.Screen name="Settings" component={SettingsScreen} />
        </Drawer.Navigator>
    );
};

export default function AppNavigator() {
    const { token, isLoading, setAuth, setLoading } = useAuthStore();
    const { colors, isDarkMode } = useAppTheme();

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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
            </View>
        );
    }

    const navigationTheme = isDarkMode 
        ? { ...NavigationDarkTheme, colors: { ...NavigationDarkTheme.colors, background: colors.background.primary } }
        : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background.primary } };

    return (
        <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {token == null ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : (
                    <Stack.Screen name="MainDrawer" component={DrawerNavigator} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
