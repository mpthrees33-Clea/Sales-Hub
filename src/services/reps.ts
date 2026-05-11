import { useAppStore } from '../store/useAppStore';
import type { Rep, SalesLocation } from '../types';

// Reps service. Reads + writes the current rep context. Components should
// resolve `currentRep` through this module instead of touching the store
// directly so the eventual backend swap is one place.

export const reps = {
  list(): Rep[] {
    return useAppStore.getState().reps;
  },
  get(id: string): Rep | undefined {
    return useAppStore.getState().reps.find((r) => r.id === id);
  },
  current(): Rep {
    const s = useAppStore.getState();
    const r = s.reps.find((x) => x.id === s.currentRepId);
    // Fallback to first rep if the persisted currentRepId is stale.
    return r ?? s.reps[0];
  },
  setCurrent(id: string): void {
    useAppStore.getState().setCurrentRepId(id);
  },
};

export const salesLocations = {
  list(): SalesLocation[] {
    return useAppStore.getState().salesLocations;
  },
  get(id: string): SalesLocation | undefined {
    return useAppStore.getState().salesLocations.find((l) => l.id === id);
  },
};
