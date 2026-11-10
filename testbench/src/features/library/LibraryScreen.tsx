import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaperStore } from '@/stores/paperStore';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { importPaperJSON, importPaperZip } from '@/core/import';
import { saveAsset } from '@/data/repositories/assets';
import { formatTime } from '@/core/exam/timer';
import { CATALOG_PAPERS, loadCatalogPaper, seedAllCatalogPapers } from '@/data/catalog';
import {
  FileText,
  Upload,
  Play,
  Trash2,
  Settings,
  Sparkles,
  Clock,
  Layers,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  Compass,
  Stethoscope,
  Search,
  BookOpen,
  DownloadCloud,
  Database,
} from 'lucide-react';

type FilterTab = 'all' | 'jee-main' | 'neet' | 'custom';

export const LibraryScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    papers,
    loading,
    inProgressAttempt,
    inProgressPaper,
    loadPapers,
    addPaper,
    removePaper,
  } = usePaperStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [importReport, setImportReport] = useState<{
    open: boolean;
    success: boolean;
    message: string;
    issues?: Array<{ level: string; message: string }>;
  }>({ open: false, success: false, message: '' });

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isZip = file.name.toLowerCase().endsWith('.zip');

      if (isZip) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const result = importPaperZip(buffer);

        if (result.success && result.paper) {
          await addPaper(result.paper);
          for (const asset of result.assets) {
            await saveAsset(result.paper.id, asset.filename, asset.blob, asset.mimeType);
          }

          setImportReport({
            open: true,
            success: true,
            message: `Successfully imported "${result.paper.title}" with ${result.assets.length} image asset(s)!`,
            issues: result.issues,
          });
        } else {
          setImportReport({
            open: true,
            success: false,
            message: 'Failed to import ZIP package. Validation issues:',
            issues: result.issues,
          });
        }
      } else {
        const text = await file.text();
        const result = importPaperJSON(text);

        if (result.success && result.data) {
          await addPaper(result.data);
          setImportReport({
            open: true,
            success: true,
            message: `Successfully imported "${result.data.title}"!`,
            issues: result.issues,
          });
        } else {
          setImportReport({
            open: true,
            success: false,
            message: 'Failed to import paper. Please check the validation issues below:',
            issues: result.issues,
          });
        }
      }
    } catch (err) {
      setImportReport({
        open: true,
        success: false,
        message: `Could not read file: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTrySample = async () => {
    try {
      const res = await fetch('/samples/sample-mock-01.json');
      if (!res.ok) throw new Error('Sample file not found');
      const text = await res.text();
      const result = importPaperJSON(text);

      if (result.success && result.data) {
        await addPaper(result.data);
        setImportReport({
          open: true,
          success: true,
          message: 'Sample mock paper added successfully!',
        });
      }
    } catch (err) {
      setImportReport({
        open: true,
        success: false,
        message: `Could not load sample: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleSeedAll = async () => {
    setSeeding(true);
    try {
      const count = await seedAllCatalogPapers();
      await loadPapers();
      setImportReport({
        open: true,
        success: true,
        message: count > 0
          ? `Successfully loaded ${count} official JEE & NEET papers into your local library!`
          : 'All official JEE & NEET papers are already loaded in your library.',
      });
    } catch (err) {
      setImportReport({
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

    // 2. Overlay stored papers
    for (const s of papers) {
      const p = s.data;
      const totalQuestions = p.sections.reduce((sum, sec) => sum + sec.questions.length, 0);
      const existing = map.get(p.id);

      map.set(p.id, {
        id: p.id,
        title: p.title,
        exam: p.exam,
        description: p.description ?? existing?.description,
        durationMin: p.durationMin ?? 180,
        questionsCount: totalQuestions,
        sectionsCount: p.sections.length,
        badge: existing?.badge ?? (p.exam === 'jee-main' ? 'JEE Main' : p.exam === 'neet' ? 'NEET UG' : 'Custom'),
        isCatalog: existing?.isCatalog ?? false,
        isStored: true,
      });
    }

    return Array.from(map.values());
  }, [papers]);

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

  const customPapers = useMemo(
    () => filteredPapers.filter((p) => p.exam !== 'jee-main' && p.exam !== 'neet'),
    [filteredPapers]
  );

  const remainingMs = inProgressAttempt
    ? Math.max(0, inProgressAttempt.endsAt - Date.now())
    : 0;

  const renderPaperCard = (item: typeof allPaperItems[0], accent: 'blue' | 'emerald' | 'indigo') => {
    const isJee = item.exam === 'jee-main';
    const accentClass = isJee
      ? 'border-blue-200 hover:border-blue-500 group-hover:text-[#1f5fa6]'
      : accent === 'emerald'
      ? 'border-emerald-200 hover:border-emerald-500 group-hover:text-emerald-700'
      : 'border-indigo-200 hover:border-indigo-500 group-hover:text-indigo-700';

    const badgeBg = isJee
      ? 'bg-blue-50 text-[#1f5fa6] border-blue-200'
      : accent === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : 'bg-indigo-50 text-indigo-800 border-indigo-200';

    return (
      <div
        key={item.id}
        onClick={() => handleSelectPaper(item.id)}
        className={`bg-white rounded-2xl border p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group ${accentClass}`}
      >
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${badgeBg}`}>
              {item.badge ?? item.exam}
            </span>

            {item.isStored && !item.isCatalog && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${item.title}"?`)) {
                    removePaper(item.id);
                  }
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete paper"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <h3 className="text-base font-bold text-gray-900 transition-colors leading-snug">
            {item.title}
          </h3>

          {item.description && (
            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Metadata Chips */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
              {item.questionsCount} Qs
            </span>
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              {item.sectionsCount} Sec
            </span>
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {item.durationMin}m
            </span>
          </div>

          <span className="font-bold flex items-center gap-1 text-[#1f5fa6] group-hover:translate-x-0.5 transition-transform">
            Launch <Play className="w-3 h-3 fill-current" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-14">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1f5fa6] text-white flex items-center justify-center font-black text-lg shadow-xs">
              T
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">TestBench</h1>
              <p className="text-[11px] text-gray-500 font-medium">NTA CBT Mock Test Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/qna')}
              icon={<Database className="w-4 h-4 text-blue-600" />}
            >
              Q&A Database
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/analytics')}
              icon={<BarChart2 className="w-4 h-4 text-gray-600" />}
            >
              Analytics
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              icon={<Settings className="w-4 h-4 text-gray-600" />}
            >
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-7">
        {/* In-Progress Resume Card (if any) */}
        {inProgressAttempt && inProgressPaper && remainingMs > 0 && (
          <div className="bg-gradient-to-r from-blue-900 to-[#1f5fa6] text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Question Papers</h2>
            <p className="text-xs text-gray-500">Official JEE Main and NEET UG past year question papers</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json, .zip, application/zip"
              className="hidden"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedAll}
              disabled={seeding}
              icon={<DownloadCloud className="w-4 h-4 text-blue-600" />}
            >
              {seeding ? 'Loading Papers...' : 'Load All Papers'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTrySample}
              icon={<Sparkles className="w-4 h-4 text-amber-500" />}
            >
              Try Sample
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-4 h-4" />}
            >
              Import JSON / ZIP
            </Button>
          </div>
        </div>

        {/* Search & Tabs Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-gray-200/90 shadow-2xs">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Tests ({allPaperItems.length})
            </button>

            <button
              onClick={() => setActiveTab('jee-main')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'jee-main'
                  ? 'bg-[#1f5fa6] text-white'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-[#1f5fa6]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              JEE Main ({jeePapers.length})
            </button>

            <button
              onClick={() => setActiveTab('neet')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'neet'
                  ? 'bg-emerald-700 text-white'
                  : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              NEET UG ({neetPapers.length})
            </button>

            {customPapers.length > 0 && (
              <button
                onClick={() => setActiveTab('custom')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'custom'
                    ? 'bg-indigo-700 text-white'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                Custom ({customPapers.length})
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center text-gray-500 text-sm">Loading test papers...</div>
        ) : filteredPapers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-blue-50 text-[#1f5fa6] rounded-2xl flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No matching test papers</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              No tests match your current search query or filter. Try clearing the search or load the official papers.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
              <Button variant="primary" size="sm" onClick={handleSeedAll}>
                Load All Papers
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-9">
            {/* 1. JEE Main Section */}
            {(activeTab === 'all' || activeTab === 'jee-main') && jeePapers.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1f5fa6] flex items-center justify-center">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">JEE Main Question Papers</h3>
                      <p className="text-xs text-gray-500">
                        90 Questions (30 Physics, 30 Chemistry, 30 Math) • 180 Minutes • NTA CBT Pattern
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-[#1f5fa6]">
                    {jeePapers.length} Available
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jeePapers.map((item) => renderPaperCard(item, 'blue'))}
                </div>
              </section>
            )}

            {/* 2. NEET UG Section */}
            {(activeTab === 'all' || activeTab === 'neet') && neetPapers.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">NEET UG Question Papers</h3>
                      <p className="text-xs text-gray-500">
                        200 Questions (Physics, Chemistry, Botany, Zoology) • 200 Minutes • 720 Marks
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {neetPapers.length} Available
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {neetPapers.map((item) => renderPaperCard(item, 'emerald'))}
                </div>
              </section>
            )}

            {/* 3. Custom / Uploaded Section */}
            {(activeTab === 'all' || activeTab === 'custom') && customPapers.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Custom & Uploaded Tests</h3>
                      <p className="text-xs text-gray-500">User-imported test papers and sample mocks</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    {customPapers.length} Available
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customPapers.map((item) => renderPaperCard(item, 'indigo'))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Import Report Dialog */}
      <Dialog
        open={importReport.open}
        onClose={() => setImportReport({ ...importReport, open: false })}
        title={importReport.success ? 'Notification' : 'Import Report'}
        footer={
          <Button
            variant="primary"
            onClick={() => setImportReport({ ...importReport, open: false })}
          >
            OK
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {importReport.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <p className="text-sm font-medium text-gray-800">{importReport.message}</p>
          </div>

          {importReport.issues && importReport.issues.length > 0 && (
            <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-48 overflow-y-auto space-y-1.5">
              {importReport.issues.map((iss, i) => (
                <div
                  key={i}
                  className={`text-xs ${
                    iss.level === 'error' ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  <span className="font-bold">[{iss.level.toUpperCase()}]: </span>
                  {iss.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};
