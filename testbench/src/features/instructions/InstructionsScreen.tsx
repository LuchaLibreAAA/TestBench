import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getPaper } from '@/data/repositories/papers';
import { useExamStore } from '@/stores/examStore';
import type { Paper } from '@/core/schema';
import { Button } from '@/components/Button';
import { resolveText } from '@/core/utils/localized-text';
import {
  ChevronLeft,
  CheckSquare,
  Square,
  Play,
  Globe,
} from 'lucide-react';

export const InstructionsScreen: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const paperId = (location.state as any)?.paperId;
  const [paper, setPaper] = useState<Paper | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(true);

  const { startExam } = useExamStore();

  useEffect(() => {
    async function load() {
      if (!paperId) {
        navigate('/');
        return;
      }
      try {
        const stored = await getPaper(paperId);
        if (stored) {
          setPaper(stored.data);
          if (stored.data.languages.length > 0) {
            setLanguage(stored.data.languages[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load paper for instructions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [paperId, navigate]);

  if (loading || !paper || !attemptId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading instructions...</p>
      </div>
    );
  }

  const handleBegin = async () => {
    if (!agreed) return;
    await startExam(paper, attemptId, language);
    navigate(`/exam/${attemptId}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-2xs safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/paper/${paper.id}`)}
              className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold text-gray-900 truncate">
              Instructions: {paper.title}
            </h1>
          </div>

          {paper.languages.length > 1 && (
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                {paper.languages.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Notice Card */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Please read the instructions carefully:</h2>

          {/* General instructions text */}
          <div className="text-sm text-gray-700 leading-relaxed space-y-3">
            <p>
              1. The clock will be set at the server. The countdown timer at the top of screen will display the remaining time available for you to complete the examination.
            </p>
            <p>
              2. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.
            </p>
            <p>
              3. The Question Palette displayed on the screen will show the status of each question using the official NTA symbols:
            </p>

            {/* Symbols Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 pb-2">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="w-6 h-6 rounded-md bg-gray-100 border border-gray-300 text-gray-700 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <span className="text-xs text-gray-700">You have not visited the question yet.</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="w-6 h-6 rounded-md bg-[#e5533d] text-white flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <span className="text-xs text-gray-700">You have not answered the question.</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="w-6 h-6 rounded-md bg-[#2e9e5b] text-white flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <span className="text-xs text-gray-700">You have answered the question.</span>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="w-6 h-6 rounded-full bg-[#6f42c1] text-white flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <span className="text-xs text-gray-700">You have NOT answered, but marked for review.</span>
              </div>

              <div className="col-span-1 sm:col-span-2 flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="relative w-6 h-6 rounded-full bg-[#6f42c1] text-white flex items-center justify-center font-bold text-xs">
                  5
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#2e9e5b] rounded-full border border-white" />
                </span>
                <span className="text-xs text-gray-700">
                  The question has been answered AND marked for review (will be evaluated).
                </span>
              </div>
            </div>

            <p>
              4. To answer a question, select your option and click <strong>Save & Next</strong>. To change your answer, simply select another option or click <strong>Clear Response</strong>.
            </p>
          </div>
        </div>

        {/* Paper Summary Box */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Marking Pattern Summary</h3>
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3 text-center">Questions</th>
                  <th className="py-2.5 px-3 text-center text-[#2e9e5b]">Correct</th>
                  <th className="py-2.5 px-3 text-center text-[#e5533d]">Wrong</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paper.sections.map((sec) => (
                  <tr key={sec.id}>
                    <td className="py-2 px-3 font-medium text-gray-800">
                      {resolveText(sec.name, language)}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-600">
                      {sec.questions.length}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-[#2e9e5b]">
                      +{sec.marking.correct}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-[#e5533d]">
                      {sec.marking.wrong}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Declaration and Agree Checkbox */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-4">
          <div
            onClick={() => setAgreed(!agreed)}
            className="flex items-start gap-3 cursor-pointer select-none"
          >
            <div className="mt-0.5 text-[#1f5fa6] shrink-0">
              {agreed ? (
                <CheckSquare className="w-5 h-5 fill-current" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-800 font-medium leading-relaxed">
              I have read and understood all the instructions given above. I agree that in case of not adhering to the exam instructions, I will be disqualified.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            disabled={!agreed}
            onClick={handleBegin}
            icon={<Play className="w-5 h-5 fill-current" />}
            className="w-full bg-[#1f5fa6] hover:bg-[#184d87] font-bold text-base"
          >
            I am ready to begin
          </Button>
        </div>
      </main>
    </div>
  );
};
