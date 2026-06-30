'use client';

/**
 * AppShell — main layout rendered after login.
 * Matches reference/Quba-Room-Board.html exactly:
 * topbar, sidenav, mobile drawer, profile menu, booking sheet, toast.
 *
 * CSS classes only — no Tailwind inline styles.
 * All icons are verbatim from the prototype's const I.
 */

import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import { getT } from '@/lib/i18n';
import { localToday, fmtDateLong } from '@/lib/helpers';
import { createClient } from '@/lib/supabase/client';
import { savePreferences } from '@/lib/supabaseActions';

import BoardScreen    from '@/app/board/BoardScreen';
import TimelineScreen from '@/app/timeline/TimelineScreen';
import OverviewScreen from '@/app/overview/OverviewScreen';
import RoomsScreen    from '@/app/rooms/RoomsScreen';
import EmployeesScreen from '@/app/employees/EmployeesScreen';
import VillaScreen    from '@/app/villa/VillaScreen';
import AptScreen      from '@/app/apt/AptScreen';
import BookingSheet   from '@/components/BookingSheet';
import ToastStack     from '@/components/ToastStack';
import CommandPalette from '@/components/CommandPalette';
import OfflineBanner  from '@/components/OfflineBanner';

// ─────────────────────────────────────────────────────────────────────────────
// SVG icon set — verbatim from reference prototype const I
// ─────────────────────────────────────────────────────────────────────────────
const I = {
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
  hamburger: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  ),
  chevDown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M3 12h18" strokeLinecap="round" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  signOut: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <path d="M7 14h4M7 17h8" strokeLinecap="round" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  rooms: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  villa: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22V10L12 3l10 7v12H2z" />
      <path d="M9 22v-7h6v7" />
      <path d="M5 22v-5h3v5M16 22v-5h3v5" />
    </svg>
  ),
  apt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="19" rx="2" />
      <path d="M2 9h20" />
      <path d="M9 3v18M15 3v18" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Nav item definition
// ─────────────────────────────────────────────────────────────────────────────
type NavDef = {
  id: 'board' | 'timeline' | 'overview' | 'rooms' | 'employees' | 'villa' | 'apt';
  labelKey: 'nav_board' | 'nav_timeline' | 'nav_overview' | 'nav_rooms' | 'nav_employees' | 'nav_villa' | 'nav_apt';
  icon: React.ReactNode;
  adminOnly?: boolean;
};

// Catches render errors in any screen so the shell stays alive
class ScreenErrorBoundary extends Component<{ children: ReactNode; page: string }, { err: string | null }> {
  constructor(props: { children: ReactNode; page: string }) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  componentDidUpdate(prev: { page: string }) {
    if (prev.page !== this.props.page && this.state.err) this.setState({ err: null });
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 32, color: 'var(--text)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <pre style={{ fontSize: 11, color: 'var(--faint)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.err}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV_ITEMS: NavDef[] = [
  { id: 'board',     labelKey: 'nav_board',     icon: I.board },
  { id: 'timeline',  labelKey: 'nav_timeline',   icon: I.timeline },
  { id: 'overview',  labelKey: 'nav_overview',   icon: I.chart },
  { id: 'villa',     labelKey: 'nav_villa',      icon: I.villa },
  { id: 'apt',       labelKey: 'nav_apt',        icon: I.apt },
  { id: 'rooms',     labelKey: 'nav_rooms',      icon: I.rooms,     adminOnly: true },
  { id: 'employees', labelKey: 'nav_employees',  icon: I.users,     adminOnly: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// AppShell
// ─────────────────────────────────────────────────────────────────────────────
export default function AppShell() {
  const S = useAppState();
  const dispatch = useAppDispatch();
  const t = getT(S.lang);
  const rtColor = S.realtimeStatus === 'ok' ? 'var(--free)' : S.realtimeStatus === 'error' ? 'var(--maint)' : 'var(--faint)';

  const today = localToday();
  const isAdmin = S.user?.role === 'admin';

  // mounted guard — suppress splash during SSR to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    if (S.user) {
      // Small delay so the fade-out animation completes
      const t = setTimeout(() => setSplashVisible(false), 320);
      return () => clearTimeout(t);
    }
  }, [S.user, mounted]);

