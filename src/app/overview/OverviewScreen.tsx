'use client';

/**
 * OverviewScreen — port of overviewPage() from reference/Quba-Room-Board.html.
 *
 * Rules carried from the prototype:
 * - NEVER use toISOString() for date keys — local-component math only.
 * - Real data only — zero baseline when there are no bookings.
 * - Transparent hit-rects: fill="transparent" explicitly (not default black).
 * - Maintenance == red == wrench == override='maintenance'.
 * - All charts interactive: hover on hit-rects, donut segments thicken, bars highlight.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import {
  localToday,
  isoAdd,
  fmtDate,
  diffDays,
  roomStatus,
  occOnDate,
} from '@/lib/helpers';
import type { Room, Booking, BookingSource, RoomStatus } from '@/lib/types';
import { T } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Constants (mirrors prototype)
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_ROOMS = 20;
const SOURCES: BookingSource[] = ['direct', 'airbnb', 'booking', 'gathern'];

const SCOLOR: Record<RoomStatus, string> = {
  empty: 'var(--free)',
  booked: 'var(--booked)',
  checkout: 'var(--checkout)',
  cleaning: 'var(--cleaning)',
  maintenance: 'var(--maint)',
};

const SRCCOLOR: Record<BookingSource, string> = {
  direct: 'var(--gold)',
  airbnb: 'var(--checkout)',
  booking: 'var(--info)',
  gathern: 'var(--free)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (mirror reference exactly, timezone-safe)
// ─────────────────────────────────────────────────────────────────────────────

function floorOf(no: number): 1 | 2 {
  return no <= 10 ? 1 : 2;
}

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, diffDays(a, b));
}

function fmtMoney(n: number): string {
  return 'SAR ' + Number(n || 0).toLocaleString('en-US');
}

// Revenue on a specific date: sum amount/nights for all bookings spanning that date.
function revOnDate(bookings: Booking[], iso: string): number {
  return Math.round(
    bookings.reduce((s, b) => {
      const n = nightsBetween(b.check_in, b.check_out);
      if (n > 0 && b.check_in <= iso && iso < b.check_out) {
        return s + (Number(b.amount) || 0) / n;
      }
      return s;
    }, 0),
  );
}

interface FloorStats {
  occ: number;
  total: number;
  pct: number;
}

function floorOcc(rooms: Room[], bookings: Booking[], today: string, fl: 1 | 2): FloorStats {
  const rs = rooms.filter((r) => floorOf(r.no) === fl);
  const occr = rs.filter((r) => {
    const st = roomStatus(r, bookings, today);
    return st === 'booked' || st === 'checkout';
  }).length;
  return { occ: occr, total: rs.length, pct: Math.round((occr / (rs.length || 1)) * 100) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip hook — single floating div, positioned near cursor
// ─────────────────────────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

function useTooltip() {
  const [tip, setTip] = useState<TooltipState>({ visible: false, text: '', x: 0, y: 0 });

  const show = useCallback((text: string, e: React.MouseEvent) => {
    setTip({ visible: true, text, x: e.clientX + 12, y: e.clientY - 28 });
  }, []);

  const move = useCallback((e: React.MouseEvent) => {
    setTip((prev) => ({ ...prev, x: e.clientX + 12, y: e.clientY - 28 }));
  }, []);

  const hide = useCallback(() => {
    setTip((prev) => ({ ...prev, visible: false }));
  }, []);

  return { tip, show, move, hide };
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Trend chart — mirrors trendChart() in prototype
// ─────────────────────────────────────────────────────────────────────────────

interface TrendPoint {
  v: number;
  l: string;   // formatted date label
  x: number;   // day number (for axis label)
}

interface TrendChartProps {
  series: TrendPoint[];
  color: string;
  suffix: string;
  onTip: (text: string, e: React.MouseEvent) => void;
  onTipMove: (e: React.MouseEvent) => void;
  onTipHide: () => void;
}

function TrendChart({ series, color, suffix, onTip, onTipMove, onTipHide }: TrendChartProps) {
  const W = 560;
  const H = 150;
  const PT = 12;
  const PB = 22;
  const PX = 12;
  const n = series.length || 1;

  const vals = series.map((p) => p.v);
  const max = Math.max(...vals, 1);

  const X = (i: number) => PX + (W - 2 * PX) * (n <= 1 ? 0 : i / (n - 1));
  const Y = (v: number) => (H - PB) - (H - PT - PB) * (v / max);

  const linePoints = series.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');

  const areaPath =
    `M${X(0).toFixed(1)},${(H - PB).toFixed(1)} ` +
    series.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ') +
    ` L${X(n - 1).toFixed(1)},${(H - PB).toFixed(1)} Z`;

  const cw = (W - 2 * PX) / Math.max(n - 1, 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Area fill */}
      <path d={areaPath} fill={color} opacity={0.14} />

      {/* Line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {series.map((p, i) => (
        <circle
          key={i}
          className="tdot"
          cx={X(i).toFixed(1)}
          cy={Y(p.v).toFixed(1)}
          r={3.3}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={1.4}
        />
      ))}

      {/* Day axis labels — every other label + always last */}
      {series.map((p, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text
            key={`ax-${i}`}
            x={X(i).toFixed(1)}
            y={H - 6}
            textAnchor="middle"
            className="ax"
            style={{ fontSize: 9, fill: 'var(--faint)', fontWeight: 600 }}
          >
            {p.x}
          </text>
        ) : null,
      )}

      {/* Transparent full-height hit-rects — fill MUST be "transparent", not omitted */}
      {series.map((p, i) => (
        <rect
          key={`hit-${i}`}
          className="thit"
          x={(X(i) - cw / 2).toFixed(1)}
          y={0}
          width={cw.toFixed(1)}
          height={H - PB}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => onTip(`${p.l}: ${p.v}${suffix}`, e)}
          onMouseMove={onTipMove}
          onMouseLeave={onTipHide}
        />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Donut chart — mirrors donut() in prototype
// ─────────────────────────────────────────────────────────────────────────────

interface DonutSeg {
  v: number;
  c: string;
  tip: string;
}

interface DonutProps {
  segs: DonutSeg[];
  top: string;
  bottom: string;
  onTip: (text: string, e: React.MouseEvent) => void;
  onTipHide: () => void;
}

function DonutChart({ segs, top, bottom, onTip, onTipHide }: DonutProps) {
  const r = 54;
  const C = 2 * Math.PI * r;
  const total = segs.reduce((s, x) => s + x.v, 0) || 1;

  let offset = 0;
  const arcs: React.ReactElement[] = [];

  segs.forEach((s, idx) => {
    if (s.v <= 0) return;
    const len = (s.v / total) * C;
    arcs.push(
      <circle
        key={idx}
        cx={70}
        cy={70}
        r={r}
        fill="none"
        stroke={s.c}
        strokeWidth={18}
        strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
        strokeDashoffset={(-offset).toFixed(2)}
        transform="rotate(-90 70 70)"
        style={{ cursor: 'pointer', transition: 'stroke-width .15s' }}
        onMouseEnter={(e) => onTip(s.tip, e)}
        onMouseLeave={onTipHide}
        // Thicken on hover via onMouseEnter/Leave; CSS also handles :hover stroke-width:22
      />
    );
    offset += len;
  });

  return (
    <svg viewBox="0 0 140 140" className="donut" style={{ width: 150, height: 150, flex: 'none' }}>
      {/* Background track */}
      <circle
        cx={70}
        cy={70}
        r={r}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={18}
      />
      {arcs}
      <text
        x={70}
        y={66}
        textAnchor="middle"
        className="dnum"
        style={{ fontSize: 24, fontWeight: 800, fill: 'var(--text)' }}
      >
        {top}
      </text>
      <text
        x={70}
        y={86}
        textAnchor="middle"
        className="dlab"
        style={{ fontSize: 9, fontWeight: 700, fill: 'var(--faint)', letterSpacing: '.08em' }}
      >
        {bottom}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Panel (admin only)
// ─────────────────────────────────────────────────────────────────────────────

interface RatePanelProps {
  lang: 'ar' | 'en';
  currentRate: number;
  rateSaved: boolean;
  onSave: (rate: number) => void;
}

function RatePanel({ lang, currentRate, rateSaved, onSave }: RatePanelProps) {
  const tl = T[lang];
  const [value, setValue] = useState(String(currentRate));

  // Sync if currentRate changes from store
  useEffect(() => {
    setValue(String(currentRate));
  }, [currentRate]);

  return (
    <div className="panel rate-panel" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
        {tl.rateTitle}
      </h3>
      <div className="rate-row">
        <span className="rate-cur">SAR</span>
        <input
          type="text"
          dir="ltr"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            flex: 1,
            minWidth: 120,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 11,
            padding: '12px 14px',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        />
        <button
          className={`btn-rate${rateSaved ? ' done' : ''}`}
          onClick={() => {
            const n = parseInt(value, 10);
            if (!isNaN(n) && n > 0) onSave(n);
          }}
        >
          {rateSaved ? (
            <span className="chk">
              <svg
                width={17}
                height={17}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'checkpop .35s cubic-bezier(.2,.9,.3,1.4) both' }}
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          ) : null}
          {rateSaved ? tl.saved : tl.setRate}
        </button>
      </div>
      <div className="rate-hint">{tl.rateHint}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub: string | null;
  icon: React.ReactNode;
  color: string;
  bar: number | null;  // percentage 0–100, or null to hide
}

function StatCard({ label, value, sub, icon, color, bar }: StatCardProps) {
  return (
    <div className="stat">
      <div className="sl">
        <span className="si" style={{ '--c': color } as React.CSSProperties}>
          {icon}
        </span>
        {label}
      </div>
      <div className="sv">{value}</div>
      {bar !== null && (
        <div className="sbar">
          <i style={{ width: `${bar}%`, background: color, display: 'block', height: '100%', borderRadius: 99, transition: 'width .5s' }} />
        </div>
      )}
      {sub && <div className="su">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Icons (inline, no external deps)
// ─────────────────────────────────────────────────────────────────────────────

const Icons = {
  gauge: (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 1 7.38 16.75"/>
      <path d="M12 2A10 10 0 0 0 4.62 18.75"/>
      <path d="M12 12l3.5-3.5"/>
      <circle cx={12} cy={12} r={1}/>
    </svg>
  ),
  bed: (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v5"/>
      <path d="M2 20v-5a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v5"/>
      <path d="M2 16h20"/>
    </svg>
  ),
  arrive: (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
      <path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  depart: (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5"/>
      <path d="m12 19-7-7 7-7"/>
    </svg>
  ),
  money: (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={12} y1={1} x2={12} y2={23}/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  chart: (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1={18} y1={20} x2={18} y2={10}/>
      <line x1={12} y1={20} x2={12} y2={4}/>
      <line x1={6} y1={20} x2={6} y2={14}/>
    </svg>
  ),
  timeline: (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={4} width={18} height={18} rx={2} ry={2}/>
      <line x1={16} y1={2} x2={16} y2={6}/>
      <line x1={8} y1={2} x2={8} y2={6}/>
      <line x1={3} y1={10} x2={21} y2={10}/>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// OverviewScreen — main export
// ─────────────────────────────────────────────────────────────────────────────

export default function OverviewScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rooms, bookings, settings, user, lang, rateSaved } = state;
  const tl = T[lang];
  const today = localToday();
  const isAdmin = user?.role === 'admin';
  const { tip, show: showTip, move: moveTip, hide: hideTip } = useTooltip();

  // ── Derived stats ──────────────────────────────────────────────────────────

  // Count rooms by status
  const counts = (() => {
    const c: Record<string, number> = {
      empty: 0, booked: 0, checkout: 0, cleaning: 0, maintenance: 0, arrivals: 0,
    };
    rooms.forEach((r) => {
      const st = roomStatus(r, bookings, today);
      c[st] = (c[st] || 0) + 1;
      // arrivals: has a booking with check_in === today
      if (bookings.some((b) => b.room_no === r.no && !b.checked_out && b.check_in === today)) {
        c.arrivals++;
      }
    });
    return c;
  })();

  const totalRooms = rooms.length || TOTAL_ROOMS;

  // Occupancy = booked + checkout rooms
  const inHouse = (counts.booked || 0) + (counts.checkout || 0);
  const occPct = Math.round((inHouse / totalRooms) * 100);

  // Revenue = sum of all non-checked-out booking amounts
  const rev = bookings
    .filter((b) => !b.checked_out)
    .reduce((s, b) => s + (Number(b.amount) || 0), 0);

  // ADR = total revenue / occupied rooms
  const adr = inHouse ? Math.round(rev / inHouse) : 0;

  // RevPAR = total revenue / total rooms
  const revpar = Math.round(rev / totalRooms);

  // Average stay = avg nights across non-past bookings
  const stays = bookings
    .map((b) => nightsBetween(b.check_in, b.check_out))
    .filter((n) => n > 0);
  const avgStay = stays.length ? stays.reduce((a, b) => a + b, 0) / stays.length : 0;

  // ── 14-day series ─────────────────────────────────────────────────────────

  const occSeries14: TrendPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = isoAdd(today, -i);
    const v = Math.round((occOnDate(bookings, d) / totalRooms) * 100);
    occSeries14.push({ v, l: fmtDate(d, lang), x: parseInt(d.split('-')[2], 10) });
  }

  const revSeries14: TrendPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = isoAdd(today, -i);
    const v = revOnDate(bookings, d);
    revSeries14.push({ v, l: fmtDate(d, lang), x: parseInt(d.split('-')[2], 10) });
  }

  // ── Donut segments ────────────────────────────────────────────────────────

  const occSegs: DonutSeg[] = [
    { v: inHouse, c: 'var(--booked)', tip: `${tl.occupiedLeg}: ${inHouse}` },
    { v: counts.cleaning || 0, c: 'var(--cleaning)', tip: `${tl.cleaning}: ${counts.cleaning || 0}` },
    { v: counts.maintenance || 0, c: 'var(--maint)', tip: `${tl.maintenance}: ${counts.maintenance || 0}` },
    { v: counts.empty || 0, c: 'var(--free)', tip: `${tl.empty}: ${counts.empty || 0}` },
  ];

  const srcCounts: Record<BookingSource, number> = { direct: 0, airbnb: 0, booking: 0, gathern: 0 };
  bookings.forEach((b) => {
    const src = (b.source || 'direct') as BookingSource;
    srcCounts[src] = (srcCounts[src] || 0) + 1;
  });
  const totalBookings = bookings.length;

  const srcSegs: DonutSeg[] = SOURCES.map((sx) => ({
    v: srcCounts[sx],
    c: SRCCOLOR[sx],
    tip: `${tl[`src_${sx}` as keyof typeof tl]}: ${srcCounts[sx]}`,
  }));

  // ── Floor performance ─────────────────────────────────────────────────────

  const fo1 = floorOcc(rooms, bookings, today, 1);
  const fo2 = floorOcc(rooms, bookings, today, 2);

  // ── Rate save handler ─────────────────────────────────────────────────────

  const handleSaveRate = useCallback(async (rate: number) => {
    if (!settings) return;
    try {
      const supabase = createClient();
      await supabase.from('app_settings').update({ daily_rate: rate }).eq('id', settings.id);
      dispatch({ type: 'SET_SETTINGS', payload: { ...settings, daily_rate: rate } });
      dispatch({ type: 'SET_RATE_SAVED', payload: true });
      setTimeout(() => dispatch({ type: 'SET_RATE_SAVED', payload: false }), 2000);
    } catch (err) {
      console.error('Failed to save rate:', err);
    }
  }, [settings, dispatch]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Global tooltip */}
      <div
        className={`qtip${tip.visible ? ' show' : ''}`}
        style={{ left: tip.x, top: tip.y, position: 'fixed', zIndex: 200, pointerEvents: 'none' }}
      >
        {tip.text}
      </div>

      <div className="page-h">{tl.overviewTitle}</div>
      <div className="page-sub">{tl.overviewSub}</div>

      {/* Rate panel — admin only */}
      {isAdmin && settings && (
        <RatePanel
          lang={lang}
          currentRate={settings.daily_rate}
          rateSaved={rateSaved}
          onSave={handleSaveRate}
        />
      )}

      {/* KPI cards */}
      <div className="stats">
        <StatCard
          label={tl.occRate}
          value={`${occPct}%`}
          sub={null}
          icon={Icons.gauge}
          color="var(--gold-deep)"
          bar={occPct}
        />
        <StatCard
          label={tl.occupiedRooms}
          value={`${inHouse} / ${totalRooms}`}
          sub={tl.occupied_lab}
          icon={Icons.bed}
          color="var(--booked)"
          bar={null}
        />
        <StatCard
          label={tl.arrivals}
          value={String(counts.arrivals || 0)}
          sub={null}
          icon={Icons.arrive}
          color="var(--info)"
          bar={null}
        />
        <StatCard
          label={tl.departuresLab}
          value={String(counts.checkout || 0)}
          sub={null}
          icon={Icons.depart}
          color="var(--checkout)"
          bar={null}
        />
        <StatCard
          label={tl.revenue}
          value={fmtMoney(rev)}
          sub={tl.revenueSub}
          icon={Icons.money}
          color="var(--free)"
          bar={null}
        />
        <StatCard
          label={tl.adr}
          value={fmtMoney(adr)}
          sub={tl.adrSub}
          icon={Icons.chart}
          color="var(--cleaning)"
          bar={null}
        />
        <StatCard
          label={tl.revpar}
          value={fmtMoney(revpar)}
          sub={tl.revparSub}
          icon={Icons.gauge}
          color="var(--info)"
          bar={null}
        />
        <StatCard
          label={tl.avgStay}
          value={`${avgStay ? avgStay.toFixed(1) : '0'} ${tl.nightsShort}`}
          sub={tl.avgStaySub}
          icon={Icons.timeline}
          color="var(--booked)"
          bar={null}
        />
      </div>

      {/* Occupancy trend (14 days) */}
      <div className="panel wpanel" style={{ marginTop: 14 }}>
        <h3>{tl.occTrendTitle}</h3>
        <div className="trendwrap">
          <TrendChart
            series={occSeries14}
            color="var(--gold-deep)"
            suffix="%"
            onTip={showTip}
            onTipMove={moveTip}
            onTipHide={hideTip}
          />
        </div>
      </div>

      {/* Revenue trend (admin only) */}
      {isAdmin && (
        <div className="panel wpanel" style={{ marginTop: 14 }}>
          <h3>{tl.revTrendTitle}</h3>
          <div className="trendwrap">
            <TrendChart
              series={revSeries14}
              color="var(--free)"
              suffix=" SAR"
              onTip={showTip}
              onTipMove={moveTip}
              onTipHide={hideTip}
            />
          </div>
        </div>
      )}

      {/* Donut charts side-by-side */}
      <div className="panels">
        {/* Occupancy donut */}
        <div className="panel">
          <h3>{tl.occTitle}</h3>
          <div className="donut-wrap">
            <DonutChart
              segs={occSegs}
              top={`${occPct}%`}
              bottom={tl.occupiedLeg}
              onTip={showTip}
              onTipHide={hideTip}
            />
            <div className="dlegend">
              {(
                [
                  [tl.occupiedLeg, inHouse, 'var(--booked)'],
                  [tl.cleaning, counts.cleaning || 0, 'var(--cleaning)'],
                  [tl.maintenance, counts.maintenance || 0, 'var(--maint)'],
                  [tl.empty, counts.empty || 0, 'var(--free)'],
                ] as [string, number, string][]
              ).map(([label, val, color]) => (
                <div key={label} className="li">
                  <span className="dot" style={{ '--c': color } as React.CSSProperties} />
                  {label}
                  <span className="lv">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sources donut */}
        <div className="panel">
          <h3>{tl.sourcesTitle}</h3>
          <div className="donut-wrap">
            <DonutChart
              segs={srcSegs}
              top={String(totalBookings)}
              bottom={tl.histBookings}
              onTip={showTip}
              onTipHide={hideTip}
            />
            <div className="dlegend">
              {SOURCES.map((sx) => (
                <div key={sx} className="li">
                  <span className="dot" style={{ '--c': SRCCOLOR[sx] } as React.CSSProperties} />
                  {tl[`src_${sx}` as keyof typeof tl] as string}
                  <span className="lv">{srcCounts[sx]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status bars + Floor bars side-by-side */}
      <div className="panels" style={{ marginTop: 0 }}>
        {/* Status distribution bars */}
        <div className="panel">
          <h3>{tl.statusTitle}</h3>
          {(
            [
              ['empty', counts.empty || 0, SCOLOR.empty],
              ['booked', counts.booked || 0, SCOLOR.booked],
              ['checkout', counts.checkout || 0, SCOLOR.checkout],
              ['cleaning', counts.cleaning || 0, SCOLOR.cleaning],
              ['maintenance', counts.maintenance || 0, SCOLOR.maintenance],
            ] as [string, number, string][]
          ).map(([key, count, color]) => {
            const tipText = `${tl[key as keyof typeof tl]}: ${count}`;
            const widthPct = Math.round((count / totalRooms) * 100);
            return (
              <div
                key={key}
                className="bk-row"
                style={{ cursor: 'default', transition: 'background .14s' }}
                onMouseEnter={(e) => showTip(tipText, e)}
                onMouseMove={moveTip}
                onMouseLeave={hideTip}
              >
                <span className="bl">
                  <span className="dot" style={{ '--c': color } as React.CSSProperties} />
                  {tl[key as keyof typeof tl] as string}
                </span>
                <span className="bt">
                  <i style={{ width: `${widthPct}%`, background: color }} />
                </span>
                <span className="bv">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Floor performance bars */}
        <div className="panel">
          <h3>{tl.floorTitle}</h3>
          {(
            [
              [tl.floor1, fo1, 'var(--gold-deep)'],
              [tl.floor2, fo2, 'var(--info)'],
            ] as [string, FloorStats, string][]
          ).map(([label, fo, color]) => {
            const tipText = `${label}: ${fo.pct}%`;
            return (
              <div
                key={label}
                className="bk-row"
                style={{ cursor: 'default', transition: 'background .14s' }}
                onMouseEnter={(e) => showTip(tipText, e)}
                onMouseMove={moveTip}
                onMouseLeave={hideTip}
              >
                <span className="bl">
                  <span className="dot" style={{ '--c': color } as React.CSSProperties} />
                  {label}
                  <i className="fnum">
                    {fo.occ}/{fo.total}
                  </i>
                </span>
                <span className="bt">
                  <i style={{ width: `${fo.pct}%`, background: color }} />
                </span>
                <span className="bv">{fo.pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
