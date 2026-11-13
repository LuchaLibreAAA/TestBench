import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaperStore } from '@/stores/paperStore';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatTime } from '@/core/exam/timer';
import { CATALOG_PAPERS, loadCatalogPaper, seedAllCatalogPapers } from '@/data/catalog';
import * as apiClient from '@/data/apiClient';
import { APP_VERSION } from '@/core/version';
import {
  FileText,
  Play,
  Trash2,
  Settings,
  Clock,
  Layers,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  Compass,
  Stethoscope,
  Search,
  DownloadCloud,
  Database,
  GraduationCap,
} from 'lucide-react';

export const LibraryScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    papers,
    loading,
    inProgressAttempt,
    inProgressPaper,
    loadPapers,
    removePaper,
  } = usePaperStore();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [exams, setExams] = useState<apiClient.ExamSummary[]>([]);
  const [remotePapers, setRemotePapers] = useState<apiClient.PaperSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    success: boolean;
    message: string;
  }>({ open: false, success: false, message: '' });

  useEffect(() => {
    loadPapers();
    apiClient.getExams().then((res) => {
      if (res && res.length > 0) setExams(res);
    }).catch(() => {});
    apiClient.getCatalog().then((res) => {
      if (res && res.length > 0) setRemotePapers(res);
    }).catch(() => {});
  }, [loadPapers]);

  const handleSeedAll = async () => {
    setSeeding(true);
    try {
      const count = await seedAllCatalogPapers();
      await loadPapers();
      setStatusDialog({
        open: true,
        success: true,
        message: count > 0
          ? `Successfully loaded ${count} official JEE & NEET papers into your local library!`
          : 'All official JEE & NEET papers are already loaded in your library.',
      });
    } catch (err) {
      setStatusDialog({
        open: true,
        success: false,
        message: `Failed to load catalog papers: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleSelectPaper = async (paperId: string) => {
    // If it's a catalog paper and not yet in Dexie, load it first
    const inStore = papers.some((p) => p.id === paperId);
    if (!inStore) {
      await loadCatalogPaper(paperId);
      await loadPapers();
    }
    navigate(`/paper/${paperId}`);
  };

  const dynamicTabs = useMemo(() => {
    if (exams.length > 0) {
      return exams.map((e) => ({ code: e.code, name: e.badge || e.name }));
    }
    return [
      { code: 'jee-main', name: 'JEE Main' },
      { code: 'neet', name: 'NEET UG' },
      { code: 'wbtet', name: 'WBTET' },
    ];
  }, [exams]);

  // Merge catalog items and stored papers without duplicates
  const allPaperItems = useMemo(() => {
    const map = new Map<string, {
      id: string;
      title: string;
      exam: string;
      description?: string;
      durationMin: number;
      questionsCount: number;
      sectionsCount: number;
      badge?: string;
      isCatalog: boolean;
      isStored: boolean;
    }>();

    // 1. Add all catalog items
    for (const c of CATALOG_PAPERS) {
      map.set(c.id, {
        id: c.id,
        title: c.title,
        exam: c.exam,
        description: c.description,
        durationMin: c.durationMin,
        questionsCount: c.questionsCount,
        sectionsCount: c.sectionsCount,
        badge: c.badge,
        isCatalog: true,
        isStored: false,
      });
    }

    // 1b. Overlay dynamic remote papers from API
    for (const r of remotePapers) {
      const existing = map.get(r.id);
      const normalizedExam =
        r.examCode === 'neet-ug' || r.examCode === 'neet' || r.exam?.toLowerCase().includes('neet')
          ? 'neet'
          : r.examCode || r.exam;
      const cleanTitle =
        r.title && !['B.Tech', 'UG', 'Paper I'].includes(r.title.trim())
          ? r.title
          : existing?.title || r.title;
      map.set(r.id, {
        id: r.id,
        title: cleanTitle,
        exam: normalizedExam,
        description: existing?.description,
        durationMin: r.durationMin,
        questionsCount: r.totalQuestions,
        sectionsCount: r.sectionsCount,
        badge:
          r.badge ||
          existing?.badge ||
          (normalizedExam === 'jee-main' ? 'JEE Main' : normalizedExam === 'neet' ? 'NEET UG' : 'WBTET'),
        isCatalog: true,
        isStored: existing ? existing.isStored : false,
      });
    }

    // 2. Overlay stored papers
    for (const s of papers) {
      const p = s.data;
      const totalQuestions = p.sections.reduce((sum, sec) => sum + sec.questions.length, 0);
      const existing = map.get(p.id);

      const cleanTitle =
        p.title && !['B.Tech', 'UG', 'Paper I'].includes(p.title.trim())
          ? p.title
          : existing?.title || p.title;
      const cleanDesc =
        p.description && !['B.Tech', 'UG', 'Paper I'].includes(p.description.trim())
          ? p.description
          : existing?.description || p.description;

      map.set(p.id, {
        id: p.id,
        title: cleanTitle,
        exam: p.exam === 'neet-ug' ? 'neet' : p.exam,
        description: cleanDesc,
        durationMin: p.durationMin ?? 180,
        questionsCount: totalQuestions,
        sectionsCount: p.sections.length,
        badge:
          existing?.badge ??
          (p.exam === 'jee-main'
            ? 'JEE Main'
            : p.exam === 'neet' || p.exam === 'neet-ug'
            ? 'NEET UG'
            : p.exam === 'wbtet'
            ? 'WBTET'
            : 'Custom'),
        isCatalog: existing?.isCatalog ?? false,
        isStored: true,
      });
    }

    return Array.from(map.values());
  }, [papers, remotePapers]);

  // Filtering by search query
  const filteredPapers = useMemo(() => {
    return allPaperItems.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.exam.toLowerCase().includes(q) ||
        item.badge?.toLowerCase().includes(q)
      );
    });
  }, [allPaperItems, searchQuery]);

  // Separate sections
  const jeePapers = useMemo(
    () => filteredPapers.filter((p) => p.exam === 'jee-main'),
    [filteredPapers]
  );

  const neetPapers = useMemo(
    () => filteredPapers.filter((p) => p.exam === 'neet'),
    [filteredPapers]
  );

  const wbtetPapers = useMemo(
    () => filteredPapers.filter((p) => p.exam === 'wbtet'),
    [filteredPapers]
  );

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!inProgressAttempt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inProgressAttempt]);

  const remainingMs = inProgressAttempt
    ? Math.max(0, inProgressAttempt.endsAt - now)
    : 0;

  const renderPaperCard = (item: typeof allPaperItems[0], accent: 'blue' | 'emerald' | 'indigo') => {
    const isJee = item.exam === 'jee-main';
    const accentClass = isJee
      ? 'border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/70'
      : accent === 'emerald'
      ? 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/70'
      : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/70';

    const badgeBg = isJee
      ? 'bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 border-blue-200/80 dark:border-blue-800'
      : accent === 'emerald'
      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800'
      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800';

    return (
      <div
        key={item.id}
        onClick={() => handleSelectPaper(item.id)}
        className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-2xs hover:shadow-md dark:hover:shadow-none transition-all cursor-pointer flex flex-col justify-between gap-4 group ${accentClass}`}
      >
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${badgeBg}`}>
              {item.badge ?? item.exam}
            </span>

            {item.isStored && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const msg = item.isCatalog
                    ? `Remove cached copy of "${item.title}"?`
                    : `Delete "${item.title}"?`;
                  if (confirm(msg)) {
                    removePaper(item.id);
                  }
                }}
                className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                title={item.isCatalog ? 'Remove local copy' : 'Delete paper'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#1a56db] dark:group-hover:text-blue-400 transition-colors leading-snug">
            {item.title}
          </h3>

          {item.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Metadata Chips */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {item.questionsCount} Qs
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <Layers className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {item.sectionsCount} Sec
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              {item.durationMin}m
            </span>
          </div>

          <span className="font-bold flex items-center gap-1 text-[#1a56db] dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
            Launch <Play className="w-3 h-3 fill-current" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-14 transition-colors">
      {/* Top Navbar */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 safe-top">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img src="/icon.png" alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shadow-xs shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">TestBench</h1>
                <span className="text-[10px] font-mono font-bold px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-[#1a56db] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shrink-0">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">NTA CBT Mock Test Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/qna')}
              icon={<Database className="w-4 h-4 text-[#1a56db] dark:text-blue-400" />}
              className="px-2 sm:px-3 text-xs"
              title="Universal Q&A Question Bank"
            >
              <span className="hidden sm:inline">Q&A Database</span>
              <span className="sm:hidden text-xs">Q&A</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/analytics')}
              icon={<BarChart2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
              className="p-2 sm:px-3 text-xs"
              title="Analytics"
            >
              <span className="hidden sm:inline">Analytics</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              icon={<Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
              className="p-2 sm:px-3 text-xs"
              title="Settings"
            >
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-7">
        {/* In-Progress Resume Card (if any) */}
        {inProgressAttempt && inProgressPaper && remainingMs > 0 && (
          <div className="bg-gradient-to-r from-[#1642a8] to-[#1a56db] dark:from-slate-900 dark:to-blue-950/90 dark:border dark:border-slate-800 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-blue-100">
                <Clock className="w-3.5 h-3.5" />
                In Progress
              </span>
              <h2 className="text-xl font-bold">{inProgressPaper.title}</h2>
              <p className="text-sm text-blue-100">
                Time remaining: <span className="font-mono font-bold">{formatTime(remainingMs)}</span>
              </p>
            </div>

            <Button
              variant="success"
              size="lg"
              onClick={() => navigate(`/exam/${inProgressAttempt.id}`)}
              icon={<Play className="w-5 h-5 fill-current" />}
              className="bg-emerald-500 hover:bg-emerald-600 font-bold"
            >
              Resume Test
            </Button>
          </div>
        )}

        {/* Action Header & Tools */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Question Papers</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Official JEE Main and NEET UG past year question papers</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSeedAll}
              disabled={seeding}
              icon={<DownloadCloud className="w-4 h-4" />}
            >
              {seeding ? 'Loading Papers...' : 'Load All Papers'}
            </Button>
          </div>
        </div>

        {/* Search & Tabs Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar touch-scroll pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Tests ({filteredPapers.length})
            </button>

            {dynamicTabs.map((tab) => {
              const count = allPaperItems.filter(
                (p) =>
                  p.exam === tab.code ||
                  (tab.code === 'neet' && p.exam === 'neet-ug') ||
                  (tab.code === 'neet-ug' && p.exam === 'neet'),
              ).length;
              const isSelected =
                activeTab === tab.code ||
                (tab.code === 'neet' && activeTab === 'neet-ug') ||
                (tab.code === 'neet-ug' && activeTab === 'neet');

              return (
                <button
                  key={tab.code}
                  onClick={() => setActiveTab(tab.code)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#1a56db] text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-[#1a56db] dark:hover:text-blue-400'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  {tab.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1a56db] dark:focus:border-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-sm">Loading test papers...</div>
        ) : filteredPapers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-10 text-center space-y-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No matching test papers</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              No tests match your current search query or filter. Try clearing the search or load the official papers.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
              <Button variant="primary" size="sm" onClick={handleSeedAll}>
                Load All Papers
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-9">
            {/* 1. JEE Main Section */}
            {(activeTab === 'all' || activeTab === 'jee-main') && jeePapers.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">JEE Main Question Papers</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        75–90 Questions (Physics, Chemistry, Mathematics) • 180 Minutes • NTA CBT Pattern
                      </p>
                    </div>
                  </div>
                  <div className="self-start sm:self-auto pl-10.5 sm:pl-0 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 border border-blue-200/70 dark:border-blue-800">
                      {jeePapers.length} Available
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jeePapers.map((item) => renderPaperCard(item, 'blue'))}
                </div>
              </section>
            )}

            {/* 2. NEET UG Section */}
            {(activeTab === 'all' || activeTab === 'neet' || activeTab === 'neet-ug') && neetPapers.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">NEET UG Question Papers</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        200 Questions (Physics, Chemistry, Botany, Zoology) • 200 Minutes • 720 Marks
                      </p>
                    </div>
                  </div>
                  <div className="self-start sm:self-auto pl-10.5 sm:pl-0 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800">
                      {neetPapers.length} Available
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {neetPapers.map((item) => renderPaperCard(item, 'emerald'))}
                </div>
              </section>
            )}

            {/* 3. WBTET Section */}
            {(activeTab === 'all' || activeTab === 'wbtet') && wbtetPapers.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">WB Primary TET Question Papers</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        150 Questions (CDP, Bengali, English, Math, EVS) • 150 Minutes • +1 / 0 Marking • Bilingual
                      </p>
                    </div>
                  </div>
                  <div className="self-start sm:self-auto pl-10.5 sm:pl-0 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800">
                      {wbtetPapers.length} Available
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {wbtetPapers.map((item) => renderPaperCard(item, 'indigo'))}
                </div>
              </section>
            )}

            {/* 4. Other / Custom Exams */}
            {activeTab !== 'all' && activeTab !== 'jee-main' && activeTab !== 'neet' && activeTab !== 'neet-ug' && activeTab !== 'wbtet' && (
              <section className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{activeTab.toUpperCase()} Question Papers</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Official CBT Examination Papers
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPapers
                    .filter((p) => p.exam === activeTab)
                    .map((item) => renderPaperCard(item, 'blue'))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pt-10 text-center text-xs text-slate-400 dark:text-slate-500">
        TestBench <span className="font-mono font-semibold">{APP_VERSION}</span> • NTA CBT Mock Test Platform
      </footer>

      {/* Notification Dialog */}
      <Dialog
        open={statusDialog.open}
        onClose={() => setStatusDialog({ ...statusDialog, open: false })}
        title={statusDialog.success ? 'Notification' : 'Notice'}
        footer={
          <Button
            variant="primary"
            onClick={() => setStatusDialog({ ...statusDialog, open: false })}
          >
            OK
          </Button>
        }
      >
        <div className="flex items-center gap-2">
          {statusDialog.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{statusDialog.message}</p>
        </div>
      </Dialog>
    </div>
  );
};
