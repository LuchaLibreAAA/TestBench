import React, { useState } from 'react';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/Button';
import type { Section, Response, QuestionStatus } from '@/core/schema';
import { resolveText } from '@/core/utils/localized-text';
import { AlertTriangle, Send } from 'lucide-react';

export interface SummaryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirmSubmit: () => void;
  sections: Section[];
  responses: Record<string, Response>;
  language: string;
}

export const SummaryDialog: React.FC<SummaryDialogProps> = ({
  open,
  onClose,
  onConfirmSubmit,
  sections,
  responses,
  language,
}) => {
  const [confirmStep, setConfirmStep] = useState(false);

  // Compute breakdown per section
  const sectionBreakdown = sections.map((sec) => {
    const counts: Record<QuestionStatus, number> = {
      notVisited: 0,
      notAnswered: 0,
      answered: 0,
      marked: 0,
      answeredMarked: 0,
    };

    sec.questions.forEach((q) => {
      const resp = responses[q.id];
      const st: QuestionStatus = resp?.status ?? 'notVisited';
      counts[st] = (counts[st] ?? 0) + 1;
    });

    return {
      id: sec.id,
      name: resolveText(sec.name, language),
      total: sec.questions.length,
      answered: counts.answered + counts.answeredMarked,
      notAnswered: counts.notAnswered,
      marked: counts.marked,
      notVisited: counts.notVisited,
    };
  });

  const totals = sectionBreakdown.reduce(
    (acc, curr) => ({
      total: acc.total + curr.total,
      answered: acc.answered + curr.answered,
      notAnswered: acc.notAnswered + curr.notAnswered,
      marked: acc.marked + curr.marked,
      notVisited: acc.notVisited + curr.notVisited,
    }),
    { total: 0, answered: 0, notAnswered: 0, marked: 0, notVisited: 0 }
  );

  const handleClose = () => {
    setConfirmStep(false);
    onClose();
  };

  const handleFinalSubmit = () => {
    setConfirmStep(false);
    onConfirmSubmit();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={confirmStep ? 'Final Confirmation' : 'Test Summary'}
      maxWidth="lg"
      footer={
        confirmStep ? (
          <>
            <Button variant="ghost" onClick={() => setConfirmStep(false)}>
              Back
            </Button>
            <Button
              variant="danger"
              onClick={handleFinalSubmit}
              icon={<Send className="w-4 h-4" />}
            >
              Yes, Submit Test
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Resume Test
            </Button>
            <Button
              variant="success"
              onClick={() => setConfirmStep(true)}
              icon={<Send className="w-4 h-4" />}
            >
              Submit Test
            </Button>
          </>
        )
      }
    >
      {confirmStep ? (
        <div className="py-4 text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-gray-900">
              Are you sure you want to submit?
            </h4>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              You will not be able to change any answers once you submit. Your final score will be calculated immediately.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-2 text-center text-[#2e9e5b]">Ans</th>
                  <th className="py-2.5 px-2 text-center text-[#e5533d]">Not Ans</th>
                  <th className="py-2.5 px-2 text-center text-[#6f42c1]">Marked</th>
                  <th className="py-2.5 px-2 text-center text-gray-500">Not Vis</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sectionBreakdown.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="py-2 px-3 font-medium text-gray-800">{row.name}</td>
                    <td className="py-2 px-2 text-center font-semibold text-[#2e9e5b]">
                      {row.answered}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-[#e5533d]">
                      {row.notAnswered}
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-[#6f42c1]">
                      {row.marked}
                    </td>
                    <td className="py-2 px-2 text-center text-gray-500">{row.notVisited}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-700">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100/70 border-t border-gray-200 font-bold text-gray-900">
                <tr>
                  <td className="py-2.5 px-3">Total</td>
                  <td className="py-2.5 px-2 text-center text-[#2e9e5b]">{totals.answered}</td>
                  <td className="py-2.5 px-2 text-center text-[#e5533d]">{totals.notAnswered}</td>
                  <td className="py-2.5 px-2 text-center text-[#6f42c1]">{totals.marked}</td>
                  <td className="py-2.5 px-2 text-center text-gray-500">{totals.notVisited}</td>
                  <td className="py-2.5 px-3 text-right">{totals.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {totals.answered < totals.total && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                You have {totals.total - totals.answered} unattempted or unanswered question(s).
              </span>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};

