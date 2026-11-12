import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttempt } from '@/data/repositories/attempts';
import { getPaper, savePaper } from '@/data/repositories/papers';
import type { Attempt, Paper, Section, Question } from '@/core/schema';
import { scorePaper, type ScoreResult } from '@/core/marking';
import { Button } from '@/components/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { resolveText } from '@/core/utils/localized-text';
import {
  Award,
  CheckCircle,
  XCircle,
  RotateCcw,
  Home,
  TrendingUp,
  Percent,
  BookOpen,
  Zap,
  BarChart2,
} from 'lucide-react';

export const ResultScreen: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!attemptId) return;
      try {
        const att = await getAttempt(attemptId);
        if (att) {
          setAttempt(att);
          const p = await getPaper(att.paperId);
          if (p) setPaper(p.data);
        }
      } catch (err) {
        console.error('Failed to load result:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [attemptId]);

  const result = useMemo<ScoreResult>(() => {
    if (attempt && paper) {
      return scorePaper(paper, attempt.responses);
    }
    return (attempt?.result as ScoreResult) ?? {
      totalObtained: 0,
      totalMax: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalPartial: 0,
      totalSkipped: 0,
      totalQuestions: 0,
      sectionScores: [],
      topicScores: [],
      questionResults: [],
    };
  }, [attempt, paper]);

  const percentage = result.totalMax > 0
    ? Math.max(0, Math.round((result.totalObtained / result.totalMax) * 100))
    : 0;

  const attemptedCount = result.totalCorrect + result.totalWrong + result.totalPartial;
  const accuracy = attemptedCount > 0
    ? Math.round((result.totalCorrect / attemptedCount) * 100)
    : 0;

  // Rule-based insights
  const insights = useMemo(() => {
    if (!attempt || !paper) return null;

    let negativeLoss = 0;
    let fastWrongCount = 0;

    result.questionResults?.forEach((qr) => {
      const resp = attempt.responses[qr.qid];
      if (qr.outcome === 'wrong' && qr.marks < 0) {
        negativeLoss += Math.abs(qr.marks);
      }
      if (qr.outcome === 'wrong' && resp && resp.timeSpentMs < 10000) {
        fastWrongCount++;
      }
    });

    const weakTopics = result.topicScores?.filter(
      (ts) => ts.total >= 2 && ts.correct / ts.total < 0.5
    ) ?? [];

    return {
      negativeLoss,
      fastWrongCount,
      weakTopics,
    };
  }, [attempt, paper, result]);

  if (loading || !attempt || !paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Calculating results...</p>
      </div>
    );
  }

  // Handler to generate a derived paper with wrong & skipped questions only
  const handleRetryWrongAndSkipped = async () => {
    const wrongOrSkippedQids = new Set(
      result.questionResults
        ?.filter((qr) => qr.outcome === 'wrong' || qr.outcome === 'skipped' || qr.outcome === 'partial')
        .map((qr) => qr.qid) ?? []
    );

    if (wrongOrSkippedQids.size === 0) {
      alert('You answered all questions correctly! Perfect score!');
      return;
    }

    // Build derived sections containing only wrong/skipped questions
    const derivedSections: Section[] = [];
    for (const sec of paper.sections) {
      const matchingQuestions = (sec.questions as Question[]).filter((q) =>
        wrongOrSkippedQids.has(q.id)
      );

      if (matchingQuestions.length > 0) {
        derivedSections.push({
          ...sec,
          questions: matchingQuestions,
          attemptLimit: undefined, // Remove attempt limit for practice
        });
      }
    }

    const retryPaperId = `${paper.id}-retry-${Date.now().toString(36)}`;
    const derivedPaper: Paper = {
      ...paper,
      id: retryPaperId,
      title: `${paper.title} (Retry Wrong & Skipped)`,
      sections: derivedSections,
      durationMin: result.totalQuestions > 0
        ? Math.max(10, Math.round((wrongOrSkippedQids.size / result.totalQuestions) * (paper.durationMin ?? 180)))
        : 10,
    };

    await savePaper(derivedPaper);

    const newAttemptId = 'att-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    navigate(`/exam/${newAttemptId}/instructions?paperId=${encodeURIComponent(retryPaperId)}`, {
      state: { paperId: retryPaperId },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 select-none transition-colors">
      {/* Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Award className="w-5 h-5 text-[#1a56db] dark:text-blue-400 shrink-0" />
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">Scorecard: {paper.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/analytics')}
              icon={<BarChart2 className="w-4 h-4" />}
            >
              <span className="hidden sm:inline">Analytics</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              icon={<Home className="w-4 h-4" />}
            >
              <span className="hidden sm:inline">Home</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Hero Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#1a56db] via-indigo-500 to-[#2e9e5b]" />

          <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800 mb-3">
            Exam Completed
          </span>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {result.totalObtained}{' '}
            <span className="text-lg sm:text-xl font-normal text-slate-400 dark:text-slate-500">
              / {result.totalMax}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Total Marks Obtained</p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl">
              <Percent className="w-4 h-4 text-[#1a56db] dark:text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{percentage}%</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Percentage</div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{accuracy}%</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Accuracy</div>
            </div>

            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/70 p-3 rounded-2xl">
              <CheckCircle className="w-4 h-4 text-[#2e9e5b] dark:text-emerald-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-[#2e9e5b] dark:text-emerald-400">{result.totalCorrect}</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Correct</div>
            </div>

            <div className="bg-red-50/70 dark:bg-red-950/40 border border-red-100 dark:border-red-800/70 p-3 rounded-2xl">
              <XCircle className="w-4 h-4 text-[#e5533d] dark:text-red-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-[#e5533d] dark:text-red-400">{result.totalWrong}</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Incorrect</div>
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(`/review/${attempt.id}`)}
            icon={<BookOpen className="w-5 h-5" />}
            className="font-bold"
          >
            Review Solutions
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleRetryWrongAndSkipped}
            icon={<RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-950 font-bold"
          >
            Retry Wrong & Skipped ({result.totalWrong + result.totalSkipped})
          </Button>
        </div>

        {/* Rule-Based Insights Card */}
        {insights && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> Exam Insights & Diagnostics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 rounded-xl space-y-1">
                <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Negative Marking Loss</span>
                <div className="text-xl font-bold text-red-700 dark:text-red-300">-{insights.negativeLoss} marks</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Marks lost from incorrect answers</p>
              </div>

              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl space-y-1">
                <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Rushed Guesses</span>
                <div className="text-xl font-bold text-amber-800 dark:text-amber-300">{insights.fastWrongCount} questions</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Answered in &lt;10s and incorrect</p>
              </div>

              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 rounded-xl space-y-1">
                <span className="text-xs text-[#1a56db] dark:text-blue-400 font-semibold">Weak Topics</span>
                <div className="text-sm sm:text-base font-bold text-[#1a56db] dark:text-blue-300 space-y-0.5">
                  {insights.weakTopics.length > 0
                    ? insights.weakTopics.slice(0, 3).map((t) => (
                        <div key={t.topic} className="truncate">
                          {t.topic} ({Math.round((t.correct / t.total) * 100)}%)
                        </div>
                      ))
                    : <div>None</div>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Focus your revision here</p>
              </div>
            </div>
          </div>
        )}

        {/* Section Breakdown Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Section-wise Performance</h3>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">Section</th>
                  <th className="py-3 px-2 text-center text-[#2e9e5b] dark:text-emerald-400">Correct</th>
                  <th className="py-3 px-2 text-center text-[#e5533d] dark:text-red-400">Wrong</th>
                  <th className="py-3 px-2 text-center text-slate-500 dark:text-slate-400">Skipped</th>
                  <th className="py-3 px-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {result.sectionScores.map((sec) => {
                  const name = resolveText(sec.sectionName, 'en');
                  return (
                    <tr key={sec.sectionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3.5 font-medium text-slate-800 dark:text-slate-200">{name}</td>
                      <td className="py-3 px-2 text-center font-semibold text-[#2e9e5b] dark:text-emerald-400">
                        {sec.correct}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-[#e5533d] dark:text-red-400">
                        {sec.wrong}
                      </td>
                      <td className="py-3 px-2 text-center text-slate-500 dark:text-slate-400">{sec.skipped}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {sec.obtained} / {sec.max}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate(`/paper/${paper.id}`)}
            icon={<RotateCcw className="w-4 h-4" />}
            className="flex-1"
          >
            Retake Full Test
          </Button>

          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate('/')}
            icon={<Home className="w-4 h-4" />}
            className="flex-1"
          >
            Back to Library
          </Button>
        </div>
      </main>
    </div>
  );
};
