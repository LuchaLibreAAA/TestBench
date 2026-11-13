import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttempt } from '@/data/repositories/attempts';
import { getPaper } from '@/data/repositories/papers';
import type { Attempt, Paper, Question, Section, Response } from '@/core/schema';
import { scorePaper, type ScoreResult, type QuestionResult } from '@/core/marking';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { RichText } from '@/components/RichText';
import { Img } from '@/components/Img';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  resolveText,
  getWbtetLanguageLabel,
  getWbtetQuestionLanguageBadge,
} from '@/core/utils/localized-text';
import { useTextSizeSetting, getTextSizeClass } from '@/hooks/useTextSizeSetting';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  ArrowLeft,
  BookOpen,
  LayoutGrid,
} from 'lucide-react';

export const ReviewScreen: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const textSize = useTextSizeSetting();
  const textSizeClass = getTextSizeClass(textSize);

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [activeQid, setActiveQid] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');
  const [language, setLanguage] = useState<string>('en');
  const [loading, setLoading] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    async function load() {
      if (!attemptId) return;
      try {
        const att = await getAttempt(attemptId);
        if (att) {
          setAttempt(att);
          const p = await getPaper(att.paperId);
          if (p) {
            setPaper(p.data);
            setLanguage(p.data.languages[0] ?? 'en');
            const firstQid = p.data.sections[0]?.questions[0]?.id ?? '';
            setActiveQid(firstQid);
          }
        }
      } catch (err) {
        console.error('Failed to load review:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [attemptId]);

  const scoreResult = useMemo<ScoreResult | undefined>(() => {
    if (attempt && paper) {
      return scorePaper(paper, attempt.responses);
    }
    return attempt?.result as ScoreResult | undefined;
  }, [attempt, paper]);

  // Map of qid -> QuestionResult
  const resultMap = useMemo(() => {
    const map = new Map<string, QuestionResult>();
    scoreResult?.questionResults.forEach((qr) => map.set(qr.qid, qr));
    return map;
  }, [scoreResult]);

  // Flattened list of all questions with section info
  const allQuestions = useMemo(() => {
    if (!paper) return [];
    const list: Array<{ question: Question; section: Section; index: number }> = [];
    let idx = 0;
    for (const sec of paper.sections) {
      for (const q of sec.questions as Question[]) {
        list.push({ question: q, section: sec, index: idx++ });
      }
    }
    return list;
  }, [paper]);

  // Filtered list of questions
  const filteredQuestions = useMemo(() => {
    if (filter === 'all') return allQuestions;
    return allQuestions.filter((item) => {
      const qr = resultMap.get(item.question.id);
      const outcome = qr?.outcome ?? 'skipped';
      if (filter === 'correct') return outcome === 'correct';
      if (filter === 'wrong') return outcome === 'wrong' || outcome === 'partial';
      if (filter === 'skipped') return outcome === 'skipped';
      return true;
    });
  }, [allQuestions, filter, resultMap]);

  // Derive valid activeQid for the current filter without triggering synchronous effect renders
  const resolvedActiveQid = useMemo(() => {
    if (filteredQuestions.length === 0) return activeQid;
    const exists = filteredQuestions.some((item) => item.question.id === activeQid);
    return exists ? activeQid : filteredQuestions[0].question.id;
  }, [filteredQuestions, activeQid]);

  if (loading || !attempt || !paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading solution review...</p>
      </div>
    );
  }

  const currentItem = allQuestions.find((item) => item.question.id === resolvedActiveQid) ?? allQuestions[0];
  const currentQ = currentItem?.question;
  const currentSec = currentItem?.section;
  const currentRes = attempt.responses[resolvedActiveQid] as Response | undefined;
  const currentOutcome = resultMap.get(resolvedActiveQid)?.outcome ?? 'skipped';
  const currentMarks = resultMap.get(resolvedActiveQid)?.marks ?? 0;

  const currentIndexInFiltered = filteredQuestions.findIndex((item) => item.question.id === resolvedActiveQid);
  const hasPrev = currentIndexInFiltered > 0;
  const hasNext = currentIndexInFiltered >= 0 && currentIndexInFiltered < filteredQuestions.length - 1;

  const timeSpentSec = Math.round((currentRes?.timeSpentMs ?? 0) / 1000);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 flex flex-col select-none transition-colors">
      {/* Top Navbar */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 safe-top">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-13 sm:h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate(`/result/${attempt.id}`)}
              className="p-1 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Back to result"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                Solutions: {paper.title}
              </h1>
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Score: {scoreResult?.totalObtained ?? 0} / {scoreResult?.totalMax ?? 0}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Palette Trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="lg:hidden flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer shrink-0"
              aria-label="View Questions Palette"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#1a56db] dark:text-blue-400" />
              <span>Palette</span>
            </button>

            {paper.exam === 'wbtet' && paper.languages.length > 1 && (
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Question language"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[75px] sm:max-w-none truncate"
              >
                {paper.languages.map((l) => (
                  <option key={l} value={l} className="dark:bg-slate-900">
                    {getWbtetLanguageLabel(l, paper.exam)}
                  </option>
                ))}
              </select>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/result/${attempt.id}`)}
              className="px-2 sm:px-3 text-xs"
            >
              Done
            </Button>
          </div>
        </div>
      </header>

      {/* Filter Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar touch-scroll">
          {(['all', 'correct', 'wrong', 'skipped'] as const).map((f) => {
            const count = allQuestions.filter((item) => {
              if (f === 'all') return true;
              const outcome = resultMap.get(item.question.id)?.outcome;
              if (f === 'correct') return outcome === 'correct';
              if (f === 'wrong') return outcome === 'wrong' || outcome === 'partial';
              if (f === 'skipped') return outcome === 'skipped';
              return true;
            }).length;

            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-[#1a56db] text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Review Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 flex flex-col lg:flex-row gap-4">
        {/* Left Column: Question Details & Solution */}
        <div className="flex-1 space-y-4 min-w-0">
          {currentQ && currentSec && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-3.5 sm:p-6 space-y-4 sm:space-y-5">
              {/* Outcome Banner */}
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 shrink-0">
                      Q{currentItem.index + 1}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                      {resolveText(currentSec.name, language)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {timeSpentSec}s
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-bold ${
                        currentOutcome === 'correct'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#2e9e5b] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70'
                          : currentOutcome === 'wrong'
                          ? 'bg-red-50 dark:bg-red-950/60 text-[#e5533d] dark:text-red-400 border border-red-200 dark:border-red-800/70'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {currentOutcome === 'correct' && <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      {currentOutcome === 'wrong' && <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      <span>{currentMarks > 0 ? `+${currentMarks}` : currentMarks} M</span>
                    </span>
                  </div>
                </div>

                {(currentQ.topic || paper.exam === 'wbtet') && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {currentQ.topic && (
                      <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                        {currentQ.topic}
                      </span>
                    )}
                    {paper.exam === 'wbtet' && (
                      <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/70 px-2 py-0.5 rounded-md font-semibold">
                        {getWbtetQuestionLanguageBadge(
                          currentSec.id,
                          language,
                          Boolean(currentQ.localizedImages?.en?.length && currentQ.localizedImages?.bn?.length),
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Question Text */}
              <div className={`${textSizeClass} text-slate-900 dark:text-slate-100 font-normal leading-relaxed overflow-hidden`}>
                <RichText content={currentQ.text} language={language} />
                {(() => {
                  const displayImages =
                    (currentQ.localizedImages?.[language] && currentQ.localizedImages[language].length > 0
                      ? currentQ.localizedImages[language]
                      : currentQ.images) ?? [];
                  return displayImages.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5 sm:gap-3 mt-3 overflow-x-auto no-scrollbar">
                      {displayImages.map((img) => (
                        <Img key={img} paperId={paper.id} src={img} className="max-w-full h-auto" />
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Options Review for Single / Multi */}
              {'options' in currentQ && Array.isArray(currentQ.options) && (
                <div className="space-y-2.5 sm:space-y-3 pt-2">
                  {currentQ.options.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isStudentAnswer =
                      Array.isArray(currentRes?.answer) &&
                      currentRes.answer.includes(opt.id);
                    const isCorrectAnswer =
                      Array.isArray(currentQ.answer) &&
                      currentQ.answer.includes(opt.id);

                    let borderClass = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';
                    if (isCorrectAnswer) {
                      borderClass = 'border-emerald-500 dark:border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40';
                    } else if (isStudentAnswer && !isCorrectAnswer) {
                      borderClass = 'border-red-400 dark:border-red-600 bg-red-50/70 dark:bg-red-950/40';
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`w-full p-3 sm:p-4 rounded-xl border-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-3 ${borderClass}`}
                      >
                        <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                          <div
                            className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs mt-0.5 ${
                              isCorrectAnswer
                                ? 'bg-[#2e9e5b] text-white'
                                : isStudentAnswer
                                ? 'bg-[#e5533d] text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {letter}
                          </div>

                          <div className="flex-1 min-w-0 text-sm sm:text-base text-slate-900 dark:text-slate-100 pt-0.5">
                            {opt.text && <RichText content={opt.text} language={language} />}
                            {opt.image && <Img paperId={paper.id} src={opt.image} />}
                          </div>
                        </div>

                        {/* Status Badges */}
                        {(isCorrectAnswer || isStudentAnswer) && (
                          <div className="flex flex-row sm:flex-col items-start sm:items-end gap-1.5 shrink-0 pl-9.5 sm:pl-0 pt-0.5">
                            {isCorrectAnswer && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2e9e5b] dark:text-emerald-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                                <Check className="w-3 h-3 stroke-[3]" /> Correct
                              </span>
                            )}
                            {isStudentAnswer && (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border shadow-2xs ${
                                  isCorrectAnswer
                                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700'
                                    : 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/60 border-red-300 dark:border-red-700'
                                }`}
                              >
                                Your Choice
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Numerical Question Review */}
              {currentQ.type === 'numerical' && (
                <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Your Typed Answer:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                      {currentRes?.answer !== null && currentRes?.answer !== undefined
                        ? String(currentRes.answer)
                        : '(Skipped)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Correct Answer:</span>
                    <span className="font-mono font-bold text-[#2e9e5b] dark:text-emerald-400 text-sm sm:text-base">
                      {currentQ.answer !== undefined
                        ? currentQ.answer
                        : `${currentQ.answerRange?.[0]} to ${currentQ.answerRange?.[1]}`}
                      {currentQ.unit && ` ${currentQ.unit}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Solution / Explanation Box */}
              {currentQ.explanation && (
                <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#1a56db] dark:text-blue-400 uppercase tracking-wider">
                    <BookOpen className="w-4 h-4" />
                    <span>Explanation & Solution</span>
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed pt-1 overflow-hidden">
                    <RichText content={currentQ.explanation} language={language} />
                    {currentQ.explanationImages && currentQ.explanationImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentQ.explanationImages.map((img) => (
                          <Img key={img} paperId={paper.id} src={img} className="max-w-full h-auto" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Prev / Next Nav Bar */}
          <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200/80 dark:border-slate-800 p-2.5 sm:p-3 rounded-2xl shadow-sm flex items-center justify-between safe-bottom">
            <Button
              variant="outline"
              size="md"
              disabled={!hasPrev}
              onClick={() => {
                if (hasPrev) {
                  setActiveQid(filteredQuestions[currentIndexInFiltered - 1].question.id);
                }
              }}
              icon={<ChevronLeft className="w-4 h-4" />}
              className="px-3 sm:px-4 text-xs font-semibold"
            >
              Previous
            </Button>

            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
              {filteredQuestions.length > 0 ? currentIndexInFiltered + 1 : 0} / {filteredQuestions.length}
            </span>

            <Button
              variant="primary"
              size="md"
              disabled={!hasNext}
              onClick={() => {
                if (hasNext) {
                  setActiveQid(filteredQuestions[currentIndexInFiltered + 1].question.id);
                }
              }}
              className="px-3 sm:px-4 text-xs font-bold"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Desktop Sidebar: Palette Overview (>= lg) */}
        <aside className="hidden lg:block lg:w-80 shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-4 sticky top-28 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Questions</h3>

            <div className="grid grid-cols-5 gap-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {allQuestions.map((item) => {
                const outcome = resultMap.get(item.question.id)?.outcome ?? 'skipped';
                const isActive = item.question.id === resolvedActiveQid;

                let colorStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
                if (outcome === 'correct') {
                  colorStyle = 'bg-[#2e9e5b] text-white border-transparent';
                } else if (outcome === 'wrong' || outcome === 'partial') {
                  colorStyle = 'bg-[#e5533d] text-white border-transparent';
                }

                return (
                  <button
                    key={item.question.id}
                    type="button"
                    onClick={() => {
                      if (
                        filter !== 'all' &&
                        !filteredQuestions.some((fq) => fq.question.id === item.question.id)
                      ) {
                        setFilter('all');
                      }
                      setActiveQid(item.question.id);
                    }}
                    className={`h-9 rounded-lg font-bold text-xs flex items-center justify-center border transition-all cursor-pointer ${colorStyle} ${
                      isActive ? 'ring-3 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900 scale-105' : ''
                    }`}
                  >
                    {item.index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Mobile / Tablet Questions Palette Sheet */}
        <Sheet
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          title="Questions Palette"
        >
          <div className="py-2 space-y-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pb-2 border-b border-slate-100 dark:border-slate-800">
              Tap any question number to view its explanation and response:
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {allQuestions.map((item) => {
                const outcome = resultMap.get(item.question.id)?.outcome ?? 'skipped';
                const isActive = item.question.id === resolvedActiveQid;

                let colorStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
                if (outcome === 'correct') {
                  colorStyle = 'bg-[#2e9e5b] text-white border-transparent';
                } else if (outcome === 'wrong' || outcome === 'partial') {
                  colorStyle = 'bg-[#e5533d] text-white border-transparent';
                }

                return (
                  <button
                    key={item.question.id}
                    type="button"
                    onClick={() => {
                      if (
                        filter !== 'all' &&
                        !filteredQuestions.some((fq) => fq.question.id === item.question.id)
                      ) {
                        setFilter('all');
                      }
                      setActiveQid(item.question.id);
                      setPaletteOpen(false);
                    }}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center border transition-all cursor-pointer active:scale-95 ${colorStyle} ${
                      isActive ? 'ring-3 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-105' : ''
                    }`}
                  >
                    {item.index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </Sheet>
      </div>
    </div>
  );
};
