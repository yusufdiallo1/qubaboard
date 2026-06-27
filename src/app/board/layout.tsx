import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ReactNode } from 'react';

/**
 * Board layout — server-side auth guard.
 * If no valid Supabase session is found, redirect to /login immediately.
 * This runs on the server before any client bundle is sent.
 */
export default async function BoardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return <>{children}</>;
}
