"use client";

import { useCallback } from "react";
import { useAppState, useAppDispatch } from "@/lib/store";
import {
  localToday,
  isoAdd,
  diffDays,
  weekdayOf,
  monthFirst,
  shiftMonth,
  occOnDate,
} from "@/lib/helpers";
import { T } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_ROOMS = 20;
const DAYS = 30;

// ---------------------------------------------------------------------------
// Helpers
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
      >
        {t.calTimeline}
      </button>
      <button
        className={`vt${calView === "month" ? " on" : ""}`}
        onClick={() => dispatch({ type: "SET_CAL_VIEW", payload: "month" })}
        aria-pressed={calView === "month"}
      >
        {t.calMonth}
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
      <div className="tl-nav">
        <button
          className="tl-navbtn"
          onClick={onPrev}
          aria-label="Previous"
        >
          {/* Chevron Left (flipped for RTL via CSS dir inheritance) */}
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl
              ? <polyline points="8 5 13 10 8 15" />
              : <polyline points="12 5 7 10 12 15" />}
          </svg>
        </button>
        <button
          className="tl-navbtn"
          onClick={onNext}
          aria-label="Next"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl
              ? <polyline points="12 5 7 10 12 15" />
              : <polyline points="8 5 13 10 8 15" />}
          </svg>
        </button>
        <button className="tl-todaybtn" onClick={onToday}>
          {t.today}
        </button>
      </div>
      <span className="tl-range">{rangeLabel}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// TIMELINE VIEW
// ---------------------------------------------------------------------------

