'use client';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex gap-2 w-fit h-fit rounded-full bg-muted transition-colors p-2 cursor-pointer"
      aria-label="Toggle Theme"
    >
      <Sun className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
      <Moon className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
      <div
        className={`absolute left-1.25 top-1.25 w-5.5 h-5.5 rounded-full bg-foreground shadow-sm transition-transform duration-300 ease-in-out flex items-center justify-center ${isDark ? 'translate-x-6' : 'translate-x-0'
          }`}
      />
    </button>
  );
}
