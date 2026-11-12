import { create } from 'zustand';
import { getSetting, setSetting } from '@/data/repositories/settings';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'testbench-theme';

function applyThemeToDom(theme: ThemeMode) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors in restricted environments
  }
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Fallback to light
  }
  return 'light';
}

const initialTheme = getInitialTheme();
applyThemeToDom(initialTheme);

interface ThemeStore {
  theme: ThemeMode;
  initialized: boolean;
  initTheme: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  initialized: false,

  initTheme: async () => {
    if (get().initialized) return;
    try {
      const stored = await getSetting<ThemeMode>('theme', initialTheme);
      applyThemeToDom(stored);
      set({ theme: stored, initialized: true });
    } catch {
      set({ initialized: true });
    }
  },

  setTheme: async (theme: ThemeMode) => {
    applyThemeToDom(theme);
    set({ theme });
    try {
      await setSetting('theme', theme);
    } catch {
      // IndexedDB fallback safe
    }
  },

  toggleTheme: async () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    await get().setTheme(next);
  },
}));
