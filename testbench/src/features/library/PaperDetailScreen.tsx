import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPaper } from '@/data/repositories/papers';
import { getAttemptsByPaper } from '@/data/repositories/attempts';
import type { Paper, Attempt } from '@/core/schema';
import { Button } from '@/components/Button';
import { resolveText } from '@/core/utils/localized-text';
import {
  ChevronLeft,
  Clock,
  HelpCircle,
  Play,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const PaperDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const stored = await getPaper(id);
        if (stored) {
          setPaper(stored.data);
          const atts = await getAttemptsByPaper(id);
          setAttempts(atts);
        }
      } catch (err) {
        console.error('Failed to load paper details:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading paper details...</p>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <p className="text-base font-bold text-gray-800">Paper not found</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Library
        </Button>
      </div>
    );
  }

  const totalQuestions = paper.sections.reduce(
    (acc, sec) => acc + sec.questions.length,
    0
  );

  const handleStart = () => {
    // Generate fresh attempt ID
    const newAttemptId = 'att-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    navigate(`/exam/${newAttemptId}/instructions`, { state: { paperId: paper.id } });
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-gray-900 truncate">
            {paper.title}
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1f5fa6] border border-blue-100">
              {paper.exam}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
              {paper.navigation === 'free' ? 'Free Navigation' : 'Sectional Lock'}
            </span>
          </div>

          <h2 className="text-2xl font-black text-gray-900">{paper.title}</h2>

          {paper.description && (
            <p className="text-sm text-gray-600 leading-relaxed">{paper.description}</p>
          )}

          {/* Key Stats Bar */}
          <div className="grid grid-cols-3 gap-3 py-3 border-y border-gray-100">
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 text-center">
              <Clock className="w-4 h-4 text-gray-500 mb-1" />
              <span className="text-base font-bold text-gray-900">{paper.durationMin ?? 180} min</span>
              <span className="text-[11px] text-gray-500 font-medium">Duration</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 text-center">
              <HelpCircle className="w-4 h-4 text-gray-500 mb-1" />
              <span className="text-base font-bold text-gray-900">{totalQuestions}</span>
              <span className="text-[11px] text-gray-500 font-medium">Questions</span>
            </div>

            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50 text-center">
              <Layers className="w-4 h-4 text-gray-500 mb-1" />
              <span className="text-base font-bold text-gray-900">{paper.sections.length}</span>
              <span className="text-[11px] text-gray-500 font-medium">Sections</span>
            </div>
          </div>

          {/* Start CTA */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={handleStart}
              icon={<Play className="w-5 h-5 fill-current" />}
              className="w-full bg-[#1f5fa6] hover:bg-[#184d87] text-base font-bold"
            >
              Start Mock Test
            </Button>
          </div>
        </div>

        {/* Sections Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-gray-900">Sections & Marking</h3>

          <div className="space-y-3">
            {paper.sections.map((sec, idx) => {
              const name = resolveText(sec.name, 'en');
              return (
                <div
                  key={sec.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-gray-50/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-gray-800">{name}</h4>
                    </div>
                    <p className="text-xs text-gray-500">
                      {sec.questions.length} questions
                      {sec.attemptLimit && ` (Attempt any ${sec.attemptLimit})`}
                      {sec.timeLimitMin && ` • ${sec.timeLimitMin} min limit`}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block text-xs font-bold text-[#2e9e5b] bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                      +{sec.marking.correct} / {sec.marking.wrong}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Past Attempts */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Attempt History</h3>
            <span className="text-xs font-semibold text-gray-500">
              {attempts.length} attempts
            </span>
          </div>

          {attempts.length === 0 ? (
            <p className="text-xs text-gray-500 py-3">You haven't attempted this paper yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {attempts.map((att) => {
                const res = att.result as any;
                const dateStr = new Date(att.startedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={att.id}
                    onClick={() => {
                      if (att.status === 'submitted' || att.status === 'autoSubmitted') {
                        navigate(`/result/${att.id}`);
                      } else {
                        navigate(`/exam/${att.id}`);
                      }
                    }}
                    className="py-3.5 flex items-center justify-between hover:bg-gray-50 rounded-lg px-2 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">
                          {att.status === 'inProgress' ? (
                            <span className="text-blue-600">In Progress</span>
                          ) : (
                            <span>Score: {res?.totalObtained ?? 0} / {res?.totalMax ?? 0}</span>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {dateStr}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <span>View</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
