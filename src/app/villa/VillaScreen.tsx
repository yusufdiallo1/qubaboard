'use client';

import { useAppState, useAppDispatch } from '@/lib/store';
import { getT } from '@/lib/i18n';
import { localToday, fmtDate, bookingPhase } from '@/lib/helpers';
import type { Booking } from '@/lib/types';

// Villa uses virtual room_no 21
const VILLA_ROOM_NO = 21;

const SCOLOR: Record<string, string> = {
  empty: 'var(--free)',
  booked: 'var(--booked)',
  checkout: 'var(--checkout)',
  cleaning: 'var(--cleaning)',
  maintenance: 'var(--maint)',
};

export default function VillaScreen() {
  const { lang, bookings } = useAppState();
  const dispatch = useAppDispatch();
  const t = getT(lang);
  const today = localToday();

  const villaBookings = bookings
    .filter((b) => b.room_no === VILLA_ROOM_NO && !b.checked_out)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));

  const current = villaBookings.find((b) => b.check_in <= today && b.check_out > today);
  const checkoutToday = villaBookings.find((b) => b.check_out === today);
  const upcoming = villaBookings.filter((b) => b.check_in > today);

  let ds = 'empty';
  if (checkoutToday) ds = 'checkout';
  else if (current) ds = 'booked';

  const color = SCOLOR[ds];
  const statusLabel = t(ds as Parameters<typeof t>[0]);
  const g = current || checkoutToday || null;

  function openSheet(bookingId?: string) {
    dispatch({
      type: 'OPEN_SHEET',
      payload: { roomNo: VILLA_ROOM_NO, from: 'board', ...(bookingId ? { bookingId } : {}) },
    });
  }

  function phaseLabel(b: Booking) {
    const p = bookingPhase(b, today);
    if (p === 'current') return lang === 'ar' ? 'حالي' : 'Current';
    if (p === 'past') return lang === 'ar' ? 'سابق' : 'Past';
    return lang === 'ar' ? 'قادم' : 'Upcoming';
  }

  return (
    <div>
      <h1 className="page-h">{lang === 'ar' ? 'الفيلا' : 'Villa'}</h1>
      <p className="page-sub">{lang === 'ar' ? 'إدارة حجوزات الفيلا' : 'Manage villa bookings'}</p>

      {/* Single-unit status tile — same style as board tiles */}
      <button
        className={`tile st-${ds} prop-tile`}
        onClick={() => openSheet()}
        style={{ '--sc': color } as React.CSSProperties}
        aria-label={lang === 'ar' ? 'الفيلا' : 'Villa'}
      >
        <div className="tile-inner">
          <div className="tile-head">
            <div className="rnum">
              <span className="rlabel">{lang === 'ar' ? 'عقار' : 'Property'}</span>
              <b>{lang === 'ar' ? 'فيلا' : 'Villa'}</b>
            </div>
            <span className="spill">
              <i className="d" />
              {statusLabel}
            </span>
          </div>

          <div className="tile-body">
            {g ? (
              <>
                <div className="gname">{g.guest_name}</div>
                <div className="gphone">{g.phone}</div>
              </>
            ) : (
              <div className="gname empty">{lang === 'ar' ? 'متاحة' : 'Available'}</div>
            )}
          </div>

          {g && (
            <div className="tile-foot">
              <div className={'dline' + (g.check_in === today ? ' hot' : '')}>
                <span className="k">{lang === 'ar' ? 'وصول' : 'Check-in'}</span>
                <b>{fmtDate(g.check_in, lang)}</b>
              </div>
              <div className={'dline' + (g.check_out === today ? ' hot' : '')}>
                <span className="k">{lang === 'ar' ? 'مغادرة' : 'Check-out'}</span>
                <b>{fmtDate(g.check_out, lang)}</b>
              </div>
            </div>
          )}
        </div>
      </button>

      {/* Add booking button when empty */}
      {!g && (
        <button className="btn gold prop-add-btn" onClick={() => openSheet()}>
          + {lang === 'ar' ? 'إضافة حجز' : 'Add booking'}
        </button>
      )}

      {/* Booking list */}
      {villaBookings.length > 0 && (
        <>
          <div className="sec-l" style={{ marginTop: 28 }}>
            {lang === 'ar' ? 'الحجوزات' : 'Bookings'} ({villaBookings.length})
          </div>
          <div className="rows">
            {villaBookings.map((b) => (
              <div
                key={b.id}
                className="row"
                onClick={() => openSheet(b.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openSheet(b.id); }}
              >
                <div className="r-mid">
                  <b className="r-name">{b.guest_name}</b>
                  <span className="r-desc">{b.phone}</span>
                </div>
                <div className="r-dates">
                  <div className="dt">
                    <span className="dl">{lang === 'ar' ? 'وصول' : 'In'}</span>
                    <b>{fmtDate(b.check_in, lang)}</b>
                  </div>
                  <div className="dt">
                    <span className="dl">{lang === 'ar' ? 'خروج' : 'Out'}</span>
                    <b>{fmtDate(b.check_out, lang)}</b>
                  </div>
                </div>
                <span className={`spill ${bookingPhase(b, today) === 'current' ? 'st-booked' : 'st-empty'}`}>
                  {phaseLabel(b)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
