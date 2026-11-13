import React from 'react';
import { Button } from '@/components/Button';
import { Bookmark, RotateCcw, ChevronLeft, ChevronRight, Send } from 'lucide-react';

export interface ActionBarProps {
  onSaveNext: () => void;
  onMarkNext: () => void;
  onClear: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onSaveNext,
  onMarkNext,
  onClear,
  onPrev,
  onSubmit,
  isFirstQuestion,
  isLastQuestion,
}) => {
  return (
    <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t border-slate-200/80 dark:border-slate-800 shadow-lg safe-bottom">
      {/* Mobile Dedicated Layout (< sm) */}
      <div className="sm:hidden px-2.5 py-2 space-y-2">
        {/* Top Utility Row: Clear, Review, and Submit */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onClear}
            className="h-9 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-slate-100/80 dark:bg-slate-800/80 active:scale-95 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={onMarkNext}
            className="h-9 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-purple-200 dark:border-purple-800/80 text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Review</span>
          </button>

          <button
            type="button"
            onClick={onSubmit}
            className="h-9 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-[#2e9e5b] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 active:scale-95 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit</span>
          </button>
        </div>

        {/* Bottom Navigation Row: Previous & Save Next */}
        <div className="grid grid-cols-5 gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onPrev}
            disabled={isFirstQuestion}
            icon={<ChevronLeft className="w-4 h-4" />}
            className="col-span-2 h-11 text-xs font-semibold justify-center"
          >
            Previous
          </Button>

          {isLastQuestion ? (
            <Button
              type="button"
              variant="success"
              size="md"
              onClick={onSubmit}
              icon={<Send className="w-4 h-4" />}
              className="col-span-3 h-11 text-xs font-bold justify-center"
            >
              Submit Test
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onSaveNext}
              className="col-span-3 h-11 text-xs font-bold justify-center"
            >
              <span>Save & Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Tablet & Desktop Layout (>= sm) */}
      <div className="hidden sm:flex max-w-7xl mx-auto px-4 py-2.5 items-center justify-between gap-2">
        {/* Left Actions: Mark for Review & Clear */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onMarkNext}
            className="border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-950/70 hover:text-purple-800 dark:hover:text-purple-200"
            icon={<Bookmark className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
          >
            <span>Mark for Review & Next</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClear}
            className="text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
            icon={<RotateCcw className="w-4 h-4" />}
          >
            <span>Clear Response</span>
          </Button>
        </div>

        {/* Right Actions: Previous, Save & Next, and Submit */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onPrev}
            disabled={isFirstQuestion}
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            <span>Previous</span>
          </Button>

          {isLastQuestion ? (
            <Button
              type="button"
              variant="success"
              size="md"
              onClick={onSubmit}
              className="font-semibold"
              icon={<Send className="w-4 h-4" />}
            >
              <span>Submit Test</span>
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onSaveNext}
                className="font-semibold"
              >
                <span>Save & Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>

              <Button
                type="button"
                variant="success"
                size="md"
                onClick={onSubmit}
                className="font-semibold"
                icon={<Send className="w-4 h-4" />}
              >
                Submit
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

