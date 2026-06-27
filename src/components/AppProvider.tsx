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

  // Load user profile (non-blocking — render immediately, populate async)
  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      // getUser() hits Supabase directly and works with SSR cookies
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', user.id)
        .single();

      if (!profile) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      const username = (user.email ?? '').split('@')[0];
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

  // Persist preferences
  useEffect(() => {
    try { localStorage.setItem('quba-lang', S.lang); } catch { /* ignore */ }
  }, [S.lang]);

  useEffect(() => {
    try { localStorage.setItem('quba-theme', S.theme); } catch { /* ignore */ }
  }, [S.theme]);

  return <>{children}</>;
}

function getSeed(): { lang: 'ar' | 'en'; theme: 'light' | 'dark' } {
  if (typeof window === 'undefined') return { lang: 'ar', theme: 'light' };
  try {
    const lang = (localStorage.getItem('quba-lang') ?? 'ar') as 'ar' | 'en';
    const theme = (localStorage.getItem('quba-theme') ?? 'light') as 'light' | 'dark';
    return { lang, theme };
  } catch {
    return { lang: 'ar', theme: 'light' };
  }
}

export default function AppProvider({ children }: { children: ReactNode }) {
  const seed = typeof window !== 'undefined' ? getSeed() : { lang: 'ar' as const, theme: 'light' as const };
  return (
    <StoreProvider seed={seed}>
      <ServiceWorker />
      <AppBootstrap>{children}</AppBootstrap>
    </StoreProvider>
  );
}
