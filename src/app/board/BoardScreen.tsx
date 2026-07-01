'use client';

import { useMemo, useState } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import { getT } from '@/lib/i18n';
import { BoardSkeleton } from '@/components/Skeletons';
import {
  localToday,
  fmtDate,
  roomStatus,
  statusColor,
  displayBooking,
  currentBooking,
  fullPhone,
} from '@/lib/helpers';
import type { Room, Booking } from '@/lib/types';

// ---------------------------------------------------------------------------
// Inline SVG icons (verbatim from reference/Quba-Room-Board.html const I)
// ---------------------------------------------------------------------------
const I = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeLinecap="round" />
    </svg>
  ),
  funnel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 5h18l-7 8v6l-4 2v-8z" strokeLinejoin="round" />
    </svg>
  ),
  chev: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrive: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  depart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 15V3M7 8l5-5 5 5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path
        d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.4L5 15.8 8.2 19l4.9-4.9a3.5 3.5 0 0 0 4.4-4.6l-2 2-2.1-2.1z"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Status color map (mirrors prototype SCOLOR — uses CSS vars from globals.css)
// ---------------------------------------------------------------------------
const SCOLOR: Record<string, string> = {
  empty: 'var(--free)',
  booked: 'var(--booked)',
  checkout: 'var(--checkout)',
  cleaning: 'var(--cleaning)',
  maintenance: 'var(--maint)',
};

// Filter order for dropdown
const FILTER_ORDER = [
  { k: 'all', icon: false },
  { k: 'empty', icon: false },
  { k: 'booked', icon: false },
  { k: 'checkout', icon: false },
  { k: 'cleaning', icon: false },
  { k: 'maintenance', icon: false },
  { k: 'arrivals', icon: true },
] as const;

