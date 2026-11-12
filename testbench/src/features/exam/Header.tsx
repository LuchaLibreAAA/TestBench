import React from 'react';
import { useTimer } from '@/hooks/useTimer';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getWbtetLanguageLabel } from '@/core/utils/localized-text';
import { Clock, LayoutGrid, Globe } from 'lucide-react';

export interface HeaderProps {
  paperTitle: string;
  exam?: string;
  endsAt: number;
  languages: string[];
  activeLanguage: string;
  onLanguageChange: (lang: string) => void;
  onTogglePalette: () => void;
  onExpire: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  paperTitle,
  exam,
  endsAt,
  languages,
  activeLanguage,
  onLanguageChange,
  onTogglePalette,
  onExpire,
}) => {
  const { formatted, severity } = useTimer(endsAt, onExpire);

  const timerColorClass = {
    normal: 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    warning: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 animate-pulse',
    danger: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 animate-pulse font-bold',
  }[severity];

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 safe-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
        {/* Title */}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {paperTitle}
          </h1>
        </div>

        {/* Right tools: Language Toggle, Theme, Timer, Palette Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language Selector (if > 1 language) */}
          {languages.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <select
                value={activeLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                {languages.map((l) => (
                  <option key={l} value={l} className="dark:bg-slate-900">
                    {getWbtetLanguageLabel(l, exam)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <ThemeToggle />

          {/* Timer Display */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-sm sm:text-base transition-colors ${timerColorClass}`}
            aria-live="polite"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="font-semibold tracking-wider">{formatted}</span>
          </div>

          {/* Palette button (mobile trigger) */}
          <button
            type="button"
            onClick={onTogglePalette}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            aria-label="Open Question Palette"
          >
            <LayoutGrid className="w-5 h-5 text-[#1a56db] dark:text-blue-400" />
          </button>
        </div>
      </div>
    </header>
  );
};

