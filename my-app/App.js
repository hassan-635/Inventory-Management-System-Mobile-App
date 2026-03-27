import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import CustomToast from './src/components/CustomToast';

export default function App() {
    return (
        <SafeAreaProvider>
            <AppNavigator />
            <CustomToast />
            <StatusBar style="light" />
        </SafeAreaProvider>
    );
}
