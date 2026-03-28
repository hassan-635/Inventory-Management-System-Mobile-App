import { Platform } from 'react-native';

/** Defaults for faster scrolling & lower memory on long lists */
export const flatListPerformanceProps = {
    initialNumToRender: 10,
    maxToRenderPerBatch: 8,
    windowSize: 8,
    updateCellsBatchingPeriod: 50,
    removeClippedSubviews: Platform.OS === 'android',
};
