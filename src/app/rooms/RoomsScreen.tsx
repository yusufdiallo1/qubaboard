'use client';

import { useAppState, useAppDispatch } from '@/lib/store';
import { getT } from '@/lib/i18n';
import { localToday, roomStatus, statusColor, currentBooking } from '@/lib/helpers';
import type { Room } from '@/lib/types';

// ---------------------------------------------------------------------------
// Inline SVG icons (verbatim from reference/Quba-Room-Board.html const I)
// ---------------------------------------------------------------------------
const I = {
  bed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 20v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 14v-4a2 2 0 0 1 2-2h5v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8h6a2 2 0 0 1 2 2v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 20h20" strokeLinecap="round" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// Status color map — matches prototype SCOLOR
const SCOLOR: Record<string, string> = {
  empty: 'var(--free)',
  booked: 'var(--booked)',
  checkout: 'var(--checkout)',
  cleaning: 'var(--cleaning)',
  maintenance: 'var(--maint)',
};

// ---------------------------------------------------------------------------
// RoomsScreen — admin-only, shows all 20 rooms grouped by floor
// ---------------------------------------------------------------------------
export default function RoomsScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { lang, rooms, bookings } = state;
  const t = getT(lang);
  const today = localToday();

  // Partition rooms by floor
  const floor1 = rooms.filter(r => r.floor === 1).sort((a, b) => a.no - b.no);
  const floor2 = rooms.filter(r => r.floor === 2).sort((a, b) => a.no - b.no);

  // ---------------------------------------------------------------------------
  // Open sheet with from="rooms" so the sheet shows the room editor section
  // ---------------------------------------------------------------------------
  function openSheet(roomNo: number) {
    dispatch({ type: 'OPEN_SHEET', payload: { roomNo, from: 'rooms' } });
  }

  // ---------------------------------------------------------------------------
  // Description to display in active language (use cached translation if present)
  // ---------------------------------------------------------------------------
  function descFor(r: Room): string {
    if (!r.description) return '';
    const cached = r.description_tr?.[lang];
    if (cached) return cached;
    return r.description;
  }

  // ---------------------------------------------------------------------------
  // Single room card
  // ---------------------------------------------------------------------------
  function RpCard({ r }: { r: Room }) {
    const st = roomStatus(r, bookings, today);
    const color = SCOLOR[st] ?? 'var(--faint)';
    const cur = currentBooking(r.no, bookings, today);
    // Show guest line when room is booked or checkout and there is a current booking
    const showGuest = (st === 'booked' || st === 'checkout') && !!cur;
    const desc = descFor(r);
    const hasPhoto = !!r.photo_url;

    return (
      <button
        className="rp-card"
        onClick={() => openSheet(r.no)}
        aria-label={`${t('roomWord')} ${r.no}`}
      >
        {/* Photo strip — or empty bed icon placeholder */}
        {hasPhoto ? (
          <div
            className="rp-photo"
            style={{ backgroundImage: `url('${r.photo_url}')` }}
          />
        ) : (
          <div className="rp-photo empty">
            {I.bed}
          </div>
        )}

        {/* Card body */}
        <div className="rp-body">
          {/* Top row: room name + status pill */}
          <div className="rp-top">
            <b>{t('roomWord')} {r.no}</b>
            <span
              className="spill"
              style={{ '--sc': color } as React.CSSProperties}
            >
              <i className="d" />
              {t(st as Parameters<typeof t>[0])}
            </span>
          </div>

          {/* Description line */}
          <div className="rp-desc">
            {desc
              ? desc
              : <i>{t('noDescription')}</i>
            }
          </div>

          {/* Guest line — only when booked/checkout with an active guest */}
          {showGuest && cur && (
            <div className="rp-guest">
              {I.user}
              <span>{cur.guest_name}</span>
            </div>
          )}
        </div>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Floor section helper
  // ---------------------------------------------------------------------------
  function FloorSection({ label, floorRooms }: { label: string; floorRooms: Room[] }) {
    return (
      <>
        <div className="floor-h">{label}</div>
        <div className="rp-grid">
          {floorRooms.map(r => (
            <RpCard key={r.no} r={r} />
          ))}
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* Page heading */}
      <div className="page-h">{t('nav_rooms')}</div>
      <div className="page-sub">{t('roomsSub')}</div>

      {/* Floor 1 — rooms 1–10 */}
      <FloorSection label={t('floor1')} floorRooms={floor1} />

      {/* Floor 2 — rooms 11–20 */}
      <FloorSection label={t('floor2')} floorRooms={floor2} />
    </>
  );
}