  // Local toast (for tracker link notification)
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }

  // Close menu when clicking outside
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!S.menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dispatch({ type: 'SET_MENU_OPEN', payload: false });
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [S.menuOpen, dispatch]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [S.page]);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    dispatch({ type: 'SET_MENU_OPEN', payload: false });
    const supabase = createClient();
    await supabase.auth.signOut();
    dispatch({ type: 'SIGN_OUT' });
    window.location.href = '/login';
  }, [dispatch]);

  // Language toggle — persists to DB
  const handleLangToggle = useCallback(() => {
    const newLang = S.lang === 'ar' ? 'en' : 'ar';
    dispatch({ type: 'SET_LANG', payload: newLang });
    dispatch({ type: 'SET_MENU_OPEN', payload: false });
    if (S.user?.id) savePreferences(S.user.id, newLang, S.theme);
  }, [S.lang, S.theme, S.user, dispatch]);

  // Theme toggle — persists to DB
  const handleThemeToggle = useCallback(() => {
    const newTheme = S.theme === 'light' ? 'dark' : 'light';
    dispatch({ type: 'SET_THEME', payload: newTheme });
    dispatch({ type: 'SET_MENU_OPEN', payload: false });
    if (S.user?.id) savePreferences(S.user.id, S.lang, newTheme);
  }, [S.theme, S.lang, S.user, dispatch]);

  // Nav navigate
  const handleNav = useCallback((page: typeof S.page) => {
    dispatch({ type: 'SET_PAGE', payload: page });
    dispatch({ type: 'SET_DRAWER_OPEN', payload: false });
    dispatch({ type: 'SET_MENU_OPEN', payload: false });
  }, [dispatch]);

  // Profile chip initial
  const initial = S.user?.name ? S.user.name[0].toUpperCase() : '?';
  const roleLabel = S.user?.role === 'admin' ? t('role_admin') : t('role_staff');

  // Visible nav items
  const visibleNav = NAV_ITEMS.filter(n => !n.adminOnly || isAdmin);

  // Page content
  function renderScreen() {
    switch (S.page) {
      case 'board':     return <BoardScreen />;
      case 'timeline':  return <TimelineScreen />;
      case 'overview':  return <OverviewScreen />;
      case 'villa':     return <VillaScreen />;
      case 'apt':       return <AptScreen />;
      case 'rooms':     return isAdmin ? <RoomsScreen /> : <BoardScreen />;
      case 'employees': return isAdmin ? <EmployeesScreen /> : <BoardScreen />;
      default:          return <BoardScreen />;
    }
  }

  return (
    <>
      {/* ──────────────── SPLASH SCREEN (blocks flash of wrong theme/lang) ──────────────── */}
      {mounted && splashVisible && (
        <div className={`app-splash${S.user ? ' app-splash--out' : ''}`} aria-hidden="true">
          <div className="app-splash-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={64} height={64} className="app-splash-logo" />
            <div className="app-splash-wordmark">Quba</div>
            <div className="app-splash-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TOPBAR ──────────────── */}
      <header className="topbar">
        {/* Hamburger — mobile only, LEFT side before brand */}
        <button
          className="iconbtn hamburger"
          onClick={() => dispatch({ type: 'SET_DRAWER_OPEN', payload: !S.drawerOpen })}
          aria-label="Menu"
          data-act="toggle-drawer"
        >
          {I.hamburger}
        </button>

        {/* Brand */}
        <button
          className="brand"
          onClick={() => handleNav('board')}
          aria-label={t('appName')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Quba logo" width={34} height={34} />
          <span className="nm">
            <b>{t('appName')}</b>
            <span>{t('appSub')}</span>
          </span>
        </button>

        <div className="tb-spacer" />

        {/* Date pill — suppressHydrationWarning because localToday() differs server/client timezone */}
        <div className="datepill" suppressHydrationWarning>
          <span style={{ color: 'var(--gold-deep)', display: 'grid', placeItems: 'center', width: 15, height: 15 }}>
            {I.calendar}
          </span>
          <span suppressHydrationWarning>{fmtDateLong(today, S.lang)}</span>
          {/* Realtime connection status dot */}
          <span
            suppressHydrationWarning
            title={S.realtimeStatus === 'ok' ? 'Live' : S.realtimeStatus === 'error' ? 'Disconnected' : 'Connecting…'}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: rtColor,
              display: 'inline-block',
              flexShrink: 0,
              transition: 'background .5s',
              boxShadow: S.realtimeStatus === 'ok' ? '0 0 0 2px color-mix(in srgb,var(--free) 28%,transparent)' : 'none',
            }}
          />
        </div>

        {/* Profile chip */}
        <div className="pwrap" ref={menuRef}>
          <button
            className={`pchip${S.menuOpen ? ' open' : ''}`}
            onClick={() => dispatch({ type: 'SET_MENU_OPEN', payload: !S.menuOpen })}
            aria-label={S.user?.name ?? 'Profile'}
          >
            <span className="av">{initial}</span>
            <span className="pinfo">
              <span className="pn">{S.user?.name ?? '—'}</span>
              <span className="pr">{roleLabel}</span>
            </span>
            <span className="pchev">{I.chevDown}</span>
          </button>

          {/* Profile dropdown menu */}
          {S.menuOpen && (
            <div className="menu pmenu" role="menu">
              {/* Header */}
              <div className="pmhead">
                <span className="av" style={{ width: 38, height: 38, fontSize: 15 }}>{initial}</span>
                <div>
                  <b>{S.user?.name ?? '—'}</b>
                  <span>{roleLabel}</span>
                </div>
              </div>

              {/* Language toggle */}
              <button className="mitem" onClick={handleLangToggle} role="menuitem">
                <span className="mi">{I.globe}</span>
                <span>{t('langLabel')}</span>
                <span className="ct">{S.lang === 'ar' ? 'العربية' : 'English'}</span>
              </button>

              {/* Theme toggle */}
              <button className="mitem" onClick={handleThemeToggle} role="menuitem">
                <span className="mi">{S.theme === 'light' ? I.moon : I.sun}</span>
                <span>{t('themeLabel')}</span>
                <span className="ct">{S.theme === 'light' ? t('darkMode') : t('lightMode')}</span>
              </button>

              <div className="mdiv" />

              {/* Sign out */}
              <button className="mitem danger" onClick={handleSignOut} role="menuitem">
                <span className="mi">{I.signOut}</span>
                <span>{t('signOut')}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ──────────────── MOBILE DRAWER ──────────────── */}
      <div
        className={`drawer-back${S.drawerOpen ? ' open' : ''}`}
        onClick={() => dispatch({ type: 'SET_DRAWER_OPEN', payload: false })}
        aria-hidden="true"
      />
      <nav className={`drawer${S.drawerOpen ? ' open' : ''}`} aria-label="Navigation drawer">
        <div className="drawer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Quba logo" width={32} height={32} />
          <b>{t('appName')}</b>
        </div>
        {visibleNav.map(n => (
          <button
            key={n.id}
            className={`navitem${S.page === n.id ? ' on' : ''}`}
            onClick={() => handleNav(n.id)}
          >
            {n.icon}
            {t(n.labelKey)}
          </button>
        ))}
      </nav>

      {/* ──────────────── MAIN LAYOUT ──────────────── */}
      <div className="layout">
        {/* Desktop sidenav */}
        <nav className="sidenav" aria-label="Main navigation">
          {visibleNav.map(n => (
            <button
              key={n.id}
              className={`navitem${S.page === n.id ? ' on' : ''}`}
              onClick={() => handleNav(n.id)}
            >
              {n.icon}
              {t(n.labelKey)}
            </button>
          ))}
        </nav>

        {/* Page content */}
        <main className="content animate-fade-in-up" key={S.page}>
          <ScreenErrorBoundary page={S.page}>
            {renderScreen()}
          </ScreenErrorBoundary>
        </main>
      </div>

      {/* ──────────────── MOBILE BOTTOM TAB BAR ──────────────── */}
      <nav className="bottomnav" aria-label="Bottom navigation">
        {visibleNav.map(n => (
          <button
            key={n.id}
            className={`btab${S.page === n.id ? ' on' : ''}`}
            onClick={() => handleNav(n.id)}
            aria-label={t(n.labelKey)}
          >
            <span className="btab-icon">{n.icon}</span>
            <span className="btab-label">{t(n.labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* ──────────────── BOOKING SHEET ──────────────── */}
      {S.open !== null && <BookingSheet />}

      {/* ──────────────── TOAST (legacy local) ──────────────── */}
      <div className={`toast${toastVisible ? ' show' : ''}`} aria-live="polite">
        {toastMsg}
      </div>

      {/* ──────────────── GLOBAL TOAST STACK ──────────────── */}
      <ToastStack />

      {/* ──────────────── COMMAND PALETTE ──────────────── */}
      <CommandPalette />

      {/* ──────────────── OFFLINE BANNER ──────────────── */}
      <OfflineBanner />
    </>
  );
}
