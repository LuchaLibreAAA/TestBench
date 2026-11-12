import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPaper } from '@/data/repositories/papers';
import { getAttemptsByPaper } from '@/data/repositories/attempts';
import type { Paper, Attempt } from '@/core/schema';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { resolveText } from '@/core/utils/localized-text';
import {
  ChevronLeft,
  Clock,
  HelpCircle,
  Play,
  Calendar,
  Layers,
  ArrowRight,
  MonitorCheck,
} from 'lucide-react';

function deriveSessionBadge(paper: Paper): string {
  const titleLower = paper.title.toLowerCase();
  if (titleLower.includes('april')) return 'April Session';
  if (titleLower.includes('january') || titleLower.includes('jan ')) return 'January Session';
  const tags = paper.meta?.tags ?? [];
  const yearTag = tags.find((t) => /^\d{4}$/.test(t));
  return yearTag ? `${yearTag} Official` : 'Standard Pattern';
}

function deriveShortId(paper: Paper): string {
  const tags = paper.meta?.tags ?? [];
  const yearTag = tags.find((t) => /^\d{4}$/.test(t));
  const yy = yearTag ? yearTag.slice(-2) : '26';
  let hash = 0;
  for (let i = 0; i < paper.id.length; i++) {
    hash = (hash * 31 + paper.id.charCodeAt(i)) % 10000;
  }
  const code = String(Math.abs(hash)).padStart(4, '0');
  const prefix = paper.exam === 'wbtet' ? 'WBTET' : 'NTA';
  return `${prefix}-${yy}-${code}X`;
}

function deriveSectionInitials(paper: Paper): string {
  if (paper.exam === 'wbtet') return 'TET';
  const names = paper.sections.map((s) => resolveText(s.name, 'en').toLowerCase());
  const initials: string[] = [];
  if (names.some((n) => n.includes('phys'))) initials.push('P');
  if (names.some((n) => n.includes('chem'))) initials.push('C');
  if (names.some((n) => n.includes('math'))) initials.push('M');
  if (names.some((n) => n.includes('botany') || n.includes('bio'))) initials.push('B');
  if (names.some((n) => n.includes('zoology'))) initials.push('Z');
  if (initials.length === 0) return 'ALL';
  return initials.join('');
}

function describeSectionQuestionTypes(sec: Paper['sections'][number]): string {
  const types = new Set(sec.questions.map((q) => q.type));
  if (types.size === 1) {
    const only = Array.from(types)[0];
    if (only === 'single') return 'Single Correct Option';
    if (only === 'multi') return 'Multiple Correct Options';
    if (only === 'numerical') return 'Numerical Value Answer';
    if (only === 'tf') return 'True / False';
  }
  return 'Mixed Question Types';
}

