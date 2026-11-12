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
  {
    id: 'neet-ug-2026',
    title: 'NEET UG 2026 — Official Question Paper',
    examName: 'NEET UG',
    year: 2026,
    shift: 'Paper',
    date: '2026-05-03',
    totalQuestions: 180,
    path: '/qna/neet-ug-2026.json',
    paperId: 'neet-ug-2026',
  },
  {
    id: 'neet-ug-2025',
    title: 'NEET UG 2025 — Official Question Paper (Code 45)',
    examName: 'NEET UG',
    year: 2025,
    shift: 'Code 45',
    date: '2025-05-04',
    totalQuestions: 180,
    path: '/qna/neet-ug-2025.json',
    paperId: 'neet-ug-2025',
  },
  {
    id: 'neet-ug-2024',
    title: 'NEET UG 2024 — Official Question Paper (Code S6)',
    examName: 'NEET UG',
    year: 2024,
    shift: 'Code S6',
    date: '2024-05-05',
    totalQuestions: 200,
    path: '/qna/neet-ug-2024.json',
    paperId: 'neet-ug-2024',
  },
  {
    id: 'neet-ug-2023',
    title: 'NEET UG 2023 — Official Question Paper (Code G6)',
    examName: 'NEET UG',
    year: 2023,
    shift: 'Code G6',
    date: '2023-05-07',
    totalQuestions: 200,
    path: '/qna/neet-ug-2023.json',
    paperId: 'neet-ug-2023',
  },
  {
    id: 'wbtet-2023',
    title: 'WB Primary TET 2023 — Official Question Paper (Bilingual)',
    examName: 'WB Primary TET',
    year: 2023,
    shift: 'Paper I',
    date: '2023-12-24',
    totalQuestions: 150,
    path: '/qna/wbtet-2023.json',
    paperId: 'wbtet-2023',
  },
  {
    id: 'wbtet-2022',
    title: 'WB Primary TET 2022 — Official Question Paper (Bilingual)',
    examName: 'WB Primary TET',
    year: 2022,
    shift: 'Paper I',
    date: '2022-12-11',
    totalQuestions: 150,
    path: '/qna/wbtet-2022.json',
    paperId: 'wbtet-2022',
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
