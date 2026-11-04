import { create } from 'zustand';
import {
  getAllPapers,
  savePaper,
  deletePaper,
  getPaper,
  type StoredPaper,
} from '@/data/repositories/papers';
import { getInProgressAttempt } from '@/data/repositories/attempts';
import type { Paper, Attempt } from '@/core/schema';

interface PaperStore {
  papers: StoredPaper[];
  loading: boolean;
  inProgressAttempt: Attempt | null;
  inProgressPaper: Paper | null;
  loadPapers: () => Promise<void>;
  checkInProgress: () => Promise<void>;
  addPaper: (paper: Paper) => Promise<void>;
  removePaper: (id: string) => Promise<void>;
}

export const usePaperStore = create<PaperStore>((set, get) => ({
  papers: [],
  loading: false,
  inProgressAttempt: null,
  inProgressPaper: null,

  loadPapers: async () => {
    set({ loading: true });
    try {
      const papers = await getAllPapers();
      set({ papers, loading: false });
      await get().checkInProgress();
    } catch (err) {
      console.error('Failed to load papers:', err);
      set({ loading: false });
    }
  },

  checkInProgress: async () => {
    try {
      const attempt = await getInProgressAttempt();
      if (attempt) {
        // If expired, skip
        if (attempt.endsAt > 0 && Date.now() >= attempt.endsAt) {
          set({ inProgressAttempt: null, inProgressPaper: null });
          return;
        }
        const stored = await getPaper(attempt.paperId);
        set({
          inProgressAttempt: attempt,
          inProgressPaper: stored ? stored.data : null,
        });
      } else {
        set({ inProgressAttempt: null, inProgressPaper: null });
      }
    } catch (err) {
      console.warn('Failed checking in progress attempt:', err);
    }
  },

  addPaper: async (paper: Paper) => {
    await savePaper(paper);
    await get().loadPapers();
  },

  removePaper: async (id: string) => {
    await deletePaper(id);
    await get().loadPapers();
  },
}));