export const PaperDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState<'instructions' | 'compatibility' | null>(null);

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

  const stats = useMemo(() => {
    if (!paper) return null;
    const totalQuestions = paper.sections.reduce((acc, sec) => acc + sec.questions.length, 0);
    const totalMarks = paper.sections.reduce((acc, sec) => {
      const countable = sec.attemptLimit ? Math.min(sec.attemptLimit, sec.questions.length) : sec.questions.length;
      return acc + countable * sec.marking.correct;
    }, 0);
    const durationMin = paper.durationMin ?? 180;
    const hoursStr = Number.isInteger(durationMin / 60)
      ? `${durationMin / 60} HOUR${durationMin / 60 === 1 ? '' : 'S'}`
      : `${(durationMin / 60).toFixed(1)} HRS`;

    const primaryMarking = paper.sections[0]?.marking ?? { correct: 4, wrong: -1, unattempted: 0 };

    return {
      totalQuestions,
      totalMarks,
      durationMin,
      hoursStr,
      primaryMarking,
      sessionBadge: deriveSessionBadge(paper),
      shortId: deriveShortId(paper),
      subjectInitials: deriveSectionInitials(paper),
    };
  }, [paper]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#1a56db] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading paper details...</p>
        </div>
      </div>
    );
  }

  if (!paper || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-3 px-4">
        <p className="text-base font-bold text-slate-800 dark:text-slate-100">Paper not found</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Library
        </Button>
      </div>
    );
  }

  const hasActiveSession = attempts.some((a) => a.status === 'inProgress');

  const handleStart = () => {
    const newAttemptId = 'att-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    navigate(`/exam/${newAttemptId}/instructions?paperId=${encodeURIComponent(paper.id)}`, {
      state: { paperId: paper.id },
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex flex-col transition-colors">
      {/* Top Navbar */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 -ml-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              aria-label="Back to library"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {paper.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasActiveSession && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Session Active
              </span>
            )}
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              ID: {stats.shortId}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 pt-6 sm:pt-8 pb-10 space-y-6">
        {/* Hero Overview Card */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-6">
          <div className="space-y-3">
            {/* Pill Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/50">
                {paper.exam.toUpperCase()}
              </span>
              {paper.exam === 'wbtet' && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/50">
                  English & Bengali
                </span>
              )}
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50">
                {paper.navigation === 'free' ? 'Free Navigation' : 'Sectional Lock'}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50">
                {stats.sessionBadge}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              {paper.title}
            </h2>

            {/* Description */}
            {paper.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
                {paper.description}
              </p>
            )}
          </div>

          {/* 3-Column Metric Stat Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-xl py-4 px-3 flex flex-col items-center justify-center text-center">
              <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white leading-none">
                {stats.durationMin} min
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase mt-1.5">
                DURATION ({stats.hoursStr})
              </span>
            </div>

            <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-xl py-4 px-3 flex flex-col items-center justify-center text-center">
              <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <HelpCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white leading-none">
                {stats.totalQuestions}
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase mt-1.5">
                QUESTIONS • {stats.totalMarks} MARKS
              </span>
            </div>

            <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-xl py-4 px-3 flex flex-col items-center justify-center text-center">
              <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white leading-none">
                {paper.sections.length}
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase mt-1.5">
                SECTIONS ({stats.subjectInitials})
              </span>
            </div>
          </div>

          {/* Primary Launch Button + Recommended Notice */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleStart}
              className="w-full h-12 rounded-xl bg-[#1a56db] hover:bg-[#1e40af] dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Mock Test</span>
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <Clock className="w-3 h-3" />
              <span>Full-screen mode recommended • Timer initiates immediately upon launch</span>
            </p>
          </div>
        </section>

        {/* Sections & Marking Scheme Card */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Sections &amp; Marking Scheme
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Computer-Based Test (CBT) question distribution pattern
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60">
                +{stats.primaryMarking.correct} Correct
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60">
                {stats.primaryMarking.wrong} Incorrect
              </span>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                {stats.primaryMarking.unattempted} Blank
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {paper.sections.map((sec, idx) => {
              const name = resolveText(sec.name, 'en');
              const typeDesc = describeSectionQuestionTypes(sec);

              return (
                <div
                  key={sec.id}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-7 h-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {sec.questions.length} questions • {typeDesc}
                        {sec.attemptLimit ? ` • Attempt any ${sec.attemptLimit}` : ''}
                        {sec.timeLimitMin ? ` • ${sec.timeLimitMin} min` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span className="inline-block text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-200/70 dark:border-emerald-800/60">
                      +{sec.marking.correct} / {sec.marking.wrong}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Attempt History (shown when attempts exist, compact otherwise) */}
        {attempts.length > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Attempt History
              </h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {attempts.map((att) => {
                const res = att.result as { totalObtained?: number; totalMax?: number } | undefined;
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
                    className="py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl px-3 -mx-3 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                        {att.status === 'inProgress' ? (
                          <span className="text-blue-600 dark:text-blue-400">In Progress</span>
                        ) : (
                          <span>Score: {res?.totalObtained ?? 0} / {res?.totalMax ?? 0}</span>
                        )}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {dateStr}
                      </p>
                    </div>

                    <Button variant="ghost" size="sm">
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Subtle Page Footer */}
      <footer className="w-full max-w-4xl mx-auto px-4 pb-8 pt-2">
        <div className="border-t border-slate-200/80 dark:border-slate-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span>National Testing Agency CBT Simulation Engine • Standard 2026 Test Norms</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setInfoModal('instructions')}
              className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              General Instructions
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setInfoModal('compatibility')}
              className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              System Compatibility
            </button>
          </div>
        </div>
      </footer>

      {/* Footer Info Modals */}
      <Dialog
        open={infoModal !== null}
        onClose={() => setInfoModal(null)}
        title={infoModal === 'instructions' ? 'General Instructions' : 'System Compatibility'}
        footer={
          <Button variant="primary" size="sm" onClick={() => setInfoModal(null)}>
            Close
          </Button>
        }
      >
        {infoModal === 'instructions' ? (
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              {paper.instructions?.en ??
                'Each question carries positive marks for correct responses and negative marking where specified per section.'}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <li>The countdown timer runs continuously once you start the test.</li>
              <li>Responses and Marked-for-Review states are autosaved locally on every interaction.</li>
              <li>You can switch between sections freely unless sectional locking is active.</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <MonitorCheck className="w-5 h-5" />
              <span>Your browser is ready for CBT Simulation</span>
            </div>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>• Local Storage &amp; IndexedDB persistence: Available</li>
              <li>• Offline asset &amp; image rendering: Verified</li>
              <li>• Keyboard &amp; Touch numeric input: Supported</li>
            </ul>
          </div>
        )}
      </Dialog>
    </div>
  );
};
