// 主题配置类型
export type ThemeName = 'coral' | 'aurora' | 'star' | 'matcha' | 'sakura' | 'midnight';

export interface ThemeConfig {
  name: string;
  displayName: string;
  colors: {
    primary: string;
    primaryLight: string;
    secondary: string;
    secondaryLight: string;
    accent: string;
    accentLight: string;
    warning: string;
    bgColor: string;
    cardBg: string;
    textPrimary: string;
    textSecondary: string;
    borderColor: string;
    success: string;
    danger: string;
    shadow: string;
    messageBar: string;
  };
  gradient: {
    header: string;
    card: string;
    summary: string;
    stat: string;
    overview: string;
  };
  animation: {
    transition: string;
    bounce: boolean;
  };
}

// 主题预设配置
export const themes: Record<ThemeName, ThemeConfig> = {
  coral: {
    name: 'coral',
    displayName: '珊瑚红',
    colors: {
      primary: '#ff6b6b',
      primaryLight: '#ff8e8e',
      secondary: '#4ecdc4',
      secondaryLight: '#7ee8e1',
      accent: '#45b7d1',
      accentLight: '#6dd5e8',
      warning: '#f9ca24',
      bgColor: '#f8f9fa',
      cardBg: '#ffffff',
      textPrimary: '#2d3436',
      textSecondary: '#636e72',
      borderColor: '#e0e0e0',
      success: '#00b894',
      danger: '#d63031',
      shadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      messageBar: '#fff3e0',
    },
    gradient: {
      header: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
      card: 'linear-gradient(135deg, #667eea, #764ba2)',
      summary: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
      stat: 'linear-gradient(135deg, #4ecdc4, #4ecdc4)',
      overview: 'linear-gradient(135deg, #667eea, #764ba2)',
    },
    animation: {
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: true,
    },
  },
  aurora: {
    name: 'aurora',
    displayName: '极光紫',
    colors: {
      primary: '#a855f7',
      primaryLight: '#c084fc',
      secondary: '#c4b5fd',
      secondaryLight: '#ddd6fe',
      accent: '#8b5cf6',
      accentLight: '#a78bfa',
      warning: '#fbbf24',
      bgColor: '#faf5ff',
      cardBg: '#ffffff',
      textPrimary: '#1e1b4b',
      textSecondary: '#6b7280',
      borderColor: '#e9d5ff',
      success: '#a78bfa',
      danger: '#ef4444',
      shadow: '0 2px 12px rgba(168, 85, 247, 0.12)',
      messageBar: '#f5f3ff',
    },
    gradient: {
      header: 'linear-gradient(135deg, #a855f7, #8b5cf6)',
      card: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
      summary: 'linear-gradient(135deg, #a855f7, #c084fc)',
      stat: 'linear-gradient(135deg, #c4b5fd, #ddd6fe)',
      overview: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
    },
    animation: {
      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      bounce: true,
    },
  },
  star: {
    name: 'star',
    displayName: '星空蓝',
    colors: {
      primary: '#3b82f6',
      primaryLight: '#60a5fa',
      secondary: '#0ea5e9',
      secondaryLight: '#38bdf8',
      accent: '#6366f1',
      accentLight: '#818cf8',
      warning: '#fbbf24',
      bgColor: '#f0f9ff',
      cardBg: '#ffffff',
      textPrimary: '#1e3a5f',
      textSecondary: '#64748b',
      borderColor: '#bae6fd',
      success: '#22c55e',
      danger: '#ef4444',
      shadow: '0 2px 12px rgba(59, 130, 246, 0.12)',
      messageBar: '#eff6ff',
    },
    gradient: {
      header: 'linear-gradient(135deg, #3b82f6, #0ea5e9)',
      card: 'linear-gradient(135deg, #1e40af, #3b82f6)',
      summary: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
      stat: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      overview: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    },
    animation: {
      transition: 'all 0.3s ease-out',
      bounce: false,
    },
  },
  matcha: {
    name: 'matcha',
    displayName: '抹茶绿',
    colors: {
      primary: '#65a30d',
      primaryLight: '#84cc16',
      secondary: '#0891b2',
      secondaryLight: '#c4b5fd',
      accent: '#0d9488',
      accentLight: '#14b8a6',
      warning: '#facc15',
      bgColor: '#f7fee7',
      cardBg: '#ffffff',
      textPrimary: '#1f2937',
      textSecondary: '#6b7280',
      borderColor: '#d9f99d',
      success: '#22c55e',
      danger: '#ef4444',
      shadow: '0 2px 12px rgba(101, 163, 13, 0.1)',
      messageBar: '#f0fdf4',
    },
    gradient: {
      header: 'linear-gradient(135deg, #65a30d, #84cc16)',
      card: 'linear-gradient(135deg, #a78bfa, #c4b5fd)',
      summary: 'linear-gradient(135deg, #65a30d, #84cc16)',
      stat: 'linear-gradient(135deg, #a78bfa, #c4b5fd)',
      overview: 'linear-gradient(135deg, #a78bfa, #c4b5fd)',
    },
    animation: {
      transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      bounce: false,
    },
  },
  sakura: {
    name: 'sakura',
    displayName: '少女粉',
    colors: {
      primary: '#ec4899',
      primaryLight: '#f472b6',
      secondary: '#f97316',
      secondaryLight: '#fb923c',
      accent: '#f43f5e',
      accentLight: '#fb7185',
      warning: '#fcd34d',
      bgColor: '#fdf2f8',
      cardBg: '#ffffff',
      textPrimary: '#831843',
      textSecondary: '#9ca3af',
      borderColor: '#fbcfe8',
      success: '#c4b5fd',
      danger: '#e11d48',
      shadow: '0 2px 12px rgba(236, 72, 153, 0.12)',
      messageBar: '#fdf2f8',
    },
    gradient: {
      header: 'linear-gradient(135deg, #ec4899, #f472b6)',
      card: 'linear-gradient(135deg, #db2777, #ec4899)',
      summary: 'linear-gradient(135deg, #ec4899, #f472b6)',
      stat: 'linear-gradient(135deg, #f97316, #fb923c)',
      overview: 'linear-gradient(135deg, #db2777, #ec4899)',
    },
    animation: {
      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      bounce: true,
    },
  },
  midnight: {
    name: 'midnight',
    displayName: '午夜蓝',
    colors: {
      primary: '#6366f1',
      primaryLight: '#818cf8',
      secondary: '#c4b5fd',
      secondaryLight: '#ddd6fe',
      accent: '#a855f7',
      accentLight: '#c084fc',
      warning: '#fbbf24',
      bgColor: '#0f172a',
      cardBg: '#1e293b',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      borderColor: '#334155',
      success: '#a78bfa',
      danger: '#f87171',
      shadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      messageBar: '#1e1b4b',
    },
    gradient: {
      header: 'linear-gradient(135deg, #1e293b, #0f172a)',
      card: 'linear-gradient(135deg, #334155, #475569)',
      summary: 'linear-gradient(135deg, #6366f1, #818cf8)',
      stat: 'linear-gradient(135deg, #c4b5fd, #ddd6fe)',
      overview: 'linear-gradient(135deg, #4338ca, #6366f1)',
    },
    animation: {
      transition: 'all 0.3s ease-out',
      bounce: false,
    },
  },
};
