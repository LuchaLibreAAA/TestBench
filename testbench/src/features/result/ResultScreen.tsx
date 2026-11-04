import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAttempt } from '@/data/repositories/attempts';
import { getPaper } from '@/data/repositories/papers';
import type { Attempt, Paper } from '@/core/schema';
import type { ScoreResult } from '@/core/marking';
import { Button } from '@/components/Button';
import { resolveText } from '@/core/utils/localized-text';
import {
  Award,
  CheckCircle,
  XCircle,
  RotateCcw,
  Home,
  TrendingUp,
  Percent,
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

  if (loading || !attempt || !paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Calculating results...</p>
      </div>
    );
  }

  const result = (attempt.result as ScoreResult) ?? {
    totalObtained: 0,
    totalMax: 0,
    totalCorrect: 0,
    totalWrong: 0,
    totalPartial: 0,
    totalSkipped: 0,
    totalQuestions: 0,
    sectionScores: [],
    topicScores: [],
  };

  const percentage = result.totalMax > 0
    ? Math.max(0, Math.round((result.totalObtained / result.totalMax) * 100))
    : 0;

  const attemptedCount = result.totalCorrect + result.totalWrong + result.totalPartial;
  const accuracy = attemptedCount > 0
    ? Math.round((result.totalCorrect / attemptedCount) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#1f5fa6]" />
            <h1 className="text-base font-bold text-gray-900">Scorecard: {paper.title}</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} icon={<Home className="w-4 h-4" />}>
            Home
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Hero Card */}
        <div className="bg-white rounded-3xl border border-gray-200/90 p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-[#2e9e5b]" />

          <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 text-[#1f5fa6] mb-3">
            Exam Completed
          </span>

          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            {result.totalObtained}{' '}
            <span className="text-lg sm:text-xl font-normal text-gray-400">
              / {result.totalMax}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Total Marks Obtained</p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100">
            <div className="bg-gray-50 p-3 rounded-2xl">
              <Percent className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-gray-900">{percentage}%</div>
              <div className="text-[11px] text-gray-500 font-medium">Percentage</div>
            </div>

            <div className="bg-gray-50 p-3 rounded-2xl">
              <TrendingUp className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-gray-900">{accuracy}%</div>
              <div className="text-[11px] text-gray-500 font-medium">Accuracy</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-2xl">
              <CheckCircle className="w-4 h-4 text-[#2e9e5b] mx-auto mb-1" />
              <div className="text-lg font-bold text-[#2e9e5b]">{result.totalCorrect}</div>
              <div className="text-[11px] text-gray-600 font-medium">Correct</div>
            </div>

            <div className="bg-red-50/60 border border-red-100 p-3 rounded-2xl">
              <XCircle className="w-4 h-4 text-[#e5533d] mx-auto mb-1" />
              <div className="text-lg font-bold text-[#e5533d]">{result.totalWrong}</div>
              <div className="text-[11px] text-gray-600 font-medium">Incorrect</div>
            </div>
          </div>
        </div>

        {/* Section Breakdown Card */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-gray-900">Section-wise Performance</h3>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <tr>
                  <th className="py-3 px-3.5">Section</th>
                  <th className="py-3 px-2 text-center text-[#2e9e5b]">Correct</th>
                  <th className="py-3 px-2 text-center text-[#e5533d]">Wrong</th>
                  <th className="py-3 px-2 text-center text-gray-500">Skipped</th>
                  <th className="py-3 px-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.sectionScores.map((sec) => {
                  const name = resolveText(sec.sectionName, 'en');
                  return (
                    <tr key={sec.sectionId} className="hover:bg-gray-50/50">
                      <td className="py-3 px-3.5 font-medium text-gray-800">{name}</td>
                      <td className="py-3 px-2 text-center font-semibold text-[#2e9e5b]">
                        {sec.correct}
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-[#e5533d]">
                        {sec.wrong}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-500">{sec.skipped}</td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900">
                        {sec.obtained} / {sec.max}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate(`/paper/${paper.id}`)}
            icon={<RotateCcw className="w-4 h-4" />}
            className="flex-1"
          >
            Retake Test
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('/')}
            icon={<Home className="w-4 h-4" />}
            className="flex-1 bg-[#1f5fa6] hover:bg-[#184d87]"
          >
            Back to Library
          </Button>
        </div>
      </main>
    </div>
  );
};
