import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAttempts } from '@/data/repositories/attempts';
import { getAllPapers } from '@/data/repositories/papers';
import type { Attempt, Paper } from '@/core/schema';
import type { ScoreResult } from '@/core/marking';
import { Button } from '@/components/Button';
import {
  ArrowLeft,
  TrendingUp,
  Award,
  CheckCircle2,
  Calendar,
  Layers,
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
    <div className="min-h-screen bg-[#f4f6f9] pb-16 select-none">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-gray-900">Performance Analytics</h1>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">Loading performance data...</div>
        ) : attempts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-[#1f5fa6] rounded-xl flex items-center justify-center mx-auto">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-gray-900">No test attempts yet</h2>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
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
              <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-2xs text-center space-y-1">
                <Award className="w-5 h-5 text-blue-600 mx-auto" />
                <div className="text-2xl font-black text-gray-900">{stats.totalAttempts}</div>
                <div className="text-xs text-gray-500 font-medium">Tests Taken</div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-2xs text-center space-y-1">
                <Percent className="w-5 h-5 text-indigo-600 mx-auto" />
                <div className="text-2xl font-black text-gray-900">{stats.overallPercentage}%</div>
                <div className="text-xs text-gray-500 font-medium">Average Score</div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-2xs text-center space-y-1">
                <TrendingUp className="w-5 h-5 text-emerald-600 mx-auto" />
                <div className="text-2xl font-black text-gray-900">{stats.averageAccuracy}%</div>
                <div className="text-xs text-gray-500 font-medium">Avg Accuracy</div>
              </div>
            </div>

            {/* Topic Mastery (Weakest First) */}
            {stats.topicBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Topic Mastery</h2>
                  <p className="text-xs text-gray-500">Sorted with weakest areas at top</p>
                </div>

                <div className="space-y-3">
                  {stats.topicBreakdown.map((t) => (
                    <div key={t.topic} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-800">{t.topic}</span>
                        <span className="font-bold text-gray-700">{t.accuracy}% ({t.total} Qs)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
            <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-3">
              <h2 className="text-base font-bold text-gray-900">Past Tests</h2>
              <div className="divide-y divide-gray-100">
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
                      className="py-3 flex items-center justify-between hover:bg-gray-50 rounded-lg px-2 transition-colors cursor-pointer"
                    >
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-gray-900">
                          {paper?.title ?? 'Test Attempt'}
                        </h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {dateStr}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-[#1f5fa6]">
                          {res?.totalObtained ?? 0} / {res?.totalMax ?? 0}
                        </div>
                        <span className="text-[11px] text-gray-500 font-medium">
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
