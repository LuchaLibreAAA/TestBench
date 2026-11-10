import { db, type StoredQnADatabase } from '../db';

export interface QnAQuestion {
  id: string;
  questionNumber: number;
  questionId: string;
  sectionId: string;
  subject: string;
  type: 'single_choice' | 'numeric' | string;
  content: {
    text: string;
    imagePaths: string[];
  };
  options: Array<{
    id: string;
    optionNumber: number;
    optionId: string;
    label: string;
    text: string;
    imagePaths: string[];
  }>;
  answer: {
    correctOptionId: string | null;
    correctNumericValue: number | null;
    isAnswerKeyAvailable: boolean;
  };
  explanation?: {
    text: string;
    imagePaths: string[];
  };
  source: {
    pages: number[];
    extractor: string;
  };
}

export interface QnADatabaseData {
  schemaVersion: string;
  examMetadata: {
    examName: string;
    year: number;
    session?: string;
    date?: string;
    shift?: string;
    paper?: string;
    totalMarks: number;
    durationMinutes: number;
    totalQuestions: number;
    sourcePdf: string;
  };
  sections: Array<{
    sectionId: string;
    sectionName: string;
    subject: string;
    questionType: string;
    markingScheme: { correct: number; wrong: number; unattempted: number };
  }>;
  questions: QnAQuestion[];
}

export const QNA_CATALOG = [
  {
    id: 'jee-main-2026-shift2',
    title: 'JEE Main 2026 — April Session (02 Apr, Shift 2)',
    examName: 'JEE Main',
    year: 2026,
    shift: 'Shift 2',
    date: '2026-04-02',
    totalQuestions: 75,
    path: '/qna/jee-main-2026-shift2.json',
    paperId: 'jee-main-2026-apr-s2',
  },
];

/** Fetch and cache QnA database into IndexedDB */
export async function getQnADatabase(id: string = 'jee-main-2026-shift2'): Promise<QnADatabaseData | null> {
  // Check IndexedDB cache
  const stored = await db.qnaDatabases.get(id);
  if (stored) {
    return stored.data as QnADatabaseData;
  }

  // Find in catalog and fetch
  const entry = QNA_CATALOG.find((c) => c.id === id);
  if (!entry) return null;

  try {
    const res = await fetch(entry.path);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${entry.path}`);
    const data: QnADatabaseData = await res.json();

    const toStore: StoredQnADatabase = {
      id,
      title: entry.title,
      examName: entry.examName,
      year: entry.year,
      data,
      updatedAt: Date.now(),
    };
    await db.qnaDatabases.put(toStore);
    return data;
  } catch (err) {
    console.error(`Failed to load QnA database ${id}:`, err);
    return null;
  }
}
