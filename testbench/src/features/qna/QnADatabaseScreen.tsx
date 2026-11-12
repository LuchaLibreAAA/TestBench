import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQnADatabase, QNA_CATALOG, type QnADatabaseData } from '@/data/repositories/qna';
import { Button } from '@/components/Button';
import { Img } from '@/components/Img';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  Search,
  Filter,
  Play,
  Database,
  CheckCircle2,
  FileQuestion,
} from 'lucide-react';

export const QnADatabaseScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDbId, setSelectedDbId] = useState<string>(QNA_CATALOG[0].id);
  const [data, setData] = useState<QnADatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const activeCatalogEntry = useMemo(
    () => QNA_CATALOG.find((c) => c.id === selectedDbId) ?? QNA_CATALOG[0],
    [selectedDbId]
  );
  const paperId = activeCatalogEntry.paperId;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setSelectedSubject('all');
      setSelectedType('all');
      const res = await getQnADatabase(selectedDbId);
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [selectedDbId]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    if (!data) return [];
    return data.questions.filter((q) => {
      // Subject filter
      if (selectedSubject !== 'all' && q.subject.toLowerCase() !== selectedSubject.toLowerCase()) {
        return false;
      }
      // Type filter
      if (selectedType !== 'all') {
        if (selectedType === 'mcq' && q.type !== 'single_choice') return false;
        if (selectedType === 'numeric' && q.type !== 'numeric') return false;
      }
      // Search filter
      const qNumStr = `q${q.questionNumber} ${q.questionNumber}`;
      const search = searchQuery.toLowerCase().trim();
      if (search) {
        const matchesNum = qNumStr.includes(search);
        const matchesId = q.questionId.toLowerCase().includes(search);
        const matchesSubject = q.subject.toLowerCase().includes(search);
        const matchesSection = q.sectionId.toLowerCase().includes(search);
        if (!matchesNum && !matchesId && !matchesSubject && !matchesSection) {
          return false;
        }
      }
      return true;
    });
  }, [data, selectedSubject, selectedType, searchQuery]);

  // Dynamic subject counts & type counts
  const { subjectEntries, mcqCount, numericCount } = useMemo(() => {
    if (!data) return { subjectEntries: [] as Array<[string, number]>, mcqCount: 0, numericCount: 0 };
    const counts = new Map<string, number>();
    let mcq = 0;
    let num = 0;
    for (const q of data.questions) {
      counts.set(q.subject, (counts.get(q.subject) ?? 0) + 1);
      if (q.type === 'single_choice') mcq++;
      else if (q.type === 'numeric') num++;
    }
    return { subjectEntries: Array.from(counts.entries()), mcqCount: mcq, numericCount: num };
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 transition-colors">
      {/* Top Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 safe-top">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#1a56db] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">Q&A Question Bank</h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{activeCatalogEntry.title}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/paper/${paperId}`)}
              icon={<Play className="w-4 h-4 fill-current" />}
              className="font-semibold"
            >
              Practice Exam
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Paper Switcher Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {QNA_CATALOG.map((entry) => {
            const active = entry.id === selectedDbId;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedDbId(entry.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  active
                    ? 'bg-[#1a56db] text-white border-[#1a56db] shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {entry.examName} {entry.year} ({entry.totalQuestions} Qs)
              </button>
            );
          })}
        </div>

        {/* Banner Card */}
        <div className="bg-gradient-to-r from-[#1642a8] to-[#1a56db] dark:from-slate-900 dark:to-blue-950/90 dark:border dark:border-slate-800 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-blue-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              Official NTA Question Bank
            </span>
            <h2 className="text-2xl font-black tracking-tight">{activeCatalogEntry.title}</h2>
            <p className="text-xs text-blue-100/90 max-w-2xl leading-relaxed">
              Extracted Q&A dataset containing {data?.examMetadata.totalQuestions ?? activeCatalogEntry.totalQuestions} questions with high-resolution clipped statements, formulas, diagrams, and verified metadata.
            </p>
          </div>

          <div className="flex items-center gap-4 border-t border-white/10 md:border-t-0 pt-3 md:pt-0">
            <div className="text-center px-3 py-1.5 bg-white/10 rounded-xl">
              <span className="block text-xl font-black">{data?.examMetadata.totalQuestions ?? activeCatalogEntry.totalQuestions}</span>
              <span className="text-[10px] text-blue-200 uppercase font-semibold">Questions</span>
            </div>
            <div className="text-center px-3 py-1.5 bg-white/10 rounded-xl">
              <span className="block text-xl font-black">{data?.examMetadata.totalMarks ?? '—'}</span>
              <span className="text-[10px] text-blue-200 uppercase font-semibold">Marks</span>
            </div>
            <div className="text-center px-3 py-1.5 bg-white/10 rounded-xl">
              <span className="block text-xl font-black">{data?.examMetadata.durationMinutes ?? '—'}m</span>
              <span className="text-[10px] text-blue-200 uppercase font-semibold">Duration</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by question number (e.g. Q1, 25) or ID (691121151)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:border-[#1a56db] dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Question Type Filter */}
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedType === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All Types
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('mcq')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedType === 'mcq'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                MCQs ({mcqCount})
              </button>
              {numericCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedType('numeric')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedType === 'numeric'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Numeric ({numericCount})
                </button>
              )}
            </div>
          </div>

          {/* Subject Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Subject:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                selectedSubject === 'all'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              All Subjects ({data?.questions.length ?? 0})
            </button>
            {subjectEntries.map(([subject, count]) => (
              <button
                key={subject}
                type="button"
                onClick={() => setSelectedSubject(subject)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                  selectedSubject.toLowerCase() === subject.toLowerCase()
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#1a56db] dark:text-blue-400 border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {subject} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#1a56db] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading Q&A Database...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center space-y-3">
            <FileQuestion className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No questions found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your search query or subject filters.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 font-medium">
              <span>Showing {filteredQuestions.length} of {data?.questions.length ?? 75} questions</span>
            </div>

            {filteredQuestions.map((q) => {
              const stmtImg = q.content.imagePaths[0] ? q.content.imagePaths[0].replace(/^images\//, '') : '';
              const isMcq = q.type === 'single_choice';

              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs p-5 sm:p-6 space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Question {q.questionNumber}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{q.subject}</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        {isMcq ? 'Section A (MCQ)' : 'Section B (Numerical)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        QID: {q.questionId}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">
                        Pages {q.source.pages.join('–')}
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-1.5 py-0.5 rounded font-sans font-bold">
                        +4 / {isMcq ? '-1' : '0'}
                      </span>
                    </div>
                  </div>

                  {/* Statement Image */}
                  <div className="py-2">
                    {stmtImg ? (
                      <Img paperId={paperId} src={stmtImg} alt={`Question ${q.questionNumber}`} />
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic">No image statement available</p>
                    )}
                  </div>

                  {/* Options for MCQ */}
                  {isMcq && q.options && q.options.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Options
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt, optIdx) => {
                          const optImg = opt.imagePaths[0] ? opt.imagePaths[0].replace(/^images\//, '') : '';
                          const letter = String.fromCharCode(65 + optIdx);
                          const isCorrect =
                            q.answer.isAnswerKeyAvailable && q.answer.correctOptionId === opt.id;

                          return (
                            <div
                              key={opt.id}
                              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                                isCorrect
                                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
                              }`}
                            >
                              <div
                                className={`shrink-0 w-7 h-7 rounded-full border font-bold text-xs flex items-center justify-center mt-0.5 shadow-2xs ${
                                  isCorrect
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {letter}
                              </div>
                              <div className="flex-1 space-y-1.5">
                                {opt.text && (
                                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">
                                    {opt.text}
                                  </span>
                                )}
                                {optImg && (
                                  <Img paperId={paperId} src={optImg} alt={`Option ${letter}`} />
                                )}
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block">
                                  ID: {opt.optionId}{isCorrect ? ' • Verified Answer' : ''}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Numerical Indicator */}
                  {!isMcq && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70 rounded-lg text-xs font-medium">
                        Numerical value answer (0 to 9999)
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
