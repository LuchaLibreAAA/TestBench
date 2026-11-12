import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAttempts } from '@/data/repositories/attempts';
import { getAllPapers } from '@/data/repositories/papers';
import type { Attempt, Paper } from '@/core/schema';
import type { ScoreResult } from '@/core/marking';
import { Button } from '@/components/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  TrendingUp,
  Award,
  Calendar,
  Percent,
} from 'lucide-react';

export const AnalyticsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [papersMap, setPapersMap] = useState<Map<string, Paper>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const atts = await getAllAttempts();
        const papers = await getAllPapers();
        const pMap = new Map<string, Paper>();
        papers.forEach((p) => pMap.set(p.id, p.data));

        setAttempts(atts.filter((a) => a.status === 'submitted' || a.status === 'autoSubmitted'));
        setPapersMap(pMap);
      } catch (err) {
        console.error('Failed loading analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute aggregate stats across all completed attempts
  const stats = React.useMemo(() => {
    let totalScore = 0;
    let totalMaxScore = 0;
    let totalCorrect = 0;
    let totalQuestions = 0;

    const topicStats = new Map<string, { correct: number; total: number }>();

    attempts.forEach((att) => {
      const res = att.result as ScoreResult | undefined;
      if (!res) return;

      totalScore += res.totalObtained;
      totalMaxScore += res.totalMax;
      totalCorrect += res.totalCorrect;
      totalQuestions += res.totalQuestions;

      res.topicScores?.forEach((ts) => {
        const current = topicStats.get(ts.topic) ?? { correct: 0, total: 0 };
        topicStats.set(ts.topic, {
          correct: current.correct + ts.correct,
          total: current.total + ts.total,
        });
      });
    });

    const averageAccuracy =
      totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const overallPercentage =
      totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

    const topicBreakdown = Array.from(topicStats.entries())
      .map(([topic, data]) => ({
        topic,
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        total: data.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy); // Weakest first

    return {
      totalAttempts: attempts.length,
      averageAccuracy,
      overallPercentage,
      topicBreakdown,
    };
  }, [attempts]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 select-none transition-colors">
      {/* Top Navbar */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">Performance Analytics</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">Loading performance data...</div>
        ) : attempts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 rounded-xl flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">No test attempts yet</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Complete at least one mock test to see your score trends and topic mastery.
            </p>
            <Button variant="primary" size="sm" onClick={() => navigate('/')}>
              Browse Papers
            </Button>
          </div>
        ) : (
          <>
            {/* Aggregate Overview Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs text-center space-y-1">
                <Award className="w-5 h-5 text-[#1a56db] dark:text-blue-400 mx-auto" />
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.totalAttempts}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tests Taken</div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs text-center space-y-1">
                <Percent className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mx-auto" />
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.overallPercentage}%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Average Score</div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs text-center space-y-1">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.averageAccuracy}%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Avg Accuracy</div>
              </div>
            </div>

            {/* Topic Mastery (Weakest First) */}
            {stats.topicBreakdown.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Topic Mastery</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sorted with weakest areas at top</p>
                </div>

                <div className="space-y-3">
                  {stats.topicBreakdown.map((t) => (
                    <div key={t.topic} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{t.topic}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{t.accuracy}% ({t.total} Qs)</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            t.accuracy >= 70
                              ? 'bg-[#2e9e5b]'
                              : t.accuracy >= 40
                              ? 'bg-amber-500'
                              : 'bg-[#e5533d]'
                          }`}
                          style={{ width: `${t.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Past Tests</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {attempts.map((att) => {
                  const paper = papersMap.get(att.paperId);
                  const res = att.result as ScoreResult | undefined;
                  const dateStr = new Date(att.startedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={att.id}
                      onClick={() => navigate(`/result/${att.id}`)}
                      className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-2 transition-colors cursor-pointer"
                    >
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {paper?.title ?? 'Test Attempt'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {dateStr}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-[#1a56db] dark:text-blue-400">
                          {res?.totalObtained ?? 0} / {res?.totalMax ?? 0}
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {res?.totalCorrect ?? 0} correct
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