// ---------------------------------------------------------------------------
// BoardScreen
// ---------------------------------------------------------------------------
export default function BoardScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { lang, view, filter, search, rooms, bookings, loading } = state;
  const t = getT(lang);
  const today = localToday();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function roomStatusLocal(r: Room): string {
    return roomStatus(r, bookings, today);
  }

  function roomHasIssue(r: Room): boolean {
    return r.override === 'maintenance';
  }

  function getDisplayBooking(r: Room): Booking | null {
    return displayBooking(r.no, bookings, today);
  }

  // Count helper that mirrors prototype counts() — memoized
  const cnts = useMemo((): Record<string, number> => {
    const c: Record<string, number> = {
      all: rooms.length,
      empty: 0,
      booked: 0,
      checkout: 0,
      cleaning: 0,
      maintenance: 0,
      arrivals: 0,
    };
    rooms.forEach(r => {
      const st = roomStatusLocal(r);
      c[st] = (c[st] || 0) + 1;
      if (bookings.some(b => b.room_no === r.no && !b.checked_out && b.check_in === today)) {
        c.arrivals++;
      }
    });
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, bookings, today]);

  // Occupancy helper — memoized
  const occ = useMemo(() => {
    const inHouse = rooms.filter(r => {
      const s = roomStatusLocal(r);
      return s === 'booked' || s === 'checkout';
    }).length;
    const total = rooms.length;
    const pct = total > 0 ? Math.round((inHouse / total) * 100) : 0;
    return { inHouse, total, pct };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, bookings, today]);

  // Visible rooms after filter + search — memoized
  const visible = useMemo((): Room[] => {
    const q = search.trim().toLowerCase();
    const f = filter;
    return rooms.filter(r => {
      const st = roomStatusLocal(r);
      if (f === 'checkout') {
        if (st !== 'checkout') return false;
      } else if (f === 'arrivals') {
        if (!bookings.some(b => b.room_no === r.no && !b.checked_out && b.check_in === today))
          return false;
      } else if (f === 'booked') {
        if (st !== 'booked') return false;
      } else if (f !== 'all') {
        if (st !== f) return false;
      }
      if (q) {
        const g = getDisplayBooking(r);
        const inName = g && g.guest_name.toLowerCase().includes(q);
        if (!inName && !String(r.no).includes(q)) return false;
      }
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, bookings, today, filter, search]);

  if (loading && rooms.length === 0) {
    return <BoardSkeleton count={8} />;
  }

  // Description helper (show in active language if cached, else fall back to original)
  function descFor(r: Room): string {
    if (!r.description) return '';
    const cached = r.description_tr?.[lang];
    if (cached) return cached;
    return r.description;
  }

  // ---------------------------------------------------------------------------
  // Open sheet action
  // ---------------------------------------------------------------------------
  function openSheet(roomNo: number) {
    dispatch({ type: 'OPEN_SHEET', payload: { roomNo, from: 'board' } });
  }

  // ---------------------------------------------------------------------------
  // Tile view (grid card)
  // ---------------------------------------------------------------------------
  function TileView({ r }: { r: Room }) {
    const ds = roomStatusLocal(r) as string;
    const color = SCOLOR[ds] ?? 'var(--faint)';
    const g = getDisplayBooking(r);
    const hasIssue = roomHasIssue(r);
    const desc = descFor(r);
    const hasPhoto = !!r.photo_url;

    return (
      <button
        className={`tile st-${ds}${hasPhoto ? ' has-photo' : ''}`}
        onClick={() => openSheet(r.no)}
        style={{ '--sc': color } as React.CSSProperties}
        aria-label={`${t('roomWord')} ${r.no}`}
      >
        {hasPhoto && (
          <div
            className="tile-photo"
            style={{ backgroundImage: `url('${r.photo_url}')` }}
          />
        )}
        <div className="tile-inner">
          <div className="tile-head">
            <div className="rnum">
              <span className="rlabel">{t('roomWord')}</span>
              <b>{r.no}</b>
            </div>
            <div className="th-right">
              {hasIssue && (
                <span
                  className="wrench"
                  title={r.issue || t('issueBadge')}
                >
                  {I.wrench}
                </span>
              )}
              <span className="spill">
                <i className="d" />
                {t(ds as Parameters<typeof t>[0])}
              </span>
            </div>
          </div>

          <div className="tile-body">
            {g ? (
              <>
                <div className="gname">{g.guest_name}</div>
                <div className="gphone">{fullPhone(g.cc, g.phone)}</div>
              </>
            ) : (
              <div className="gname empty">{t(ds as Parameters<typeof t>[0])}</div>
            )}
            {desc && <div className="tile-desc">{desc}</div>}
          </div>

          {g && (
            <div className="tile-foot">
              <div className={'dline' + (g.check_in === today ? ' hot' : '')}>
                {I.arrive}
                <span className="k">{t('checkIn')}</span>
                <b>{fmtDate(g.check_in, lang)}</b>
              </div>
              <div className={'dline' + (g.check_out === today ? ' hot' : '')}>
                {I.depart}
                <span className="k">{t('checkOut')}</span>
                <b>{fmtDate(g.check_out, lang)}</b>
              </div>
            </div>
          )}
        </div>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Row view (list row)
  // ---------------------------------------------------------------------------
  function RowView({ r }: { r: Room }) {
    const ds = roomStatusLocal(r) as string;
    const color = SCOLOR[ds] ?? 'var(--faint)';
    const g = getDisplayBooking(r);
    const hasIssue = roomHasIssue(r);
    const desc = descFor(r);
    const hasPhoto = !!r.photo_url;

    return (
      <button
        className={'row' + (hasPhoto ? ' has-thumb' : '')}
        onClick={() => openSheet(r.no)}
        style={{ '--sc': color } as React.CSSProperties}
        aria-label={`${t('roomWord')} ${r.no}`}
      >
        {hasPhoto && (
          <span
            className="r-thumb"
            style={{ backgroundImage: `url('${r.photo_url}')` }}
          />
        )}

        <span className="r-no">
          <i>{t('roomWord')}</i>
          <b>{r.no}</b>
        </span>

        <span className="r-mid">
          {g ? (
            <>
              <b className="gn">{g.guest_name}</b>
              <i className="ph">{fullPhone(g.cc, g.phone)}</i>
            </>
          ) : (
            <b className={'gn empty'}>{t(ds as Parameters<typeof t>[0])}</b>
          )}
          {desc && <i className="r-desc">{desc}</i>}
        </span>

        {g && (
          <div className="r-dates">
            <div className={'dt' + (g.check_in === today ? ' hot' : '')}>
              <i>{t('checkIn')}</i>
              <b>{fmtDate(g.check_in, lang)}</b>
            </div>
            <div className={'dt' + (g.check_out === today ? ' hot' : '')}>
              <i>{t('checkOut')}</i>
              <b>{fmtDate(g.check_out, lang)}</b>
            </div>
          </div>
        )}

        {hasIssue && (
          <span className="wrench" title={r.issue || t('issueBadge')}>
            {I.wrench}
          </span>
        )}

        <span className="spill">
          <i className="d" />
          {t(ds as Parameters<typeof t>[0])}
        </span>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Occupancy bar */}
      <div className="topline">
        <div className="occ">
          <div className="occ-h">
            <b>{occ.inHouse}</b>
            <span className="of">
              {t('of')} {occ.total}
            </span>
            <span className="lab">{t('occupied_lab')}</span>
          </div>
          <div className="bar">
            <i style={{ width: `${occ.pct}%` }} />
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--info)', whiteSpace: 'nowrap' }}>
          {cnts.arrivals} {t('arrivals')}
        </div>
      </div>

      {/* Search + view toggle row */}
      <div className="ctrlrow">
        <div className="search">
          {I.search}
          <input
            type="text"
            value={search}
            placeholder={t('search')}
            onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            aria-label={t('search')}
          />
        </div>

        <div className="vtoggle">
          <button
            className={'vt' + (view === 'grid' ? ' on' : '')}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'grid' })}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            {I.grid}
          </button>
          <button
            className={'vt' + (view === 'list' ? ' on' : '')}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'list' })}
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            {I.list}
          </button>
        </div>
      </div>

      {/* Filter chips — horizontal scroll strip, Apple/Resend style */}
      <div className="fchips">
        {FILTER_ORDER.map(({ k, icon }) => {
          const isActive = filter === k;
          const color = icon || k === 'all' ? undefined : SCOLOR[k];
          return (
            <button
              key={k}
              className={'fchip' + (isActive ? ' on' : '')}
              style={color ? { '--fc': color } as React.CSSProperties : undefined}
              onClick={() => dispatch({ type: 'SET_FILTER', payload: k })}
            >
              {color && <i className="fcdot" />}
              {icon && <span className="fcicon">{I.arrive}</span>}
              {k === 'all' && !color && !icon && <span className="fcicon">{I.grid}</span>}
              <span>{t(k as Parameters<typeof t>[0])}</span>
              <span className="fcct">{cnts[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Room grid or list */}
      {visible.length === 0 ? (
        <div className="grid">
          <div className="empty-state">
            {I.search}
            <p>{t('noMatch')}</p>
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid in">
          {visible.map(r => (
            <TileView key={r.no} r={r} />
          ))}
        </div>
      ) : (
        <div className="rows in">
          {visible.map(r => (
            <RowView key={r.no} r={r} />
          ))}
        </div>
      )}
    </>
  );
}
