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
// Local helpers
// ---------------------------------------------------------------------------

function z(n: number): string { return ("0" + n).slice(-2); }

function parseParts(iso: string): { y: number; m: number; d: number } {
  const p = iso.split("-");
  return { y: +p[0], m: +p[1], d: +p[2] };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const TOTAL_ROOMS = 20;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const TimelineIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3"/>
    <path d="M16 2v4M8 2v4M3 10h18"/>
    <path d="M8 14h.01M8 17h.01M12 14h.01M12 17h.01M16 14h.01"/>
  </svg>
);

const MonthIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3"/>
    <path d="M16 2v4M8 2v4M3 10h18M7 15h10M7 19h6"/>
  </svg>
);

// ---------------------------------------------------------------------------
// View toggle — inline pill with two icon buttons
// ---------------------------------------------------------------------------

function CalViewToggle() {
  const { lang, calView } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];
  return (
    <div className="vtoggle" role="group" aria-label={t.calTimeline}>
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
// Timeline strip view (10-day paginated grid)
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

  const colTemplate = `52px repeat(${N}, minmax(0, 1fr))`;
  const rangeLabel = `${pageStart}–${pageEnd} ${t.months[viewM - 1]} ${viewY}`;

  const handleNext = useCallback(() => {
    if (tlChunk < 2) dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset, chunk: tlChunk + 1 } });
    else dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset + 1, chunk: 0 } });
  }, [dispatch, tlMonthOffset, tlChunk]);

  const handlePrev = useCallback(() => {
    if (tlChunk > 0) dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset, chunk: tlChunk - 1 } });
    else dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: tlMonthOffset - 1, chunk: 2 } });
  }, [dispatch, tlMonthOffset, tlChunk]);

  const handleToday = useCallback(() => {
    const todayDay = new Date().getDate();
    const chunk = todayDay <= 10 ? 0 : todayDay <= 20 ? 1 : 2;
    dispatch({ type: "SET_TL_PAGE", payload: { monthOffset: 0, chunk } });
  }, [dispatch]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { handleToday(); }, []);

  const handleCellClick = useCallback((roomNo: number, date: string) => {
    dispatch({ type: "OPEN_SHEET", payload: { roomNo, from: "board", date } });
  }, [dispatch]);

  const handleBarClick = useCallback((roomNo: number, bookingId: string) => {
    dispatch({ type: "OPEN_SHEET", payload: { roomNo, from: "board", bookingId } });
  }, [dispatch]);

  const roomNos = Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1);
  const isRtl = lang === "ar";

  function getVisibleBookings(roomNo: number) {
    return bookings.filter(b => {
      if (b.room_no !== roomNo || b.checked_out) return false;
      return b.check_out > pageStartISO && b.check_in < pageEndExclISO;
    });
  }

  return (
    <div>
      <div className="tl-top">
        <button className="tl-todaybtn tl-today-standalone" onClick={handleToday}>{t.today}</button>
        <div className="tl-nav">
          <button className="tl-navbtn" onClick={handlePrev} aria-label="Previous">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isRtl ? <polyline points="8 5 13 10 8 15"/> : <polyline points="12 5 7 10 12 15"/>}
            </svg>
          </button>
          <button className="tl-navbtn" onClick={handleNext} aria-label="Next">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isRtl ? <polyline points="12 5 7 10 12 15"/> : <polyline points="8 5 13 10 8 15"/>}
            </svg>
          </button>
        </div>
        <span className="tl-range">{rangeLabel}</span>
        <div className="tl-legend">
          <span className="li" style={{ "--c": "#e05454" } as React.CSSProperties}><i className="dot"/>{lang === "ar" ? "مقيم" : "In-house"}</span>
          <span className="li" style={{ "--c": "#8b5cf6" } as React.CSSProperties}><i className="dot"/>{lang === "ar" ? "قادم" : "Upcoming"}</span>
          <span className="li" style={{ "--c": "#3a8fe0" } as React.CSSProperties}><i className="dot"/>{lang === "ar" ? "مغادرة" : "Checkout"}</span>
        </div>
      </div>

      <div className="tl-scroll">
        {/* Header row */}
        <div className="tl-headrow" style={{ gridTemplateColumns: colTemplate }}>
          <div className="tl-corner">{lang === "ar" ? "غ" : "Rm"}</div>
          {dayNumbers.map(d => {
            const iso = dayISO(d);
            const isToday = iso === today;
            const wdIdx = weekdayOf(iso);
            return (
              <div key={d} className={`tl-day${isToday ? " today" : ""}`}>
                <div className="wd">{t.wdays[wdIdx]}</div>
                <div className="dn">{d}</div>
              </div>
            );
          })}
        </div>

        {/* Room rows */}
        {roomNos.map(roomNo => {
          const vb = getVisibleBookings(roomNo);
          return (
            <div key={roomNo} className="tl-row" style={{ gridTemplateColumns: colTemplate }}>
              <div className="tl-room"><i>{lang === "ar" ? "غ" : "Rm"}</i><b>{roomNo}</b></div>
              {dayNumbers.map(d => {
                const iso = dayISO(d);
                return (
                  <div
                    key={d}
                    className={`tl-cell${iso === today ? " today" : ""}`}
                    onClick={() => handleCellClick(roomNo, iso)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleCellClick(roomNo, iso); }}
                  />
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
                    onClick={e => { e.stopPropagation(); handleBarClick(roomNo, b.id); }}
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
// Month calendar view — clean Apple Calendar style
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

  const handleDayClick = useCallback((iso: string) => {
    dispatch({ type: "OPEN_SHEET", payload: { roomNo: 1, from: "board", date: iso } });
  }, [dispatch]);

  // Build cells: blanks + days
  const cells: Array<{ type: "blank" } | { type: "day"; iso: string; dn: number }> = [];
  for (let i = 0; i < firstWday; i++) cells.push({ type: "blank" });
  for (let d = 1; d <= totalDaysInMonth; d++) {
    cells.push({ type: "day", iso: `${dispY}-${z(dispM)}-${z(d)}`, dn: d });
  }
  // fill remaining cells to complete the last row
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) cells.push({ type: "blank" });
  }

  function getBookingsOnDate(iso: string) {
    return bookings.filter(b => {
      if (b.checked_out) return false;
      if (b.check_out === iso) return true;
      return b.check_in <= iso && b.check_out > iso;
    });
  }

  function getDayStats(iso: string) {
    const arrivals = bookings.filter(b => !b.checked_out && b.check_in === iso).length;
    const departures = bookings.filter(b => !b.checked_out && b.check_out === iso).length;
    return { arrivals, departures };
  }

  const occPct = (iso: string) => Math.round(occOnDate(bookings, iso) / TOTAL_ROOMS * 100);

  return (
    <div>
      {/* Today + hint row above the calendar card */}
      <div className="cal-top-row">
        <button className="tl-todaybtn tl-today-standalone" onClick={handleToday}>{t.today}</button>
      </div>
    <div className="cal-wrap">
      {/* Nav */}
      <div className="cal-nav">
        <button className="tl-navbtn" onClick={handlePrev} aria-label="Previous month">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl ? <polyline points="8 5 13 10 8 15"/> : <polyline points="12 5 7 10 12 15"/>}
          </svg>
        </button>
        <h2 className="cal-month-title">{rangeLabel}</h2>
        <button className="tl-navbtn" onClick={handleNext} aria-label="Next month">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isRtl ? <polyline points="12 5 7 10 12 15"/> : <polyline points="8 5 13 10 8 15"/>}
          </svg>
        </button>
      </div>

      {/* Weekday header */}
      <div className="cal-wdrow">
        {t.wmin.map((wd, i) => (
          <div key={i} className="cal-wd">{wd}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="cal-grid">
        {cells.map((cell, idx) => {
          if (cell.type === "blank") {
            return <div key={`b-${idx}`} className="cal-cell cal-blank" />;
          }

          const { iso, dn } = cell;
          const isToday = iso === today;
          const isPast = iso < today;
          const dayBookings = getBookingsOnDate(iso);
          const { arrivals, departures } = getDayStats(iso);
          const pct = occPct(iso);

          let cls = "cal-cell";
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
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleDayClick(iso); }}
            >
              {/* Day number */}
              <div className="cal-dn-row">
                <span className="cal-dn">{dn}</span>
                {(arrivals > 0 || departures > 0) && (
                  <span className="cal-adflags">
                    {arrivals > 0 && <span className="arr">+{arrivals}</span>}
                    {departures > 0 && <span className="dep">-{departures}</span>}
                  </span>
                )}
              </div>

              {/* Guest pills */}
              {dayBookings.length > 0 && (
                <div className="cal-pills">
                  {dayBookings.slice(0, 2).map(b => {
                    const isCheckout = b.check_out === iso;
                    const isFuture = b.check_in > today;
                    const color = isCheckout ? "#3a8fe0" : isFuture ? "#C6A253" : "#e05454";
                    return (
                      <div
                        key={b.id}
                        className="cal-pill"
                        style={{ background: color + "28", borderColor: color, color }}
                      >
                        {b.guest_name.split(" ")[0]}
                      </div>
                    );
                  })}
                  {dayBookings.length > 2 && (
                    <div className="cal-pill-more">+{dayBookings.length - 2}</div>
                  )}
                </div>
              )}

              {/* Occupancy bar — only if occupied */}
              {pct > 0 && (
                <div className="cal-occ-bar">
                  <div className="cal-occ-track">
                    <div className="cal-occ-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="cal-occ-pct">{pct}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-leg-item"><i style={{ background: "#e05454" }}/>{lang === "ar" ? "مقيم" : "In-house"}</span>
        <span className="cal-leg-item"><i style={{ background: "#C6A253" }}/>{lang === "ar" ? "قادم" : "Upcoming"}</span>
        <span className="cal-leg-item"><i style={{ background: "#3a8fe0" }}/>{lang === "ar" ? "مغادرة" : "Checkout"}</span>
      </div>
    </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — page title + toggle inline, then active view
// ---------------------------------------------------------------------------

export default function TimelineScreen() {
  const { lang, calView } = useAppState();
  const t = T[lang];

  return (
    <div>
      {/* Page header row: title left, toggle right */}
      <div className="cal-header-row">
        <div>
          <h1 className="page-h" style={{ margin: 0 }}>{t.timelineTitle}</h1>
          <p className="page-sub" style={{ margin: "2px 0 0" }}>{t.timelineSub}</p>
        </div>
        <CalViewToggle />
      </div>

      {calView === "timeline" ? <TimelineView /> : <MonthView />}
    </div>
  );
}
