import { useThemeStore } from '../store/themeStore';
import { LIGHT_COLORS, DARK_COLORS, FONTS, SHADOWS } from './theme';

export const useAppTheme = () => {
    const isDarkMode = useThemeStore((state) => state.isDarkMode);
    const colors = isDarkMode ? DARK_COLORS : LIGHT_COLORS;
    
    // Adjust shadow glows for light mode
    const shadows = {
        ...SHADOWS,
        glow: {
            ...SHADOWS.glow,
            shadowColor: colors.accent.glow,
            opacity: isDarkMode ? 0.8 : 0.3
        }
    };

    return { isDarkMode, colors, FONTS, SHADOWS: shadows };
};
