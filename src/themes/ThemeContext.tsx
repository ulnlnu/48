import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ThemeName, ThemeConfig } from './themeConfig';
import { themes } from './themeConfig';

interface ThemeContextType {
  theme: ThemeConfig;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
  availableThemes: { name: ThemeName; displayName: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 生成 CSS 变量字符串
function generateCSSVariables(theme: ThemeConfig): string {
  const { colors, gradient, animation } = theme;
  return `
    :root {
      /* 主题颜色变量 */
      --primary-color: ${colors.primary};
      --primary-light: ${colors.primaryLight};
      --secondary-color: ${colors.secondary};
      --secondary-light: ${colors.secondaryLight};
      --accent-color: ${colors.accent};
      --accent-light: ${colors.accentLight};
      --warning-color: ${colors.warning};
      --bg-color: ${colors.bgColor};
      --card-bg: ${colors.cardBg};
      --text-primary: ${colors.textPrimary};
      --text-secondary: ${colors.textSecondary};
      --border-color: ${colors.borderColor};
      --success-color: ${colors.success};
      --danger-color: ${colors.danger};
      --shadow: ${colors.shadow};
      --message-bar: ${colors.messageBar};

      /* 渐变变量 */
      --gradient-header: ${gradient.header};
      --gradient-card: ${gradient.card};
      --gradient-summary: ${gradient.summary};
      --gradient-stat: ${gradient.stat};
      --gradient-overview: ${gradient.overview};

      /* 动画变量 */
      --transition: ${animation.transition};
    }

    /* 深色模式覆盖 - 使用主题定义的深色变量 */
    [data-theme="midnight"] body,
    body[data-theme="midnight"] {
      background: ${colors.bgColor};
      color: ${colors.textPrimary};
    }
  `;
}

// 将 CSS 变量应用到文档
function applyTheme(theme: ThemeConfig) {
  const cssVariables = generateCSSVariables(theme);
  let styleElement = document.getElementById('theme-variables');

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'theme-variables';
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = cssVariables;
  document.documentElement.setAttribute('data-theme', theme.name);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    // 尝试从 localStorage 读取保存的主题
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pocket48_theme');
      if (saved && saved in themes) {
        return saved as ThemeName;
      }
      // 检查系统深色模式
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'midnight';
      }
    }
    return 'aurora';
  });

  const theme = themes[themeName];

  // 应用主题
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('pocket48_theme', themeName);
  }, [theme, themeName]);

  const setTheme = useCallback((name: ThemeName) => {
    if (themes[name]) {
      setThemeName(name);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const themeKeys = Object.keys(themes) as ThemeName[];
    const currentIndex = themeKeys.indexOf(themeName);
    const nextIndex = (currentIndex + 1) % themeKeys.length;
    setThemeName(themeKeys[nextIndex]);
  }, [themeName]);

  const availableThemes = Object.entries(themes).map(([name, config]) => ({
    name: name as ThemeName,
    displayName: config.displayName,
  }));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeName,
        setTheme,
        toggleTheme,
        availableThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
