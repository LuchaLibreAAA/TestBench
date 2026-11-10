import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQnADatabase, type QnADatabaseData } from '@/data/repositories/qna';
import { Button } from '@/components/Button';
import { Img } from '@/components/Img';
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
  const [data, setData] = useState<QnADatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const paperId = 'jee-main-2026-apr-s2';

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getQnADatabase('jee-main-2026-shift2');
      setData(res);
      setLoading(false);
    }
    load();
  }, []);

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
        const matchesId = q.questionId.includes(search);
        const matchesSubject = q.subject.toLowerCase().includes(search);
        const matchesSection = q.sectionId.toLowerCase().includes(search);
        if (!matchesNum && !matchesId && !matchesSubject && !matchesSection) {
          return false;
        }
      }
      return true;
    });
  }, [data, selectedSubject, selectedType, searchQuery]);

  // Subject counts
  const subjectCounts = useMemo(() => {
    if (!data) return { all: 0, math: 0, phy: 0, chem: 0 };
    return {
      all: data.questions.length,
      math: data.questions.filter((q) => q.subject.toLowerCase().includes('math')).length,
      phy: data.questions.filter((q) => q.subject.toLowerCase().includes('physic')).length,
      chem: data.questions.filter((q) => q.subject.toLowerCase().includes('chem')).length,
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
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
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Q&A Question Bank</h1>
                <p className="text-[11px] text-gray-500 font-medium">JEE Main 2026 (02 Apr, Shift 2)</p>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/paper/${paperId}`)}
            icon={<Play className="w-4 h-4 fill-current" />}
            className="bg-[#1f5fa6] hover:bg-[#184b85] font-semibold"
          >
            Practice Exam
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner Card */}
        <div className="bg-gradient-to-r from-[#173d69] to-[#1f5fa6] text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-blue-100">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              Official NTA Question Bank
            </span>
            <h2 className="text-2xl font-black tracking-tight">JEE Main 2026 — 2nd April Shift 2</h2>
            <p className="text-xs text-blue-100 max-w-2xl leading-relaxed">
              Complete question-and-answer dataset containing 75 questions with original high-resolution clipped formulas, diagrams, and options extracted from the official NTA CBT PDF.
            </p>
          </div>

          <div className="flex items-center gap-4 border-t border-white/10 md:border-t-0 pt-3 md:pt-0">
            <div className="text-center px-3 py-1 bg-white/10 rounded-xl">
              <span className="block text-xl font-black">75</span>
              <span className="text-[10px] text-blue-200 uppercase font-semibold">Questions</span>
            </div>
            <div className="text-center px-3 py-1 bg-white/10 rounded-xl">
              <span className="block text-xl font-black">300</span>
              <span className="text-[10px] text-blue-200 uppercase font-semibold">Marks</span>
            </div>
            <div className="text-center px-3 py-1 bg-white/10 rounded-xl">
              <span className="block text-xl font-black">180m</span>
              <span className="text-[10px] text-blue-200 uppercase font-semibold">Duration</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by question number (e.g. Q1, 25) or ID (691121151)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#1f5fa6] focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Question Type Filter */}
            <div className="flex items-center gap-1.5 shrink-0 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedType === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Types
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('mcq')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedType === 'mcq' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                MCQs (60)
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('numeric')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  selectedType === 'numeric' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Numeric (15)
              </button>
            </div>
          </div>

          {/* Subject Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Subject:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                selectedSubject === 'all'
                  ? 'bg-blue-50 text-[#1f5fa6] border-blue-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              All Subjects ({subjectCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setSelectedSubject('mathematics')}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                selectedSubject === 'mathematics'
                  ? 'bg-blue-50 text-[#1f5fa6] border-blue-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Mathematics ({subjectCounts.math})
            </button>
            <button
              type="button"
              onClick={() => setSelectedSubject('physics')}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                selectedSubject === 'physics'
                  ? 'bg-blue-50 text-[#1f5fa6] border-blue-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Physics ({subjectCounts.phy})
            </button>
            <button
              type="button"
              onClick={() => setSelectedSubject('chemistry')}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                selectedSubject === 'chemistry'
                  ? 'bg-blue-50 text-[#1f5fa6] border-blue-200'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Chemistry ({subjectCounts.chem})
            </button>
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#1f5fa6] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-gray-600">Loading Q&A Database...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-3">
            <FileQuestion className="w-10 h-10 text-gray-400 mx-auto" />
            <h3 className="text-base font-bold text-gray-800">No questions found</h3>
            <p className="text-xs text-gray-500">Try adjusting your search query or subject filters.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs text-gray-500 px-1 font-medium">
              <span>Showing {filteredQuestions.length} of {data?.questions.length ?? 75} questions</span>
            </div>

            {filteredQuestions.map((q) => {
              const stmtImg = q.content.imagePaths[0] ? q.content.imagePaths[0].replace(/^images\//, '') : '';
              const isMcq = q.type === 'single_choice';

              return (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-5 sm:p-6 space-y-4 hover:border-gray-300 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">
                        Question {q.questionNumber}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="font-semibold text-gray-700">{q.subject}</span>
                      <span className="text-gray-300">•</span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        {isMcq ? 'Section A (MCQ)' : 'Section B (Numerical)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        QID: {q.questionId}
                      </span>
                      <span className="text-gray-400">
                        Pages {q.source.pages.join('–')}
                      </span>
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-sans font-bold">
                        +4 / {isMcq ? '-1' : '0'}
                      </span>
                    </div>
                  </div>

                  {/* Statement Image */}
                  <div className="py-2">
                    {stmtImg ? (
                      <Img paperId={paperId} src={stmtImg} alt={`Question ${q.questionNumber}`} />
                    ) : (
                      <p className="text-sm text-gray-500 italic">No image statement available</p>
                    )}
                  </div>

                  {/* Options for MCQ */}
                  {isMcq && q.options && q.options.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 space-y-2.5">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                        Options
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt, optIdx) => {
                          const optImg = opt.imagePaths[0] ? opt.imagePaths[0].replace(/^images\//, '') : '';
                          const letter = String.fromCharCode(65 + optIdx);

                          return (
                            <div
                              key={opt.id}
                              className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 flex items-start gap-3"
                            >
                              <div className="shrink-0 w-7 h-7 rounded-full bg-white border border-gray-300 text-gray-700 font-bold text-xs flex items-center justify-center mt-0.5 shadow-2xs">
                                {letter}
                              </div>
                              <div className="flex-1 space-y-1">
                                {optImg && (
                                  <Img paperId={paperId} src={optImg} alt={`Option ${letter}`} />
                                )}
                                <span className="text-[10px] text-gray-400 font-mono block">
                                  ID: {opt.optionId}
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
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium">
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
