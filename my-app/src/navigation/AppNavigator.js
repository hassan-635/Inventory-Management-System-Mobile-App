import React, { useEffect, useMemo } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/Ionicons';
import { tokenStorage } from '../utils/tokenStorage';
import { primeAuthToken, clearAuthTokenCache } from '../api/apiClient';
import { ActivityIndicator, View, Text, Dimensions, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import DailyReportScreen from '../screens/DailyReportScreen';
import CompaniesScreen from '../screens/CompaniesScreen';
import DatabaseExportScreen from '../screens/DatabaseExportScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

import { useSocketNotifications } from '../utils/notifications';

// Responsive icon size
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_ICON_SIZE = Math.min(22, SCREEN_WIDTH * 0.058);

const ICON_MAP = {
    Billing: { focused: 'document-text', outline: 'document-text-outline' },
    Products: { focused: 'cube', outline: 'cube-outline' },
    Customers: { focused: 'people', outline: 'people-outline' },
    Suppliers: { focused: 'business', outline: 'business-outline' },
    Sales: { focused: 'receipt', outline: 'receipt-outline' },
    Companies: { focused: 'briefcase', outline: 'briefcase-outline' },
    Expenses: { focused: 'cash', outline: 'cash-outline' },
    'Monthly Report': { focused: 'pie-chart', outline: 'pie-chart-outline' },
    'Daily Report': { focused: 'calendar', outline: 'calendar-outline' },
    'Database Export': { focused: 'server', outline: 'server-outline' },
    Settings: { focused: 'settings', outline: 'settings-outline' },
};

/** Center header: logo + app name (+ current screen) — fills the top bar area */
function DrawerScreenHeaderTitle({ routeName }) {
    const { colors, FONTS } = useAppTheme();
    const styles = useMemo(
        () =>
            StyleSheet.create({
                wrap: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    maxWidth: SCREEN_WIDTH - 130,
                },
                iconBox: {
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(99, 102, 241, 0.28)',
                },
                textCol: { marginLeft: 10, flexShrink: 1 },
                appName: {
                    fontFamily: FONTS.bold,
                    fontSize: 17,
                    color: colors.text.primary,
                    letterSpacing: 0.2,
                },
                screenLabel: {
                    fontFamily: FONTS.medium,
                    fontSize: 11,
                    color: colors.text.secondary,
                    marginTop: 1,
                },
            }),
        [colors, FONTS]
    );

    return (
        <View style={styles.wrap}>
            <View style={styles.iconBox}>
                <Icon name="cube" size={20} color={colors.accent.primary} />
            </View>
            <View style={styles.textCol}>
                <Text style={styles.appName} numberOfLines={1}>
                    Inventory Pro
                </Text>
                <Text style={styles.screenLabel} numberOfLines={1}>
                    {routeName}
                </Text>
            </View>
        </View>
    );
}

function AppDrawerContent(props) {
    const { colors, FONTS } = useAppTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getDrawerContentStyles(colors, FONTS), [colors, FONTS]);

    return (
        <View style={[styles.root, { backgroundColor: colors.background.secondary }]}>
            <View style={styles.drawerHeader}>
                <View style={styles.logoIconWrap}>
                    <Icon name="cube" size={26} color={colors.accent.primary} />
                </View>
                <Text style={styles.appTitle}>Inventory Pro</Text>
                <Text style={styles.appSubtitle}>Inventory, billing & reports</Text>
            </View>

            <DrawerContentScrollView
                {...props}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
            >
                <DrawerItemList {...props} />
            </DrawerContentScrollView>

            <View style={[styles.drawerFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
                <View style={styles.adCard}>
                    <Text style={styles.adHeading}>Software Developed by Hassan Ali Abrar</Text>
                    <Text style={styles.adBody}>
                        Instagram:{' '}
                        <Text style={styles.adAccentInfo}>hassan.secure</Text>
                        {'  |  '}
                        WhatsApp:{' '}
                        <Text style={styles.adAccentOk}>+92 348 5055098</Text>
                    </Text>
                    <Text style={styles.adTagline}>
                        Contact for custom software development & business automation
                    </Text>
                </View>
            </View>
        </View>
    );
}

const DrawerNavigator = () => {
    useSocketNotifications(); // Initialize Real-time Sales Alerts
    const { colors, FONTS } = useAppTheme();

    return (
        <Drawer.Navigator
            drawerContent={(p) => <AppDrawerContent {...p} />}
            screenOptions={({ route, navigation }) => ({
                headerStyle: { backgroundColor: colors.background.secondary },
                headerTintColor: colors.text.primary,
                headerTitleAlign: 'center',
                headerTitle: () => <DrawerScreenHeaderTitle routeName={route.name} />,
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
            <Drawer.Screen name="Customers" component={BuyersScreen} />
            <Drawer.Screen name="Suppliers" component={SuppliersScreen} />
            <Drawer.Screen name="Sales" component={SalesScreen} />
            <Drawer.Screen name="Companies" component={CompaniesScreen} />
            <Drawer.Screen name="Expenses" component={ExpensesScreen} />
            <Drawer.Screen name="Monthly Report" component={MonthlyReportScreen} />
            <Drawer.Screen name="Daily Report" component={DailyReportScreen} />
            <Drawer.Screen name="Database Export" component={DatabaseExportScreen} />
            <Drawer.Screen name="Settings" component={SettingsScreen} />
        </Drawer.Navigator>
    );
};

function getDrawerContentStyles(colors, FONTS) {
    return StyleSheet.create({
        root: { flex: 1 },
        drawerHeader: {
            paddingTop: 20,
            paddingBottom: 16,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.color,
            alignItems: 'center',
        },
        logoIconWrap: {
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
            borderWidth: 1,
            borderColor: 'rgba(99, 102, 241, 0.28)',
        },
        appTitle: {
            fontFamily: FONTS.bold,
            fontSize: 20,
            color: colors.text.primary,
            letterSpacing: 0.3,
        },
        appSubtitle: {
            fontFamily: FONTS.regular,
            fontSize: 12,
            color: colors.text.secondary,
            marginTop: 4,
            textAlign: 'center',
        },
        scroll: { flex: 1 },
        scrollContent: { paddingTop: 8, flexGrow: 1 },
        drawerFooter: {
            paddingHorizontal: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border.color,
        },
        adCard: {
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            backgroundColor: colors.background.primary,
            borderWidth: 1,
            borderColor: colors.border.color,
        },
        adHeading: {
            fontFamily: FONTS.bold,
            fontSize: 12,
            color: colors.text.primary,
            letterSpacing: 0.4,
            marginBottom: 8,
            textAlign: 'center',
        },
        adBody: {
            fontFamily: FONTS.regular,
            fontSize: 11,
            color: colors.text.secondary,
            textAlign: 'center',
            lineHeight: 16,
            marginBottom: 6,
        },
        adAccentInfo: { fontFamily: FONTS.semibold, color: colors.accent.secondary },
        adAccentOk: { fontFamily: FONTS.semibold, color: colors.status.success },
        adTagline: {
            fontFamily: FONTS.regular,
            fontSize: 10,
            color: colors.text.muted,
            textAlign: 'center',
            lineHeight: 14,
        },
    });
}

export default function AppNavigator() {
    const { token, isLoading, setAuth, setLoading } = useAuthStore();
    const { colors, isDarkMode } = useAppTheme();

    useEffect(() => {
        const checkToken = async () => {
            try {
                const storedToken = await tokenStorage.getItemAsync('token');
                if (storedToken) {
                    primeAuthToken(storedToken);
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
