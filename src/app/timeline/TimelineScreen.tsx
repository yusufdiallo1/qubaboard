"use client";

import { useCallback } from "react";
import { useAppState, useAppDispatch } from "@/lib/store";
import {
  localToday,
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
// MONTH VIEW (only view)
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
    const occ = occOnDate(bookings, iso);
    return { arrivals, departures, occ };
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

                {(arrivals > 0 || departures > 0) && (
                  <div className="mc-flags">
                    {arrivals > 0 && <span className="arr">+{arrivals}</span>}
                    {departures > 0 && <span className="dep">-{departures}</span>}
                  </div>
                )}

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
  const { lang } = useAppState();
  const t = T[lang];

  return (
    <div>
      <h1 className="page-h">{t.timelineTitle}</h1>
      <p className="page-sub">{t.timelineSub}</p>
      <MonthView />
    </div>
  );
}
