import { create } from "zustand";

type IndexUpdate = number | ((current: number) => number);

type ReplayState = {
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 4 | 8;
  setCurrentIndex: (next: IndexUpdate, maxIndex?: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: 1 | 2 | 4 | 8) => void;
  step: (direction: -1 | 1, maxIndex: number) => void;
  reset: (index?: number) => void;
};

/**
 * State for progressively revealing a fictional OHLC dataset.
 * This store intentionally contains no order, position, account, or execution state.
 */
export const useReplayStore = create<ReplayState>((set) => ({
  currentIndex: 89,
  isPlaying: false,
  playbackSpeed: 1,
  setCurrentIndex: (next, maxIndex = Number.MAX_SAFE_INTEGER) =>
    set((state) => {
      const value = typeof next === "function" ? next(state.currentIndex) : next;
      return { currentIndex: Math.max(0, Math.min(maxIndex, Math.floor(value))) };
    }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  step: (direction, maxIndex) =>
    set((state) => ({
      currentIndex: Math.max(0, Math.min(maxIndex, state.currentIndex + direction)),
      isPlaying: false,
    })),
  reset: (index = 0) => set({ currentIndex: Math.max(0, index), isPlaying: false }),
}));
