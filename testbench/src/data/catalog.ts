import type { Paper } from '@/core/schema';
import { importPaperJSON } from '@/core/import';
import { savePaper, getPaper } from './repositories/papers';

export interface CatalogItem {
  id: string;
  exam: 'jee-main' | 'neet' | string;
  year: number;
  title: string;
  description: string;
  durationMin: number;
  sectionsCount: number;
  questionsCount: number;
  path: string;
  badge: string;
  accentColor: string;
}

export const CATALOG_PAPERS: CatalogItem[] = [
  {
    id: 'jee-main-2026-apr-s2',
    exam: 'jee-main',
    year: 2026,
    title: 'JEE Main 2026 — April Session (02 Apr, Shift 2)',
    description: 'Official NTA JEE Main April 2026 Session 2 question paper. 75 questions across Mathematics, Physics, and Chemistry with high-resolution clipped formulas and diagrams.',
    durationMin: 180,
    sectionsCount: 6,
    questionsCount: 75,
    path: '/papers/jee-main/jee-main-2026-apr-s2.json',
    badge: 'JEE 2026 Shift 2',
    accentColor: '#1f5fa6',
  },
  {
    id: 'jee-main-2024-jan-s1',
    exam: 'jee-main',
    year: 2024,
    title: 'JEE Main 2024 — January Session 1 (27 Jan, Shift 1)',
    description: 'Full official NTA JEE Main question paper. 90 questions across Physics, Chemistry, and Mathematics with KaTeX solutions and numerical section limits.',
    durationMin: 180,
    sectionsCount: 6,
    questionsCount: 90,
    path: '/papers/jee-main/jee-main-2024-jan-s1.json',
    badge: 'JEE 2024 Shift 1',
    accentColor: '#1f5fa6',
  },
  {
    id: 'jee-main-2023-apr-s1',
    exam: 'jee-main',
    year: 2023,
    title: 'JEE Main 2023 — April Session 2 (06 Apr, Shift 1)',
    description: 'Full official NTA JEE Main question paper. 90 questions across Physics, Chemistry, and Mathematics.',
    durationMin: 180,
    sectionsCount: 6,
    questionsCount: 90,
    path: '/papers/jee-main/jee-main-2023-apr-s1.json',
    badge: 'JEE 2023 Session 2',
    accentColor: '#1f5fa6',
  },
  {
    id: 'neet-ug-2026',
    exam: 'neet',
    year: 2026,
    title: 'NEET UG 2026 — Official Question Paper',
    description: 'Complete National Eligibility cum Entrance Test (UG) 2026. 180 compulsory questions across Biology, Chemistry, and Physics with cleaned formulas and diagrams.',
    durationMin: 180,
    sectionsCount: 3,
    questionsCount: 180,
    path: '/papers/neet/neet-ug-2026.json',
    badge: 'NEET 2026 Official',
    accentColor: '#059669',
  },
  {
    id: 'neet-ug-2025',
    exam: 'neet',
    year: 2025,
    title: 'NEET UG 2025 — Official Question Paper',
    description: 'Complete National Eligibility cum Entrance Test (UG) 2025 (Booklet 45). 180 compulsory questions across Physics, Chemistry, and Biology.',
    durationMin: 180,
    sectionsCount: 3,
    questionsCount: 180,
    path: '/papers/neet/neet-ug-2025.json',
    badge: 'NEET 2025 Official',
    accentColor: '#059669',
  },
  {
    id: 'neet-ug-2024',
    exam: 'neet',
    year: 2024,
    title: 'NEET UG 2024 — Official Question Paper',
    description: 'Complete National Eligibility cum Entrance Test (UG) 2024 (Booklet S6). 200 questions across Physics, Chemistry, Botany, and Zoology with Section A & B optional choices.',
    durationMin: 200,
    sectionsCount: 8,
    questionsCount: 200,
    path: '/papers/neet/neet-ug-2024.json',
    badge: 'NEET 2024 Official',
    accentColor: '#059669',
  },
  {
    id: 'neet-ug-2023',
    exam: 'neet',
    year: 2023,
    title: 'NEET UG 2023 — Official Question Paper',
    description: 'Complete National Eligibility cum Entrance Test (UG) 2023 (Booklet G6). 200 questions across Physics, Chemistry, Botany, and Zoology.',
    durationMin: 200,
    sectionsCount: 8,
    questionsCount: 200,
    path: '/papers/neet/neet-ug-2023.json',
    badge: 'NEET 2023 Official',
    accentColor: '#059669',
  },
];

/** Fetch and import a catalog paper into IndexedDB */
export async function loadCatalogPaper(id: string): Promise<Paper | null> {
  const item = CATALOG_PAPERS.find((p) => p.id === id);
  if (!item) return null;

  try {
    const res = await fetch(item.path);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${item.path}`);
    const text = await res.text();
    const result = importPaperJSON(text);
    if (result.success && result.data) {
      await savePaper(result.data);
      return result.data;
    }
  } catch (err) {
    console.error(`Failed to load catalog paper ${id}:`, err);
  }
  return null;
}

/** Pre-seed or ensure all catalog papers are in IndexedDB */
export async function seedAllCatalogPapers(): Promise<number> {
  let seeded = 0;
  for (const item of CATALOG_PAPERS) {
    const existing = await getPaper(item.id);
    if (!existing) {
      const loaded = await loadCatalogPaper(item.id);
      if (loaded) seeded++;
    }
  }
  return seeded;
}

