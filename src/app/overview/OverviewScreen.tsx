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

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useReveal } from '@/lib/useReveal';
import { useAppState, useAppDispatch } from '@/lib/store';
import { StatsSkeleton, ChartSkeleton } from '@/components/Skeletons';
import { useCountUp } from '@/lib/useCountUp';
import {
  localToday,
  isoAdd,
  diffDays,
  roomStatus,
} from '@/lib/helpers';
import type { Room, Booking, BookingSource, RoomStatus } from '@/lib/types';
import { T } from '@/lib/i18n';
import { saveSettings } from '@/lib/supabaseActions';

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
    setTip({ visible: true, text, x: e.clientX, y: e.clientY });
  }, []);

  const move = useCallback((e: React.MouseEvent) => {
    setTip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
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
}

function TrendChart({ series, color, suffix }: TrendChartProps) {
  const [localTip, setLocalTip] = useState<{ visible: boolean; text: string; pct: number }>({ visible: false, text: '', pct: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const linePathRef = useRef<SVGPathElement>(null);
  const hasAnimatedRef = useRef(false);
  const W = 560;
  const H = 168;
  const PT = 20;   // extra top padding for Y-axis labels
  const PB = 24;
  const PL = 38;   // left padding for Y-axis
  const PR = 8;
  const n = series.length || 1;

  const vals = series.map((p) => p.v);
  const max = Math.max(...vals, 0);

  // Nice round Y-axis max: ceil to next tidy number
  function niceMax(v: number): number {
    if (v === 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / mag) * mag;
  }
  const yMax = niceMax(max);

  const X = (i: number) => PL + (W - PL - PR) * (n <= 1 ? 0.5 : i / (n - 1));
  const Y = (v: number) => max === 0 ? (H - PB) : PT + (H - PT - PB) * (1 - v / yMax);

  // Cardinal spline tension=0.4 — smooth, no overshoot
  const pts = series.map((p, i) => ({ x: X(i), y: Y(p.v) }));

  // Clamp y values to chart bounds to prevent control-point overshoot on spikes
  const clampedPts = pts.map(p => ({ x: p.x, y: Math.max(PT, Math.min(H - PB, p.y)) }));

  const cardinalSegments = (points: {x:number;y:number}[]) => {
    const t = 0.4;
    let d = '';
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      const cp1x = p1.x + (p2.x - p0.x) * t / 2;
      const cp1y = p1.y + (p2.y - p0.y) * t / 2;
      const cp2x = p2.x - (p3.x - p1.x) * t / 2;
      const cp2y = p2.y - (p3.y - p1.y) * t / 2;
      if (i === 0) d += `M${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const smoothLine = clampedPts.length > 1 ? cardinalSegments(clampedPts) : (clampedPts.length === 1 ? `M${clampedPts[0].x},${clampedPts[0].y}` : '');
  const baseline = H - PB;
  const areaPath = smoothLine
    ? `M${clampedPts[0].x.toFixed(1)},${baseline.toFixed(1)} L${clampedPts[0].x.toFixed(1)},${clampedPts[0].y.toFixed(1)}` +
      smoothLine.replace(/^M[^ ]+ /, ' ') +
      ` L${clampedPts[clampedPts.length-1].x.toFixed(1)},${baseline.toFixed(1)} Z`
    : '';

  // Y-axis: show 0 only when max===0; otherwise 3 ticks at 0, 50%, 100% of yMax
  const yTicks = max === 0
    ? [{ v: 0, y: Y(0) }]
    : [0, 0.5, 1].map(f => ({ v: Math.round(yMax * f), y: Y(yMax * f) }));

  // Run stroke-dashoffset animation exactly once via rAF, not CSS class
  useEffect(() => {
    if (hasAnimatedRef.current || max === 0 || !linePathRef.current) return;
    hasAnimatedRef.current = true;
    const el = linePathRef.current;
    el.style.strokeDasharray = '1000';
    el.style.strokeDashoffset = '1000';
    const start = performance.now();
    const dur = 900;
    function step(now: number) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.style.strokeDashoffset = String(1000 - eased * 1000);
      if (p < 1) requestAnimationFrame(step);
      else el.style.strokeDashoffset = '0';
    }
    requestAnimationFrame(step);
  }, [max]); // only fire when max first becomes non-zero

  // Column hit boundaries: midpoint between adjacent dots
  const hitLeft = (i: number) => i === 0 ? PL : (X(i - 1) + X(i)) / 2;
  const hitRight = (i: number) => i === n - 1 ? W : (X(i) + X(i + 1)) / 2;

  const clipId = `clip-${color.replace(/[^a-z]/gi, '')}`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="trend"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      onMouseLeave={() => setLocalTip(t => ({ ...t, visible: false }))}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB + 1} />
        </clipPath>
      </defs>

      {/* Horizontal grid lines */}
      {yTicks.map((tk, i) => (
        <g key={`g-${i}`}>
          <line
            x1={PL} y1={tk.y.toFixed(1)}
            x2={W - PR} y2={tk.y.toFixed(1)}
            stroke="var(--line-soft)"
            strokeWidth={i === 0 ? 1 : 0.8}
          />
          <text
            x={(PL - 5).toFixed(1)}
            y={(tk.y + 3.5).toFixed(1)}
            textAnchor="end"
            fontSize={8}
            fontWeight={600}
            fill="var(--faint)"
          >
            {suffix === '%' ? `${tk.v}%` : tk.v === 0 ? '0' : `${(tk.v / 1000).toFixed(tk.v >= 1000 ? 0 : 1)}k`}
          </text>
        </g>
      ))}

      {/* Area fill — clipped, always visible at low opacity (no CSS animation to avoid flicker) */}
      {max > 0 && (
        <path d={areaPath} fill={color} clipPath={`url(#${clipId})`} opacity={0.12} />
      )}

      {/* Main line — draws in from left via rAF animation (no CSS class to avoid re-render flicker) */}
      {max > 0 && (
        <path
          ref={linePathRef}
          d={smoothLine}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath={`url(#${clipId})`}
          pathLength={1000}
        />
      )}

      {/* Zero baseline — dashed when all zero */}
      {max === 0 && (
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke={color} strokeWidth={1.5} strokeOpacity={0.25} strokeDasharray="4 5" />
      )}

      {/* Dots at every data point */}
      {clampedPts.map((cp, i) => (
        <circle
          key={i}
          cx={cp.x.toFixed(1)}
          cy={cp.y.toFixed(1)}
          r={3.5}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={1.5}
        />
      ))}

      {/* Day axis labels */}
      {series.map((p, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text
            key={`ax-${i}`}
            x={X(i).toFixed(1)}
            y={H - 7}
            textAnchor="middle"
            fontSize={8.5}
            fontWeight={600}
            fill="var(--faint)"
          >
            {p.x}
          </text>
        ) : null,
      )}

      {/* Hit-rects + inline tooltip */}
      {series.map((p, i) => {
        const lx = hitLeft(i);
        const rx = hitRight(i);
        const cx = X(i);
        const tipText = `${p.l}: ${p.v}${suffix}`;
        const isActive = localTip.visible && localTip.text === tipText;
        const tipW = Math.max(tipText.length * 6.2 + 20, 52);
        const tipH = 22;
        const tipX = Math.min(Math.max(cx - tipW / 2, PL), W - tipW - 2);
        const dotY = max > 0 ? clampedPts[i].y : H - PB;
        const tipY = Math.max(4, dotY - tipH - 10);
        return (
          <g key={`col-${i}`}>
            {/* Transparent hit-rect — fill must be explicit "transparent", not a CSS var */}
            <rect
              x={lx.toFixed(1)}
              y={PT}
              width={Math.max(0, rx - lx).toFixed(1)}
              height={H - PT - PB}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setLocalTip({ visible: true, text: tipText, pct: i / (n - 1) })}
              onMouseLeave={() => setLocalTip(t => ({ ...t, visible: false }))}
            />
            {isActive && (
              <g>
                {/* Column highlight — use rgba gold, not CSS var (SVG fill doesn't support CSS vars) */}
                <rect x={lx.toFixed(1)} y={PT} width={Math.max(0, rx - lx).toFixed(1)} height={H - PT - PB} fill="rgba(198,162,83,0.08)" rx={2} />
                {max > 0 && (
                  <line x1={cx} y1={clampedPts[i].y} x2={cx} y2={H - PB} stroke="rgba(198,162,83,0.35)" strokeWidth={1} strokeDasharray="2 2" />
                )}
                {max > 0 && (
                  <circle cx={cx} cy={clampedPts[i].y} r={4.5} fill="#c6a253" stroke="#1b2233" strokeWidth={2} />
                )}
                {/* Tooltip pill — gold bg, dark text */}
                <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6} fill="#c6a253" />
                <text x={tipX + tipW / 2} y={tipY + 14.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1b1407">{tipText}</text>
              </g>
            )}
          </g>
        );
      })}
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
        strokeDashoffset={(C - offset).toFixed(2)}
        transform="rotate(-90 70 70)"
        data-tip={s.tip}
        style={{
          cursor: 'pointer',
          transition: 'stroke-width .15s',
          animation: `donut-in .65s cubic-bezier(.4,0,.2,1) ${idx * 0.1}s both`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as SVGCircleElement).style.strokeWidth = '24'; onTip(s.tip, e); }}
        onMouseLeave={(e) => { (e.currentTarget as SVGCircleElement).style.strokeWidth = '18'; onTipHide(); }}
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

type PerfLevel = 'good' | 'mod' | 'bad' | 'none';

interface StatCardProps {
  label: string;
  value: string;
  rawValue?: number;
  suffix?: string;
  prefix?: string;
  sub: string | null;
  icon: React.ReactNode;
  color: string;
  bar: number | null;
  perf?: PerfLevel;
}

function StatCard({ label, value, rawValue, suffix, prefix, sub, icon, color, bar, perf = 'none' }: StatCardProps) {
  const animated = useCountUp(rawValue ?? 0, 800);
  const displayValue = rawValue !== undefined
    ? `${prefix ?? ''}${animated.toLocaleString()}${suffix ?? ''}`
    : value;

  return (
    <div className="stat">
      <div className="sl">
        <span className="si" style={{ '--c': color } as React.CSSProperties}>
          {icon}
        </span>
        {label}
      </div>
      <div className="sv">{displayValue}</div>
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
  const { rooms, bookings, settings, user, lang, rateSaved, loading } = state;
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
    const { error } = await saveSettings(rate);
    if (error) {
      const errId = `rate-err-${Date.now()}`;
      dispatch({ type: 'PUSH_TOAST', payload: { id: errId, message: String(error), variant: 'error' } });
      setTimeout(() => dispatch({ type: 'DISMISS_TOAST', payload: errId }), 3500);
      return;
    }
    dispatch({ type: 'SET_SETTINGS', payload: { ...settings, daily_rate: rate } });
    dispatch({ type: 'SET_RATE_SAVED', payload: true });
    const okId = `rate-ok-${Date.now()}`;
    dispatch({ type: 'PUSH_TOAST', payload: { id: okId, message: lang === 'ar' ? 'تم حفظ السعر الليلي' : 'Nightly rate saved', variant: 'success' } });
    setTimeout(() => dispatch({ type: 'DISMISS_TOAST', payload: okId }), 2500);
    setTimeout(() => dispatch({ type: 'SET_RATE_SAVED', payload: false }), 2000);
  }, [settings, lang, dispatch]);

  // ── Performance level helpers ─────────────────────────────────────────────
  function occPerf(pct: number): PerfLevel {
    if (pct >= 70) return 'good';
    if (pct >= 40) return 'mod';
    return 'bad';
  }
  function revPerf(amount: number): PerfLevel {
    const rate = settings?.daily_rate || 500;
    const maxPossible = totalRooms * rate;
    const ratio = maxPossible > 0 ? (amount / maxPossible) * 100 : 0;
    if (ratio >= 50) return 'good';
    if (ratio >= 20) return 'mod';
    return 'bad';
  }
  function adrPerf(amount: number): PerfLevel {
    const rate = settings?.daily_rate || 500;
    if (amount >= rate * 0.9) return 'good';
    if (amount >= rate * 0.5) return 'mod';
    return 'bad';
  }

  // ── Scroll-reveal ──────────────────────────────────────────────────────────
  const pageRef = useReveal();

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && rooms.length === 0) {
    return (
      <div>
        <div className="page-h stagger" style={{ marginBottom: 18 }}>{tl.overviewTitle}</div>
        <StatsSkeleton count={6} />
        <div className="panels" style={{ marginTop: 14 }}>
          <ChartSkeleton h={160} />
          <ChartSkeleton h={160} />
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef as React.RefObject<HTMLDivElement>}>
      {/* Global tooltip for donuts/bars (not trend charts — those are SVG-inline) */}
      {tip.visible && (
        <div
          className="qtip show"
          style={{ left: tip.x, top: tip.y - 52, transform: 'translateX(-50%)', position: 'fixed', zIndex: 300, pointerEvents: 'none' }}
        >
          {tip.text}
        </div>
      )}
      <div className="page-h stagger">{tl.overviewTitle}</div>
      <div className="page-sub stagger">{tl.overviewSub}</div>

      {/* Rate panel — admin only */}
      {isAdmin && settings && (
        <div className="reveal">
          <RatePanel
            lang={lang}
            currentRate={settings.daily_rate}
            rateSaved={rateSaved}
            onSave={handleSaveRate}
          />
        </div>
      )}

      {/* KPI cards */}
      <div className="stats stats-animate">
        <StatCard
          label={tl.occRate}
          value={`${occPct}%`}
          rawValue={occPct}
          suffix="%"
          sub={null}
          icon={Icons.gauge}
          color="var(--gold-deep)"
          bar={occPct}
          perf={occPerf(occPct)}
        />
        <StatCard
          label={tl.occupiedRooms}
          value={`${inHouse} / ${totalRooms}`}
          rawValue={inHouse}
          suffix={` / ${totalRooms}`}
          sub={tl.occupied_lab}
          icon={Icons.bed}
          color="var(--booked)"
          bar={null}
          perf={occPerf(occPct)}
        />
        <StatCard
          label={tl.arrivals}
          value={String(counts.arrivals || 0)}
          rawValue={counts.arrivals || 0}
          sub={null}
          icon={Icons.arrive}
          color="var(--info)"
          bar={null}
        />
        <StatCard
          label={tl.departuresLab}
          value={String(counts.checkout || 0)}
          rawValue={counts.checkout || 0}
          sub={null}
          icon={Icons.depart}
          color="var(--checkout)"
          bar={null}
        />
        <StatCard
          label={tl.revenue}
          value={fmtMoney(rev)}
          rawValue={Math.round(rev)}
          prefix="﷼ "
          sub={tl.revenueSub}
          icon={Icons.money}
          color="var(--free)"
          bar={null}
          perf={revPerf(rev)}
        />
        <StatCard
          label={tl.adr}
          value={fmtMoney(adr)}
          rawValue={Math.round(adr)}
          prefix="﷼ "
          sub={tl.adrSub}
          icon={Icons.chart}
          color="var(--cleaning)"
          bar={null}
          perf={adrPerf(adr)}
        />
        <StatCard
          label={tl.revpar}
          value={fmtMoney(revpar)}
          rawValue={Math.round(revpar)}
          prefix="﷼ "
          sub={tl.revparSub}
          icon={Icons.gauge}
          color="var(--info)"
          bar={null}
          perf={revPerf(revpar)}
        />
        <StatCard
          label={tl.avgStay}
          value={`${avgStay ? avgStay.toFixed(1) : '0'} ${tl.nightsShort}`}
          rawValue={Math.round(avgStay || 0)}
          suffix={` ${tl.nightsShort}`}
          sub={tl.avgStaySub}
          icon={Icons.timeline}
          color="var(--booked)"
          bar={null}
        />
      </div>

      {/* Donut charts side-by-side */}
      <div className="panels reveal">
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
      <div className="panels reveal" style={{ marginTop: 0 }}>
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
    </div>
  );
}
