export const FONTS = {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
};

export const COLORS = {
    background: {
        primary: '#09090b',
        secondary: '#18181b',
        tertiary: '#27272a',
    },
    accent: {
        primary: '#8b5cf6',
        secondary: '#c084fc',
        glow: 'rgba(139, 92, 246, 0.4)',
    },
    text: {
        primary: '#ffffff',
        secondary: '#a1a1aa',
        muted: '#71717a',
    },
    border: {
        color: 'rgba(255, 255, 255, 0.1)',
        highlight: 'rgba(255, 255, 255, 0.2)',
    },
    status: {
        danger: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
    },
    glass: {
        bg: 'rgba(24, 24, 27, 0.6)',
        border: 'rgba(255, 255, 255, 0.08)',
    }
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 8,
    },
    glow: {
        shadowColor: COLORS.accent.glow,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 10,
    }
};
