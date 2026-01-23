import { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import type { ThemeName } from './themeConfig';
import './ThemeSwitcher.css';

interface ThemeSwitcherProps {
  position?: 'header' | 'floating';
}

const themeIcons: Record<ThemeName, string> = {
  coral: '🔥',
  aurora: '✨',
  star: '🌟',
  matcha: '🍃',
  sakura: '🌸',
  midnight: '🌙',
};

export function ThemeSwitcher({ position = 'header' }: ThemeSwitcherProps) {
  const { themeName, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTheme = availableThemes.find(t => t.name === themeName);

  return (
    <div
      className={`theme-switcher theme-switcher--${position}`}
      ref={dropdownRef}
    >
      <button
        className="theme-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="切换主题"
        title={`当前主题: ${currentTheme?.displayName}`}
      >
        <span className="theme-icon">{themeIcons[themeName]}</span>
        <span className="theme-name">{currentTheme?.displayName}</span>
        <svg
          className={`chevron ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {isOpen && (
        <div className="theme-dropdown">
          <div className="theme-dropdown-header">选择主题</div>
          <div className="theme-options">
            {availableThemes.map((t) => (
              <button
                key={t.name}
                className={`theme-option ${t.name === themeName ? 'active' : ''}`}
                onClick={() => {
                  setTheme(t.name);
                  setIsOpen(false);
                }}
              >
                <span className="option-icon">{themeIcons[t.name]}</span>
                <span className="option-name">{t.displayName}</span>
                {t.name === themeName && (
                  <svg
                    className="check-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
