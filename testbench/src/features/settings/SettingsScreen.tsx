import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { db } from '@/data/db';
import { getSetting, setSetting } from '@/data/repositories/settings';
import { useThemeStore } from '@/stores/themeStore';
import {
  ChevronLeft,
  Sun,
  Moon,
  Type,
  Calculator,
  HardDrive,
  Trash2,
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showKeypad, setShowKeypad] = useState(true);
  const [storageEstimate, setStorageEstimate] = useState<string>('Calculating...');

  useEffect(() => {
    async function loadSettings() {
      const storedSize = await getSetting<'small' | 'medium' | 'large'>('textSize', 'medium');
      const storedKeypad = await getSetting<boolean>('showKeypad', true);
      setTextSize(storedSize);
      setShowKeypad(storedKeypad);
    }
    loadSettings();

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((estimate) => {
        if (estimate.usage !== undefined) {
          const kb = (estimate.usage / 1024).toFixed(1);
          setStorageEstimate(`${kb} KB used`);
        }
      });
    } else {
      setStorageEstimate('Unavailable in this browser');
    }
  }, []);

  const handleThemeChange = async (t: 'light' | 'dark') => {
    await setTheme(t);
  };

  const handleTextSizeChange = async (sz: 'small' | 'medium' | 'large') => {
    setTextSize(sz);
    await setSetting('textSize', sz);
  };

  const handleKeypadToggle = async (val: boolean) => {
    setShowKeypad(val);
    await setSetting('showKeypad', val);
  };

  const handleClearAllData = async () => {
    if (confirm('Are you sure you want to delete ALL papers, attempts, and assets? This cannot be undone.')) {
      await db.delete();
      await db.open();
      alert('All local data cleared.');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 transition-colors">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Settings</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Settings List */}
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Appearance Group */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Display & Appearance
          </h2>

          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
                Theme
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Color scheme for the application</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => void handleThemeChange('light')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => void handleThemeChange('dark')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Type className="w-4 h-4 text-blue-500" /> Text Size
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Question body font size</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['small', 'medium', 'large'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleTextSizeChange(sz)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                    textSize === sz
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input & Keypad Group */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Exam Controls
          </h2>

          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Virtual Keypad
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Show on-screen numeric keypad for numerical questions</p>
            </div>
            <input
              type="checkbox"
              checked={showKeypad}
              onChange={(e) => handleKeypadToggle(e.target.checked)}
              className="w-5 h-5 accent-[#1a56db] rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Storage & Data */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Storage & Local Data
          </h2>

          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-500" /> IndexedDB Usage
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">Data stored offline on your device</p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              {storageEstimate}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="md"
              onClick={handleClearAllData}
              icon={<Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />}
              className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300"
            >
              Clear All Data & Reset App
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
