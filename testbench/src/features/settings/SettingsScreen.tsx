import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { db } from '@/data/db';
import {
  ChevronLeft,
  Sun,
  Type,
  Calculator,
  HardDrive,
  Trash2,
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showKeypad, setShowKeypad] = useState(true);
  const [storageEstimate, setStorageEstimate] = useState<string>('Calculating...');

  useEffect(() => {
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

  const handleClearAllData = async () => {
    if (confirm('Are you sure you want to delete ALL papers, attempts, and assets? This cannot be undone.')) {
      await db.delete();
      await db.open();
      alert('All local data cleared.');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-gray-900">Settings</h1>
        </div>
      </header>

      {/* Main Settings List */}
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Appearance Group */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Display & Appearance
          </h2>

          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" /> Theme
              </span>
              <p className="text-xs text-gray-500">Color scheme for the application</p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  theme === 'light' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  theme === 'dark' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-t border-gray-100 pt-3">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Type className="w-4 h-4 text-blue-500" /> Text Size
              </span>
              <p className="text-xs text-gray-500">Question body font size</p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              {(['small', 'medium', 'large'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setTextSize(sz)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    textSize === sz ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input & Keypad Group */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Exam Controls
          </h2>

          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-500" /> Virtual Keypad
              </span>
              <p className="text-xs text-gray-500">Show on-screen numeric keypad for numerical questions</p>
            </div>
            <input
              type="checkbox"
              checked={showKeypad}
              onChange={(e) => setShowKeypad(e.target.checked)}
              className="w-5 h-5 accent-[#1f5fa6] rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Storage & Data */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Storage & Local Data
          </h2>

          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-500" /> IndexedDB Usage
              </span>
              <p className="text-xs text-gray-500">Data stored offline on your device</p>
            </div>
            <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
              {storageEstimate}
            </span>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <Button
              variant="outline"
              size="md"
              onClick={handleClearAllData}
              icon={<Trash2 className="w-4 h-4 text-red-600" />}
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              Clear All Data & Reset App
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
