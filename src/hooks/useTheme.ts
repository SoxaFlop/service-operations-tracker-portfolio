import { useLayoutEffect, useState } from 'react';

export type AppTheme = 'pastel' | 'modern' | 'dark';

const isAppTheme = (value: string | null): value is AppTheme =>
  value === 'pastel' || value === 'modern' || value === 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => {
    const savedTheme = localStorage.getItem('app-theme');
    return isAppTheme(savedTheme) ? savedTheme : 'pastel';
  });

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('modern', theme === 'modern');
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
