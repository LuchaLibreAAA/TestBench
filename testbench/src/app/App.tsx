import { HashRouter, Routes, Route } from 'react-router-dom';
import { LibraryScreen } from '@/features/library/LibraryScreen';
import { PaperDetailScreen } from '@/features/library/PaperDetailScreen';
import { InstructionsScreen } from '@/features/instructions/InstructionsScreen';
import { ExamScreen } from '@/features/exam/ExamScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { AnalyticsScreen } from '@/features/analytics/AnalyticsScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { QnADatabaseScreen } from '@/features/qna/QnADatabaseScreen';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LibraryScreen />} />
        <Route path="/qna" element={<QnADatabaseScreen />} />
        <Route path="/paper/:id" element={<PaperDetailScreen />} />
        <Route path="/exam/:attemptId/instructions" element={<InstructionsScreen />} />
        <Route path="/exam/:attemptId" element={<ExamScreen />} />
        <Route path="/result/:attemptId" element={<ResultScreen />} />
        <Route path="/review/:attemptId" element={<ReviewScreen />} />
        <Route path="/analytics" element={<AnalyticsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
    </HashRouter>
  );
}
