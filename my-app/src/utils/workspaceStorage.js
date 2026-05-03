import AsyncStorage from '@react-native-async-storage/async-storage';

const WORKSPACE_KEY = 'selected_workspace';

export const workspaceStorage = {
    async setWorkspace(workspace) {
        try {
            await AsyncStorage.setItem(WORKSPACE_KEY, workspace);
        } catch (e) {
            console.error('Failed to save workspace', e);
        }
    },
    async getWorkspace() {
        try {
            return await AsyncStorage.getItem(WORKSPACE_KEY);
        } catch (e) {
            console.error('Failed to get workspace', e);
            return null;
        }
    },
    async clearWorkspace() {
        try {
            await AsyncStorage.removeItem(WORKSPACE_KEY);
        } catch (e) {
            console.error('Failed to clear workspace', e);
        }
    }
};
