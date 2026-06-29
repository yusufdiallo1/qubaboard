'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppProvider as StoreProvider } from '@/lib/AppProvider';
import { useAppState, useAppDispatch } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { useSupabaseData } from '@/lib/useSupabase';
import ServiceWorker from '@/components/ServiceWorker';

// Inner component — must be inside StoreProvider to access store hooks
function AppBootstrap({ children }: { children: ReactNode }) {
  const S = useAppState();
  const dispatch = useAppDispatch();
  const router = useRouter();

  // Wire Supabase realtime
  useSupabaseData();

  // Restore persisted preferences from localStorage after first client render
  useEffect(() => {
    try {
      const lang = localStorage.getItem('quba-lang') as 'ar' | 'en' | null;
      const theme = localStorage.getItem('quba-theme') as 'light' | 'dark' | null;
      const rawPage = localStorage.getItem('quba-page') ?? 'board';
      const rawView = localStorage.getItem('quba-view') ?? 'grid';
      const VALID_PAGES = new Set(['board', 'timeline', 'overview', 'rooms', 'employees']);
      const VALID_VIEWS = new Set(['grid', 'list']);
      if (lang) dispatch({ type: 'SET_LANG', payload: lang });
      if (theme) dispatch({ type: 'SET_THEME', payload: theme });
      if (VALID_PAGES.has(rawPage)) dispatch({ type: 'SET_PAGE', payload: rawPage as 'board' | 'timeline' | 'overview' | 'rooms' | 'employees' });
      if (VALID_VIEWS.has(rawView)) dispatch({ type: 'SET_VIEW', payload: rawView as 'grid' | 'list' });
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user profile (non-blocking — render immediately, populate async)
  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      // Use getSession() first — reads from localStorage, no network round-trip.
      // Then fire getUser() in the background to validate with Supabase server.
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        router.replace('/login');
        return;
      }

      // Fetch profile and validate token concurrently
      const [profileRes] = await Promise.all([
        supabase.from('profiles').select('id, name, role').eq('id', userId).single(),
        supabase.auth.getUser(), // background server validation — result unused here
      ]);

      const profile = profileRes.data;
      if (!profile) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      const username = (session.user.email ?? '').split('@')[0];
      dispatch({
        type: 'SET_USER',
        payload: {
          id: profile.id as string,
          name: profile.name as string,
          role: profile.role as 'admin' | 'staff',
          username,
        },
      });
    }

    loadUser();

    // Handle sign-out events from other tabs
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'SIGN_OUT' });
        router.replace('/login');
      }
    });

    return () => { subscription.unsubscribe(); };
  }, [dispatch, router]);

  // Apply lang/theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', S.lang);
    root.setAttribute('dir', S.lang === 'ar' ? 'rtl' : 'ltr');
    if (S.theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [S.lang, S.theme]);

  // Persist preferences, page and view
  useEffect(() => {
    try { localStorage.setItem('quba-lang', S.lang); } catch { /* ignore */ }
  }, [S.lang]);

  useEffect(() => {
    try { localStorage.setItem('quba-theme', S.theme); } catch { /* ignore */ }
  }, [S.theme]);

  useEffect(() => {
    try { localStorage.setItem('quba-page', S.page); } catch { /* ignore */ }
  }, [S.page]);

  useEffect(() => {
    try { localStorage.setItem('quba-view', S.view); } catch { /* ignore */ }
  }, [S.view]);

  return <>{children}</>;
}

const VALID_PAGES = new Set(['board', 'timeline', 'overview', 'rooms', 'employees']);
const VALID_VIEWS = new Set(['grid', 'list']);

function getSeed(): { lang: 'ar' | 'en'; theme: 'light' | 'dark'; page: 'board' | 'timeline' | 'overview' | 'rooms' | 'employees'; view: 'grid' | 'list' } {
  if (typeof window === 'undefined') return { lang: 'ar', theme: 'light', page: 'board', view: 'grid' };
  try {
    const lang = (localStorage.getItem('quba-lang') ?? 'ar') as 'ar' | 'en';
    const theme = (localStorage.getItem('quba-theme') ?? 'light') as 'light' | 'dark';
    const rawPage = localStorage.getItem('quba-page') ?? 'board';
    const rawView = localStorage.getItem('quba-view') ?? 'grid';
    const page = VALID_PAGES.has(rawPage) ? rawPage as 'board' | 'timeline' | 'overview' | 'rooms' | 'employees' : 'board';
    const view = VALID_VIEWS.has(rawView) ? rawView as 'grid' | 'list' : 'grid';
    return { lang, theme, page, view };
  } catch {
    return { lang: 'ar', theme: 'light', page: 'board', view: 'grid' };
  }
}

export default function AppProvider({ children }: { children: ReactNode }) {
  // Always use safe defaults for SSR — localStorage is read in AppBootstrap after mount
  const seed = { lang: 'ar' as const, theme: 'light' as const, page: 'board' as const, view: 'grid' as const };
  return (
    <StoreProvider seed={seed}>
      <ServiceWorker />
      <AppBootstrap>{children}</AppBootstrap>
    </StoreProvider>
  );
}
