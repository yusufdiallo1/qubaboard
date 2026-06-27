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

import type { ReactNode } from 'react';
import {
  AppStateContext,
  AppDispatchContext,
  useAppReducer,
  type AppState,
} from './store';

export type AppProviderProps = {
  children: ReactNode;
  /**
   * Optionally hydrate the store with a partial initial state (e.g. from
   * server-side data fetching before the first render).
   */
  seed?: Partial<AppState>;
};

export function AppProvider({ children, seed }: AppProviderProps) {
  const [state, dispatch] = useAppReducer(seed);

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