function TimelineView() {
  const { lang, tlStart, bookings, rooms } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];

  const today = localToday();

  // The first day shown in the strip = today + tlStart offset
  const firstDay = isoAdd(today, tlStart);

  // Build the 30-day column dates
  const days: string[] = [];
  for (let i = 0; i < DAYS; i++) {
    days.push(isoAdd(firstDay, i));
  }

  const lastDay = days[DAYS - 1];

  // Range label: "D Mon – D Mon"
  function buildRangeLabel(): string {
    const fp = parseParts(firstDay);
    const lp = parseParts(lastDay);
    const fm = t.months[fp.m - 1];
    const lm = t.months[lp.m - 1];
    if (fp.m === lp.m) {
      return `${fp.d} – ${lp.d} ${fm}`;
    }
    return `${fp.d} ${fm} – ${lp.d} ${lm}`;
  }

  const rangeLabel = buildRangeLabel();

  // Nav handlers
  const handlePrev = useCallback(() => {
    dispatch({ type: "SET_TL_START", payload: tlStart - 7 });
  }, [dispatch, tlStart]);

  const handleNext = useCallback(() => {
    dispatch({ type: "SET_TL_START", payload: tlStart + 7 });
  }, [dispatch, tlStart]);

  const handleToday = useCallback(() => {
    dispatch({ type: "SET_TL_START", payload: 0 });
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

  // For each room, find bookings that overlap the visible window
  function getVisibleBookings(roomNo: number) {
    return bookings.filter((b) => {
      if (b.room_no !== roomNo || b.checked_out) return false;
      // overlaps window if b.check_in < lastDay+1 AND b.check_out > firstDay
      return b.check_in <= lastDay && b.check_out > firstDay;
    });
  }

  // Figure out which bar style to use
  function barClass(b: { check_in: string; check_out: string }): string {
    if (b.check_out === today) return "tl-bar checkout";
    if (b.check_in > today) return "tl-bar future";
    return "tl-bar";
  }

  // Compute left% and width% for a booking bar within the 30-day window
  function barStyle(b: { check_in: string; check_out: string }): React.CSSProperties {
    const startClipped = b.check_in < firstDay ? firstDay : b.check_in;
    const endClipped = b.check_out > lastDay ? isoAdd(lastDay, 1) : b.check_out;

    const startIdx = diffDays(firstDay, startClipped);
    const endIdx = diffDays(firstDay, endClipped);
    const daysVisible = Math.max(0, endIdx - startIdx);

    // Position is relative to the .tl-cells container which spans DAYS columns of 60px each
    const leftPct = (startIdx / DAYS) * 100;
    const widthPct = (daysVisible / DAYS) * 100;

    return {
      left: `${leftPct}%`,
      width: `${widthPct}%`,
    };
  }

  // Legend dots colors
  const legendItems = [
    { key: "inhouse", label: t.inhouse, color: "var(--booked)" },
    { key: "reserved", label: t.reserved, color: "#e3cd97" },
    { key: "checkout", label: t.checkout, color: "var(--checkout)" },
  ];

  return (
    <div>
      {/* Top toolbar */}
      <div className="tl-top">
        <CalViewToggle />
        <TimelineNav
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          rangeLabel={rangeLabel}
        />
        {/* Legend */}
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

      {/* Scrollable timeline grid */}
      <div className="tl-scroll">
        <div className="tl">
          {/* Header row */}
          <div className="tl-headrow">
            <div className="tl-corner">
              {lang === "ar" ? "غرفة" : "Rm"}
            </div>
            <div className="tl-days">
              {days.map((day, idx) => {
                const parts = parseParts(day);
                const isToday = day === today;
                const prevDay = idx > 0 ? days[idx - 1] : null;
                const isMonthStart = prevDay
                  ? parseParts(prevDay).m !== parts.m
                  : true; // first column always shows month

                const wdayIdx = weekdayOf(day);
                const wdLabel = t.wmin[wdayIdx];
                const monLabel = isMonthStart ? t.months[parts.m - 1].slice(0, 3) : "";

                let cls = "tl-day";
                if (isToday) cls += " today";
                if (isMonthStart && idx > 0) cls += " mstart";

                return (
                  <div key={day} className={cls}>
                    <div className="mon">{monLabel}</div>
                    <div className="wd">{wdLabel}</div>
                    <div className="dn">{parts.d}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Room rows */}
          {roomNos.map((roomNo) => {
            const visibleBookings = getVisibleBookings(roomNo);

            return (
              <div key={roomNo} className="tl-row">
                {/* Room label */}
                <div className="tl-room">
                  <i>{lang === "ar" ? "غ" : "Rm"}</i>
                  <b>{roomNo}</b>
                </div>

                {/* Cells + bars */}
                <div className="tl-cells">
                  {/* Empty tappable cells */}
                  {days.map((day) => {
                    const isToday = day === today;
                    let cellCls = "tl-cell";
                    if (isToday) cellCls += " today";

                    return (
                      <div
                        key={day}
                        className={cellCls}
                        onClick={() => handleCellClick(roomNo, day)}
                        role="button"
                        aria-label={`New booking room ${roomNo} on ${day}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleCellClick(roomNo, day);
                          }
                        }}
                      />
                    );
                  })}

                  {/* Booking bars overlaid absolutely */}
                  {visibleBookings.map((b) => (
                    <button
                      key={b.id}
                      className={barClass(b)}
                      style={barStyle(b)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBarClick(roomNo, b.id);
                      }}
                      title={b.guest_name}
                      aria-label={`Booking: ${b.guest_name}`}
                    >
                      {b.guest_name}
                    </button>
                  ))}
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
// MONTH VIEW
// ---------------------------------------------------------------------------

function MonthView() {
  const { lang, calMonthOffset, bookings } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];

  const today = localToday();

  // Determine displayed month
  let baseMonth = monthFirst(today);
  for (let i = 0; i < Math.abs(calMonthOffset); i++) {
    baseMonth = shiftMonth(baseMonth, calMonthOffset > 0 ? 1 : -1);
  }
  // Easier: compute directly
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

  // Tapping a day opens timeline at that date
  const handleDayClick = useCallback(
    (iso: string) => {
      // Switch to timeline view and set tlStart so that iso is the first visible day
      const offset = diffDays(today, iso);
      dispatch({ type: "SET_TL_START", payload: offset });
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
