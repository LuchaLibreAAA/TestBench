import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttempt } from '@/data/repositories/attempts';
import { getPaper } from '@/data/repositories/papers';
import type { Attempt, Paper, Question, Section, Response } from '@/core/schema';
import type { ScoreResult, QuestionResult } from '@/core/marking';
import { Button } from '@/components/Button';
import { RichText } from '@/components/RichText';
import { Img } from '@/components/Img';
import { ThemeToggle } from '@/components/ThemeToggle';
import { resolveText } from '@/core/utils/localized-text';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  ArrowLeft,
  BookOpen,
} from 'lucide-react';

export const ReviewScreen: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [activeQid, setActiveQid] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');
  const [loading, setLoading] = useState(true);

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

  const scoreResult = attempt?.result as ScoreResult | undefined;

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

  // Keep activeQid valid when filter changes
  useEffect(() => {
    if (filteredQuestions.length > 0) {
      const exists = filteredQuestions.some((item) => item.question.id === activeQid);
      if (!exists) {
        setActiveQid(filteredQuestions[0].question.id);
      }
    }
  }, [filteredQuestions, activeQid]);

  if (loading || !attempt || !paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading solution review...</p>
      </div>
    );
  }

  const currentItem = allQuestions.find((item) => item.question.id === activeQid) ?? allQuestions[0];
  const currentQ = currentItem?.question;
  const currentSec = currentItem?.section;
  const currentRes = attempt.responses[activeQid] as Response | undefined;
  const currentOutcome = resultMap.get(activeQid)?.outcome ?? 'skipped';
  const currentMarks = resultMap.get(activeQid)?.marks ?? 0;

  const currentIndexInFiltered = filteredQuestions.findIndex((item) => item.question.id === activeQid);
  const hasPrev = currentIndexInFiltered > 0;
  const hasNext = currentIndexInFiltered < filteredQuestions.length - 1;

  const timeSpentSec = Math.round((currentRes?.timeSpentMs ?? 0) / 1000);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 flex flex-col select-none transition-colors">
      {/* Top Navbar */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 safe-top">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/result/${attempt.id}`)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Back to result"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                Solutions: {paper.title}
              </h1>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Score: {scoreResult?.totalObtained ?? 0} / {scoreResult?.totalMax ?? 0}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/result/${attempt.id}`)}
            >
              Done
            </Button>
          </div>
        </div>
      </header>

      {/* Filter Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-4 sm:p-6 space-y-5">
              {/* Outcome Banner */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Question {currentItem.index + 1}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    • {resolveText(currentSec.name, 'en')}
                  </span>
                  {currentQ.topic && (
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                      {currentQ.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" /> {timeSpentSec}s
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                      currentOutcome === 'correct'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#2e9e5b] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/70'
                        : currentOutcome === 'wrong'
                        ? 'bg-red-50 dark:bg-red-950/60 text-[#e5533d] dark:text-red-400 border border-red-200 dark:border-red-800/70'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {currentOutcome === 'correct' && <CheckCircle className="w-3.5 h-3.5" />}
                    {currentOutcome === 'wrong' && <XCircle className="w-3.5 h-3.5" />}
                    <span>{currentMarks > 0 ? `+${currentMarks}` : currentMarks} Marks</span>
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg text-slate-900 dark:text-slate-100 font-normal leading-relaxed">
                <RichText content={currentQ.text} language="en" />
                {currentQ.images && currentQ.images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {currentQ.images.map((img) => (
                      <Img key={img} paperId={paper.id} src={img} />
                    ))}
                  </div>
                )}
              </div>

              {/* Options Review for Single / Multi */}
              {'options' in currentQ && Array.isArray(currentQ.options) && (
                <div className="space-y-3 pt-2">
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
                        className={`w-full p-3.5 sm:p-4 rounded-xl border-2 flex items-start justify-between gap-3 ${borderClass}`}
                      >
                        <div className="flex items-start gap-3">
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

                          <div className="text-sm sm:text-base text-slate-900 dark:text-slate-100 pt-0.5">
                            {opt.text && <RichText content={opt.text} language="en" />}
                            {opt.image && <Img paperId={paper.id} src={opt.image} />}
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
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
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Numerical Question Review */}
              {currentQ.type === 'numerical' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Your Typed Answer:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-base">
                      {currentRes?.answer !== null && currentRes?.answer !== undefined
                        ? String(currentRes.answer)
                        : '(Skipped)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Correct Answer:</span>
                    <span className="font-mono font-bold text-[#2e9e5b] dark:text-emerald-400 text-base">
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
                <div className="mt-4 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/70 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#1a56db] dark:text-blue-400 uppercase tracking-wider">
                    <BookOpen className="w-4 h-4" />
                    <span>Explanation & Solution</span>
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed pt-1">
                    <RichText content={currentQ.explanation} language="en" />
                    {currentQ.explanationImages && currentQ.explanationImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentQ.explanationImages.map((img) => (
                          <Img key={img} paperId={paper.id} src={img} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Prev / Next Nav Bar */}
          <div className="flex items-center justify-between pt-2">
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
            >
              Previous
            </Button>

            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {currentIndexInFiltered + 1} of {filteredQuestions.length}
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
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right Column: Palette Overview */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-4 sticky top-28 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Questions</h3>

            <div className="grid grid-cols-5 gap-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {allQuestions.map((item) => {
                const outcome = resultMap.get(item.question.id)?.outcome ?? 'skipped';
                const isActive = item.question.id === activeQid;

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
                    onClick={() => setActiveQid(item.question.id)}
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
        </div>
      </div>
    </div>
  );
};
