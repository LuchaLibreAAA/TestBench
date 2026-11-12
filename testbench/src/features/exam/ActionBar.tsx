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
}) => {
  return (
    <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-t border-slate-200/80 dark:border-slate-800 shadow-lg safe-bottom">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
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
            <span className="hidden sm:inline">Mark for Review & Next</span>
            <span className="sm:hidden">Review</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClear}
            className="text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
            icon={<RotateCcw className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Clear Response</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        </div>

        {/* Right Actions: Previous, Save & Next, and Submit (on desktop) */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onPrev}
            disabled={isFirstQuestion}
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Previous</span>
          </Button>

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

          {/* Submit button on wider screens */}
          <Button
            type="button"
            variant="success"
            size="md"
            onClick={onSubmit}
            className="hidden lg:inline-flex"
            icon={<Send className="w-4 h-4" />}
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
};

