"use client";

import { useCallback, useEffect } from "react";
import { useAppState, useAppDispatch } from "@/lib/store";
import {
  localToday,
  isoAdd,
  diffDays,
  weekdayOf,
  monthFirst,
  shiftMonth,
  occOnDate,
  daysInMonthOf,
} from "@/lib/helpers";
import { T } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_ROOMS = 20;

// ---------------------------------------------------------------------------
// Helpers (local — kept here so they don't pollute helpers.ts)
// ---------------------------------------------------------------------------

function z(n: number): string {
  return ("0" + n).slice(-2);
}

/** Parse YYYY-MM-DD into { y, m, d } safely (avoids UTC shifting). */
function parseParts(iso: string): { y: number; m: number; d: number } {
  const p = iso.split("-");
  return { y: +p[0], m: +p[1], d: +p[2] };
}

/** Days in a given month (year, 1-based month). */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ---------------------------------------------------------------------------
// CalView Toggle pill component
// ---------------------------------------------------------------------------

// Timeline strip icon (horizontal bars with day columns)
const TimelineIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M7 14h4M7 17h8" />
  </svg>
);

// Month calendar icon (grid with date squares)
const MonthIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
  </svg>
);

function CalViewToggle() {
  const { lang, calView } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];

  return (
    <div className="calview vtoggle">
      <button
        className={`vt${calView === "timeline" ? " on" : ""}`}
        onClick={() => dispatch({ type: "SET_CAL_VIEW", payload: "timeline" })}
        aria-pressed={calView === "timeline"}
        title={t.calTimeline}
      >
        {TimelineIcon}
      </button>
      <button
        className={`vt${calView === "month" ? " on" : ""}`}
        onClick={() => dispatch({ type: "SET_CAL_VIEW", payload: "month" })}
        aria-pressed={calView === "month"}
        title={t.calMonth}
      >
        {MonthIcon}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline Nav buttons
// ---------------------------------------------------------------------------

interface TimelineNavProps {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  rangeLabel: string;
}

function TimelineNav({ onPrev, onNext, onToday, rangeLabel }: TimelineNavProps) {
  const { lang } = useAppState();
  const t = T[lang];
  const isRtl = lang === "ar";

  return (
    <>
      {/* Single floating pill: ‹ Today › */}
      <div className="tl-nav">
        <button className="tl-navbtn" onClick={onPrev} aria-label="Previous">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl ? <polyline points="8 5 13 10 8 15" /> : <polyline points="12 5 7 10 12 15" />}
          </svg>
        </button>
        <div className="tl-nav-div" aria-hidden="true" />
        <button className="tl-todaybtn" onClick={onToday}>{t.today}</button>
        <div className="tl-nav-div" aria-hidden="true" />
        <button className="tl-navbtn" onClick={onNext} aria-label="Next">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl ? <polyline points="12 5 7 10 12 15" /> : <polyline points="8 5 13 10 8 15" />}
          </svg>
        </button>
      </div>
      <span className="tl-range">{rangeLabel}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// TIMELINE VIEW — 10-day paginated grid layout
// ---------------------------------------------------------------------------

function TimelineView() {
  const { lang, tlMonthOffset, tlChunk, bookings } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];

  const today = localToday();

  // Which month are we viewing?
  const viewMonthFirst = shiftMonth(monthFirst(today), tlMonthOffset);
  const { y: viewY, m: viewM } = parseParts(viewMonthFirst);
  const dim = daysInMonth(viewY, viewM); // total days in viewed month

  // Page bounds (1-indexed day numbers within the month)
  const pageStart = tlChunk * 10 + 1;
  const pageEnd = tlChunk < 2 ? Math.min(tlChunk * 10 + 10, dim) : dim;
  const N = pageEnd - pageStart + 1; // number of columns

  // ISO strings for page boundary checks
  const pageStartISO = isoAdd(viewMonthFirst, pageStart - 1);
  const pageEndExclISO = isoAdd(viewMonthFirst, pageEnd); // exclusive upper bound

  // Day numbers for this page: [pageStart, pageStart+1, ..., pageEnd]
  const dayNumbers: number[] = [];
  for (let d = pageStart; d <= pageEnd; d++) dayNumbers.push(d);

  // Get the ISO date for day number d within the viewed month
  function dayISO(d: number): string {
    return isoAdd(viewMonthFirst, d - 1);
  }

  // CSS grid template: 56px room column + N equal day columns
  const colTemplate = `56px repeat(${N}, minmax(0, 1fr))`;

  // Range label: "1–10 Jan 2026"
  const rangeLabel = `${pageStart}–${pageEnd} ${t.months[viewM - 1]} ${viewY}`;

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (tlChunk < 2) {
      dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset, chunk: tlChunk + 1 } });
    } else {
      dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset + 1, chunk: 0 } });
    }
  }, [dispatch, tlMonthOffset, tlChunk]);

  const handlePrev = useCallback(() => {
    if (tlChunk > 0) {
      dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset, chunk: tlChunk - 1 } });
    } else {
      dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset - 1, chunk: 2 } });
    }
  }, [dispatch, tlMonthOffset, tlChunk]);

  const handleToday = useCallback(() => {
    const todayDay = new Date().getDate();
    const chunk = todayDay <= 10 ? 0 : todayDay <= 20 ? 1 : 2;
    dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: 0, chunk } });
  }, [dispatch]);

  // Click on empty cell → open sheet with new booking date
  const handleCellClick = useCallback(
    (roomNo: number, date: string) => {
      dispatch({
        type: "OPEN_SHEET",
        payload: { roomNo, from: "board", date },
      });
    },
    [dispatch]
  );

  // Click on booking bar → view booking
  const handleBarClick = useCallback(
    (roomNo: number, bookingId: string) => {
      dispatch({
        type: "OPEN_SHEET",
        payload: { roomNo, from: "board", bookingId },
      });
    },
    [dispatch]
  );

  // Build room numbers 1–20
  const roomNos = Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1);

  // For each room, find bookings that overlap the visible 10-day page
  function getVisibleBookings(roomNo: number) {
    return bookings.filter((b) => {
      if (b.room_no !== roomNo || b.checked_out) return false;
      // half-open interval: b overlaps [pageStartISO, pageEndExclISO)
      return b.check_out > pageStartISO && b.check_in < pageEndExclISO;
    });
  }

  // Legend items
  const legendItems = [
    { key: "inhouse", label: t.inhouse, color: "var(--booked)" },
    { key: "reserved", label: t.reserved, color: "#e3cd97" },
    { key: "checkout", label: t.checkout, color: "var(--checkout)" },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="tl-top">
        <CalViewToggle />
        <div className="tl-nav">
          <button className="tl-navbtn" onClick={handlePrev} aria-label={lang === "ar" ? "السابق" : "Previous"}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {lang === "ar" ? <polyline points="8 5 13 10 8 15" /> : <polyline points="12 5 7 10 12 15" />}
            </svg>
          </button>
          <button className="tl-navbtn" onClick={handleNext} aria-label={lang === "ar" ? "التالي" : "Next"}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {lang === "ar" ? <polyline points="12 5 7 10 12 15" /> : <polyline points="8 5 13 10 8 15" />}
            </svg>
          </button>
        </div>
        <button className="tl-todaybtn" onClick={handleToday}>{t.today}</button>
        <span className="tl-range">{rangeLabel}</span>
        <div className="tl-legend">
          {legendItems.map((li) => (
            <span key={li.key} className="li" style={{ "--c": li.color } as React.CSSProperties}>
              <span className="dot" />
              {li.label}
            </span>
          ))}
        </div>
      </div>

      {/* Hint */}
      <p className="tl-hint top">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="8" />
          <line x1="10" y1="8" x2="10" y2="13" />
          <circle cx="10" cy="6" r=".5" fill="currentColor" />
        </svg>
        {t.tlHint}
      </p>

      {/* Grid — no horizontal scroll needed since N ≤ 11 columns */}
      <div className="tl-scroll">
        {/* Date header row — glass pill */}
        <div className="tl-headrow" style={{ gridTemplateColumns: colTemplate }}>
          <div className="tl-corner">{t.roomShort ?? (lang === "ar" ? "غ" : "Rm")}</div>
          {dayNumbers.map((d) => {
            const iso = dayISO(d);
            const isToday = iso === today;
            const wdIdx = weekdayOf(iso);
            const wdLabel = t.wdays[wdIdx];
            let cls = "tl-day";
            if (isToday) cls += " today";
            return (
              <div key={d} className={cls}>
                <div className="wd">{wdLabel}</div>
                <div className="dn">{d}</div>
              </div>
            );
          })}
        </div>

        {/* Room rows */}
        {roomNos.map((roomNo) => {
          const visibleBookings = getVisibleBookings(roomNo);
          return (
            <div key={roomNo} className="tl-row" style={{ gridTemplateColumns: colTemplate }}>
              {/* Room label — column 1 */}
              <div className="tl-room">
                <i>{lang === "ar" ? "غ" : "Rm"}</i>
                <b>{roomNo}</b>
              </div>

              {/* Day cells — columns 2..N+1, grid-row 1 */}
              {dayNumbers.map((d) => {
                const iso = dayISO(d);
                const isToday = iso === today;
                return (
                  <div
                    key={d}
                    className={"tl-cell" + (isToday ? " today" : "")}
                    onClick={() => handleCellClick(roomNo, iso)}
                    role="button"
                    aria-label={`New booking room ${roomNo} on ${iso}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleCellClick(roomNo, iso);
                    }}
                  />
                );
              })}

              {/* Booking bars — also grid children, placed by grid-column */}
              {visibleBookings.map((b) => {
                // Skip if completely outside (shouldn't happen due to filter, but be safe)
                if (b.check_out <= pageStartISO || b.check_in >= pageEndExclISO) return null;

                // Which day number does the bar start/end on within this page?
                const inDay = b.check_in < pageStartISO
                  ? pageStart
                  : parseParts(b.check_in).d;
                const outDay = b.check_out >= pageEndExclISO
                  ? pageEnd + 1
                  : parseParts(b.check_out).d;

                // Grid columns: room is col 1, days are cols 2..(N+1)
                const colStart = inDay - pageStart + 2;
                const colEnd = outDay - pageStart + 2;

                // Does the bar continue beyond the left/right edge of the page?
                const contL = b.check_in < pageStartISO;
                const contR = b.check_out > pageEndExclISO;

                let barCls = "tl-bar";
                if (b.check_out === today) barCls += " checkout";
                else if (b.check_in > today) barCls += " future";
                if (contL) barCls += " cont-l";
                if (contR) barCls += " cont-r";

                return (
                  <button
                    key={b.id}
                    className={barCls}
                    style={{ gridColumn: `${colStart} / ${colEnd}` }}
                    onClick={(e) => { e.stopPropagation(); handleBarClick(roomNo, b.id); }}
                    title={b.guest_name}
                    aria-label={`Booking: ${b.guest_name}`}
                  >
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

  const today = localToday();

  // Determine displayed month
  const displayMonthFirst = shiftMonth(monthFirst(today), calMonthOffset);
  const { y: dispY, m: dispM } = parseParts(displayMonthFirst);
  const totalDaysInMonth = daysInMonth(dispY, dispM);

  // Weekday of the 1st (0=Sun)
  const firstWday = weekdayOf(displayMonthFirst);

  // Range label for nav
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

  // Tapping a day switches to timeline view at that chunk
  const handleDayClick = useCallback(
    (iso: string) => {
      const { d } = parseParts(iso);
      const chunk = d <= 10 ? 0 : d <= 20 ? 1 : 2;
      // monthOffset: how many months away is this iso from today's month?
      const todayMonthFirst = monthFirst(today);
      const isoMonthFirst = monthFirst(iso);
      // Compute offset by counting months
      const tp = parseParts(todayMonthFirst);
      const ip = parseParts(isoMonthFirst);
      const monthOffset = (ip.y - tp.y) * 12 + (ip.m - tp.m);
      dispatch({ type: "SET_TL_PAGE", payload: { monthOffset, chunk } });
      dispatch({ type: "SET_CAL_VIEW", payload: "timeline" });
    },
    [dispatch, today]
  );

  // Build calendar grid cells (blanks + days)
  const cells: Array<{ type: "blank" } | { type: "day"; iso: string; dn: number }> = [];

  for (let i = 0; i < firstWday; i++) {
    cells.push({ type: "blank" });
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const iso = `${dispY}-${z(dispM)}-${z(d)}`;
    cells.push({ type: "day", iso, dn: d });
  }

  // Stats for each day
  function getDayStats(iso: string) {
    const arrivals = bookings.filter(
      (b) => !b.checked_out && b.check_in === iso
    ).length;
    const departures = bookings.filter(
      (b) => !b.checked_out && b.check_out === iso
    ).length;
    const occ = occOnDate(bookings, iso);
    return { arrivals, departures, occ };
  }

  return (
    <div>
      {/* Top toolbar */}
      <div className="tl-top mc-toolbar">
        <CalViewToggle />
        <TimelineNav
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          rangeLabel={rangeLabel}
        />
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
      <div className="mc-grid">
        {/* Weekday header row */}
        <div className="mc-wdrow">
          {t.wmin.map((wd, i) => (
            <div key={i} className="mc-wd">
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="mc-days">
          {cells.map((cell, idx) => {
            if (cell.type === "blank") {
              return <div key={`blank-${idx}`} className="mc-cell empty" />;
            }

            const { iso, dn } = cell;
            const isToday = iso === today;
            const isPast = iso < today;
            const { arrivals, departures, occ } = getDayStats(iso);
            const occPct = Math.round((occ / TOTAL_ROOMS) * 100);

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
                </div>

                {/* Arrivals / departures */}
                {(arrivals > 0 || departures > 0) && (
                  <div className="mc-flags">
                    {arrivals > 0 && <span className="arr">+{arrivals}</span>}
                    {departures > 0 && <span className="dep">-{departures}</span>}
                  </div>
                )}

                {/* Occupancy mini-bar */}
                {occ > 0 && (
                  <div className="mc-occ">
                    <div className="mb">
                      <i style={{ width: `${occPct}%` }} />
                    </div>
                    <span className="mn">{occ}</span>
                  </div>
                )}
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
      <h1 className="page-h">{t.timelineTitle}</h1>
      <p className="page-sub">{t.timelineSub}</p>

      {calView === "timeline" ? <TimelineView /> : <MonthView />}
    </div>
  );
}
