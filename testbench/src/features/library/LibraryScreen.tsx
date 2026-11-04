import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaperStore } from '@/stores/paperStore';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { importPaperJSON, importPaperZip } from '@/core/import';
import { saveAsset } from '@/data/repositories/assets';
import { formatTime } from '@/core/exam/timer';
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
} from 'lucide-react';

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
          // Persist all assets in IndexedDB
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

  const remainingMs = inProgressAttempt
    ? Math.max(0, inProgressAttempt.endsAt - Date.now())
    : 0;

  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-12">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1f5fa6] text-white flex items-center justify-center font-black text-lg shadow-xs">
              T
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">TestBench</h1>
              <p className="text-[11px] text-gray-500 font-medium">NTA-Style Mock Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
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

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Question Papers</h2>
            <p className="text-xs text-gray-500">Practice full-length and sectional tests</p>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json, .zip, application/zip"
              className="hidden"
            />

            <Button
              variant="outline"
              size="md"
              onClick={handleTrySample}
              icon={<Sparkles className="w-4 h-4 text-amber-500" />}
            >
              Try Sample
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-4 h-4" />}
            >
              Import Paper
            </Button>
          </div>
        </div>

        {/* Papers Grid */}
        {loading ? (
          <div className="py-20 text-center text-gray-500 text-sm">Loading papers...</div>
        ) : papers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center space-y-3">
            <div className="w-14 h-14 bg-blue-50 text-[#1f5fa6] rounded-2xl flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No test papers yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Import a JSON question paper from your device or try our pre-packaged JEE-style sample paper.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button variant="outline" size="sm" onClick={handleTrySample}>
                Load Sample Paper
              </Button>
              <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>
                Upload JSON
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {papers.map((stored) => {
              const paper = stored.data;
              const totalQuestions = paper.sections.reduce(
                (sum: number, s) => sum + s.questions.length,
                0
              );

              return (
                <div
                  key={paper.id}
                  onClick={() => navigate(`/paper/${paper.id}`)}
                  className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-[#1f5fa6] border border-blue-100">
                        {paper.exam}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${paper.title}"?`)) {
                            removePaper(paper.id);
                          }
                        }}
                        className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete paper"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-gray-900 group-hover:text-[#1f5fa6] transition-colors">
                      {paper.title}
                    </h3>

                    {paper.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{paper.description}</p>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                        {totalQuestions} Qs
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-gray-400" />
                        {paper.sections.length} Sec
                      </span>
                      {paper.durationMin && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {paper.durationMin}m
                        </span>
                      )}
                    </div>

                    <span className="text-[#1f5fa6] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      View <Play className="w-3 h-3 fill-current" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Import Report Dialog */}
      <Dialog
        open={importReport.open}
        onClose={() => setImportReport({ ...importReport, open: false })}
        title={importReport.success ? 'Import Complete' : 'Import Report'}
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
