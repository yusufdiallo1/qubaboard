"use client";

import { useCallback, useEffect } from "react";
import { useAppState, useAppDispatch } from "@/lib/store";
import {
  localToday,
  weekdayOf,
  monthFirst,
  shiftMonth,
  isoAdd,
  occOnDate,
} from "@/lib/helpers";
import { T } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function z(n: number): string {
  return ("0" + n).slice(-2);
}

function parseParts(iso: string): { y: number; m: number; d: number } {
  const p = iso.split("-");
  return { y: +p[0], m: +p[1], d: +p[2] };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_ROOMS = 20;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const TimelineIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3"/>
    <path d="M16 2v4M8 2v4M3 10h18M7 14h4M7 17h8"/>
  </svg>
);
const MonthIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
    <path d="M3 9h18M8 2.5v4M16 2.5v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/>
  </svg>
);

// ---------------------------------------------------------------------------
// CalViewToggle
// ---------------------------------------------------------------------------

function CalViewToggle() {
  const { lang, calView } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];
  return (
    <div className="calview vtoggle">
      <button className={`vt${calView === 'timeline' ? ' on' : ''}`}
        onClick={() => dispatch({ type: 'SET_CAL_VIEW', payload: 'timeline' })}
        aria-pressed={calView === 'timeline'} title={t.calTimeline}>
        {TimelineIcon}
      </button>
      <button className={`vt${calView === 'month' ? ' on' : ''}`}
        onClick={() => dispatch({ type: 'SET_CAL_VIEW', payload: 'month' })}
        aria-pressed={calView === 'month'} title={t.calMonth}>
        {MonthIcon}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineView
// ---------------------------------------------------------------------------

function TimelineView() {
  const { lang, tlMonthOffset, tlChunk, bookings } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];
  const today = localToday();

  const viewMonthFirst = shiftMonth(monthFirst(today), tlMonthOffset);
  const { y: viewY, m: viewM } = parseParts(viewMonthFirst);
  const dim = daysInMonth(viewY, viewM);

  const pageStart = tlChunk * 10 + 1;
  const pageEnd = tlChunk < 2 ? Math.min(tlChunk * 10 + 10, dim) : dim;
  const N = pageEnd - pageStart + 1;

  const pageStartISO = isoAdd(viewMonthFirst, pageStart - 1);
  const pageEndExclISO = isoAdd(viewMonthFirst, pageEnd);

  const dayNumbers: number[] = [];
  for (let d = pageStart; d <= pageEnd; d++) dayNumbers.push(d);

  function dayISO(d: number): string { return isoAdd(viewMonthFirst, d - 1); }

  const colTemplate = `56px repeat(${N}, minmax(0, 1fr))`;
  const rangeLabel = `${pageStart}–${pageEnd} ${t.months[viewM - 1]} ${viewY}`;

  const handleNext = useCallback(() => {
    if (tlChunk < 2) dispatch({ type: 'SET_TL_PAGE', payload: { monthOffset: tlMonthOffset, chunk: tlChunk + 1 } });
    else dispatch({ type: 'SET_TL_PAGE', payload: { monthOffset: tlMonthOffset + 1, chunk: 0 } });
  }, [dispatch, tlMonthOffset, tlChunk]);

  const handlePrev = useCallback(() => {
    if (tlChunk > 0) dispatch({ type: 'SET_TL_PAGE', payload: { monthOffset: tlMonthOffset, chunk: tlChunk - 1 } });
    else dispatch({ type: 'SET_TL_PAGE', payload: { monthOffset: tlMonthOffset - 1, chunk: 2 } });
  }, [dispatch, tlMonthOffset, tlChunk]);

  const handleToday = useCallback(() => {
    const todayDay = new Date().getDate();
    const chunk = todayDay <= 10 ? 0 : todayDay <= 20 ? 1 : 2;
    dispatch({ type: 'SET_TL_PAGE', payload: { monthOffset: 0, chunk } });
  }, [dispatch]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { handleToday(); }, []);

  const handleCellClick = useCallback((roomNo: number, date: string) => {
    dispatch({ type: 'OPEN_SHEET', payload: { roomNo, from: 'board', date } });
  }, [dispatch]);

  const handleBarClick = useCallback((roomNo: number, bookingId: string) => {
    dispatch({ type: 'OPEN_SHEET', payload: { roomNo, from: 'board', bookingId } });
  }, [dispatch]);

  const roomNos = Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1);

  function getVisibleBookings(roomNo: number) {
    return bookings.filter(b => {
      if (b.room_no !== roomNo || b.checked_out) return false;
      return b.check_out > pageStartISO && b.check_in < pageEndExclISO;
    });
  }

  const isRtl = lang === 'ar';

  return (
    <div>
      <div className="tl-top">
        <div className="tl-nav">
          <button className="tl-navbtn" onClick={handlePrev}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isRtl ? <polyline points="8 5 13 10 8 15"/> : <polyline points="12 5 7 10 12 15"/>}
            </svg>
          </button>
          <div className="tl-nav-div"/>
          <button className="tl-todaybtn" onClick={handleToday}>{t.today}</button>
          <div className="tl-nav-div"/>
          <button className="tl-navbtn" onClick={handleNext}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isRtl ? <polyline points="12 5 7 10 12 15"/> : <polyline points="8 5 13 10 8 15"/>}
            </svg>
          </button>
        </div>
        <span className="tl-range">{rangeLabel}</span>
      </div>
      <div className="tl-scroll">
        <div className="tl-headrow" style={{ gridTemplateColumns: colTemplate }}>
          <div className="tl-corner">{lang === 'ar' ? 'غ' : 'Rm'}</div>
          {dayNumbers.map(d => {
            const iso = dayISO(d);
            const isToday = iso === today;
            const wdIdx = weekdayOf(iso);
            return (
              <div key={d} className={`tl-day${isToday ? ' today' : ''}`}>
                <div className="wd">{t.wdays[wdIdx]}</div>
                <div className="dn">{d}</div>
              </div>
            );
          })}
        </div>
        {roomNos.map(roomNo => {
          const vb = getVisibleBookings(roomNo);
          return (
            <div key={roomNo} className="tl-row" style={{ gridTemplateColumns: colTemplate }}>
              <div className="tl-room"><i>{lang === 'ar' ? 'غ' : 'Rm'}</i><b>{roomNo}</b></div>
              {dayNumbers.map(d => {
                const iso = dayISO(d);
                return (
                  <div key={d} className={`tl-cell${iso === today ? ' today' : ''}`}
                    onClick={() => handleCellClick(roomNo, iso)} role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleCellClick(roomNo, iso); }}/>
                );
              })}
              {vb.map(b => {
                if (b.check_out <= pageStartISO || b.check_in >= pageEndExclISO) return null;
                const inDay = b.check_in < pageStartISO ? pageStart : parseParts(b.check_in).d;
                const outDay = b.check_out >= pageEndExclISO ? pageEnd + 1 : parseParts(b.check_out).d;
                const colStart = inDay - pageStart + 2;
                const colEnd = outDay - pageStart + 2;
                const contL = b.check_in < pageStartISO;
                const contR = b.check_out > pageEndExclISO;
                let barCls = 'tl-bar';
                if (b.check_out === today) barCls += ' checkout';
                else if (b.check_in > today) barCls += ' future';
                if (contL) barCls += ' cont-l';
                if (contR) barCls += ' cont-r';
                return (
                  <button key={b.id} className={barCls}
                    style={{ gridColumn: `${colStart} / ${colEnd}` }}
                    onClick={e => { e.stopPropagation(); handleBarClick(roomNo, b.id); }}
                    title={b.guest_name} aria-label={`Booking: ${b.guest_name}`}>
                    {b.guest_name}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MONTH VIEW
// ---------------------------------------------------------------------------

function MonthView() {
  const { lang, calMonthOffset, bookings } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];
  const isRtl = lang === "ar";

  const today = localToday();

  const displayMonthFirst = shiftMonth(monthFirst(today), calMonthOffset);
  const { y: dispY, m: dispM } = parseParts(displayMonthFirst);
  const totalDaysInMonth = daysInMonth(dispY, dispM);
  const firstWday = weekdayOf(displayMonthFirst);

  const rangeLabel = `${t.months[dispM - 1]} ${dispY}`;

  const handlePrev = useCallback(() => {
    dispatch({ type: "SET_CAL_MONTH_OFFSET", payload: calMonthOffset - 1 });
  }, [dispatch, calMonthOffset]);

  const handleNext = useCallback(() => {
    dispatch({ type: "SET_CAL_MONTH_OFFSET", payload: calMonthOffset + 1 });
  }, [dispatch, calMonthOffset]);

  const handleToday = useCallback(() => {
    dispatch({ type: "SET_CAL_MONTH_OFFSET", payload: 0 });
  }, [dispatch]);

  const handleDayClick = useCallback(
    (iso: string) => {
      dispatch({ type: "OPEN_SHEET", payload: { roomNo: 1, from: "board", date: iso } });
    },
    [dispatch]
  );

  // Build calendar grid cells
  const cells: Array<{ type: "blank" } | { type: "day"; iso: string; dn: number }> = [];
  for (let i = 0; i < firstWday; i++) cells.push({ type: "blank" });
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const iso = `${dispY}-${z(dispM)}-${z(d)}`;
    cells.push({ type: "day", iso, dn: d });
  }

  function getDayStats(iso: string) {
    const arrivals = bookings.filter((b) => !b.checked_out && b.check_in === iso).length;
    const departures = bookings.filter((b) => !b.checked_out && b.check_out === iso).length;
    return { arrivals, departures };
  }

  function getBookingsOnDate(iso: string) {
    return bookings.filter((b) => {
      if (b.checked_out) return false;
      // checkout day
      if (b.check_out === iso) return true;
      // active stay (check_in <= iso < check_out)
      return b.check_in <= iso && b.check_out > iso;
    });
  }

  return (
    <div className="mc-wrap">
      {/* Nav bar */}
      <div className="mc-nav">
        <button className="tl-navbtn" onClick={handlePrev} aria-label="Previous">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl ? <polyline points="8 5 13 10 8 15" /> : <polyline points="12 5 7 10 12 15" />}
          </svg>
        </button>
        <button className="tl-todaybtn" onClick={handleToday}>{t.today}</button>
        <button className="tl-navbtn" onClick={handleNext} aria-label="Next">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl ? <polyline points="12 5 7 10 12 15" /> : <polyline points="8 5 13 10 8 15" />}
          </svg>
        </button>
        <span className="mc-month-label">{rangeLabel}</span>
      </div>

      {/* Hint */}
      <p className="tl-hint top">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="8" />
          <line x1="10" y1="8" x2="10" y2="13" />
          <circle cx="10" cy="6" r=".5" fill="currentColor" />
        </svg>
        {t.monthHint}
      </p>

      {/* Month grid */}
      <div className="mc-grid mc-grid-big">
        <div className="mc-wdrow">
          {t.wmin.map((wd, i) => (
            <div key={i} className="mc-wd">{wd}</div>
          ))}
        </div>

        <div className="mc-days">
          {cells.map((cell, idx) => {
            if (cell.type === "blank") {
              return <div key={`blank-${idx}`} className="mc-cell empty" />;
            }

            const { iso, dn } = cell;
            const isToday = iso === today;
            const isPast = iso < today;
            const { arrivals, departures } = getDayStats(iso);
            const dayBookings = getBookingsOnDate(iso);

            let cls = "mc-cell";
            if (isToday) cls += " today";
            if (isPast) cls += " past";

            return (
              <div
                key={iso}
                className={cls}
                onClick={() => handleDayClick(iso)}
                role="button"
                tabIndex={0}
                aria-label={iso}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleDayClick(iso);
                }}
              >
                <div className="mc-top">
                  <span className="mc-dn">{dn}</span>
                  {(arrivals > 0 || departures > 0) && (
                    <div className="mc-flags" style={{ marginInlineStart: 'auto' }}>
                      {arrivals > 0 && <span className="arr">+{arrivals}</span>}
                      {departures > 0 && <span className="dep">-{departures}</span>}
                    </div>
                  )}
                </div>

                {/* Guest booking pills */}
                <div className="mc-bookings">
                  {dayBookings.slice(0, 3).map(b => {
                    const isCheckout = b.check_out === iso;
                    const isFuture = b.check_in > today;
                    const color = isCheckout ? '#3a8fe0' : isFuture ? '#C6A253' : '#e05454';
                    return (
                      <div key={b.id} className="mc-pill" style={{ background: color + '22', borderColor: color, color }}>
                        <span className="mc-pill-name">{b.guest_name.split(' ')[0]}</span>
                        <span className="mc-pill-rm">R{b.room_no}</span>
                      </div>
                    );
                  })}
                  {dayBookings.length > 3 && (
                    <div className="mc-pill-more">+{dayBookings.length - 3}</div>
                  )}
                </div>

                {/* Occupancy mini-bar */}
                <div className="mc-occ">
                  <div className="mb">
                    <i style={{ width: `${occOnDate(bookings, iso)}%` }} />
                  </div>
                  <span className="mn">{occOnDate(bookings, iso)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function TimelineScreen() {
  const { lang, calView } = useAppState();
  const t = T[lang];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="page-h" style={{ margin: 0 }}>{t.timelineTitle}</h1>
          <p className="page-sub" style={{ margin: 0 }}>{t.timelineSub}</p>
        </div>
        <div style={{ marginInlineStart: 'auto' }}>
          <CalViewToggle />
        </div>
      </div>
      {calView === 'timeline' ? <TimelineView /> : <MonthView />}
    </div>
  );
}
