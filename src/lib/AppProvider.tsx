'use client';

/**
 * AppProvider — the React component wrapper for the global store.
 *
 * This file is .tsx so it can contain JSX.  Everything else (state, reducer,
 * hooks, contexts, action types) lives in store.ts.
 *
 * Usage:
 *   import { AppProvider } from '@/lib/AppProvider';
 *   // or import from store.ts for non-JSX needs
 */

import { useEffect, type ReactNode } from 'react';
import {
  AppStateContext,
  AppDispatchContext,
  useAppReducer,
  type AppState,
} from './store';

/** Read timeline page state from localStorage and compute tlChunk from today. */
function getSeed(): Partial<AppState> {
  const seed: Partial<AppState> = {};

  if (typeof window === 'undefined') return seed;

  // Restore language + theme (already done elsewhere, but harmless to include)
  const storedLang = localStorage.getItem('quba-lang');
  if (storedLang === 'ar' || storedLang === 'en') seed.lang = storedLang;

  const storedTheme = localStorage.getItem('quba-theme');
  if (storedTheme === 'light' || storedTheme === 'dark') seed.theme = storedTheme;

  // Timeline month offset
  const storedMonth = localStorage.getItem('quba-tl-month');
  if (storedMonth !== null) {
    const parsed = parseInt(storedMonth, 10);
    if (!isNaN(parsed)) seed.tlMonthOffset = parsed;
  }

  // Timeline chunk — if stored, use it; otherwise derive from today's day
  const storedChunk = localStorage.getItem('quba-tl-chunk');
  if (storedChunk !== null) {
    const parsed = parseInt(storedChunk, 10);
    if (parsed === 0 || parsed === 1 || parsed === 2) {
      seed.tlChunk = parsed;
    }
  } else {
    // Default: show the chunk that contains today
    const todayDay = new Date().getDate();
    seed.tlChunk = todayDay <= 10 ? 0 : todayDay <= 20 ? 1 : 2;
  }

  return seed;
}

export type AppProviderProps = {
  children: ReactNode;
  /**
   * Optionally hydrate the store with a partial initial state (e.g. from
   * server-side data fetching before the first render).
   */
  seed?: Partial<AppState>;
};

export function AppProvider({ children, seed }: AppProviderProps) {
  // Merge caller seed with localStorage seed (caller seed wins on conflicts)
  const localSeed = getSeed();
  const [state, dispatch] = useAppReducer({ ...localSeed, ...seed });

  // Persist timeline page state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('quba-tl-month', String(state.tlMonthOffset));
      localStorage.setItem('quba-tl-chunk', String(state.tlChunk));
    } catch {
      // localStorage may be unavailable in some environments — ignore
    }
  }, [state.tlMonthOffset, state.tlChunk]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

// Re-export everything from store so consumers only need one import
export {
  appReducer,
  initialState,
  useAppState,
  useAppDispatch,
  useAppReducer,
  AppStateContext,
  AppDispatchContext,
} from './store';
export type {
  AppState,
  AppAction,
} from './store';
