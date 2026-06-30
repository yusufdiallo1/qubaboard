'use client';

/**
 * OverviewScreen — comprehensive analytics dashboard.
 * Rules:
 * - NEVER toISOString() for date keys — local-component math only.
 * - Real data only; zero baseline when no bookings.
 * - SVG hit-rects: fill="transparent" explicitly — never a CSS var.
 * - Charts use refs for hover state to avoid re-render flicker.
 * - Revenue/ADR/RevPAR hidden for staff (isAdmin guard).
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useReveal } from '@/lib/useReveal';
import { useAppState, useAppDispatch } from '@/lib/store';
import { StatsSkeleton, ChartSkeleton } from '@/components/Skeletons';
import { useCountUp } from '@/lib/useCountUp';
import {
  localToday,
  isoAdd,
  fmtDate,
  fmtMoney,
  diffDays,
  roomStatus,
  occOnDate,
} from '@/lib/helpers';
import type { Room, Booking, BookingSource, RoomStatus } from '@/lib/types';
import { T } from '@/lib/i18n';
import { saveSettings } from '@/lib/supabaseActions';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_ROOMS = 20;
const SOURCES: BookingSource[] = ['direct', 'airbnb', 'booking', 'gathern'];

// Fixed hex values — CSS vars don't work in SVG fill/stroke attributes
const SCOLOR_HEX: Record<RoomStatus, string> = {
  empty:       '#2FA36B',
  booked:      '#C6A253',
  checkout:    '#E0823C',
  cleaning:    '#7C6BB0',
  maintenance: '#CC4B4B',
};
const SCOLOR: Record<RoomStatus, string> = {
  empty:       'var(--free)',
  booked:      'var(--booked)',
  checkout:    'var(--checkout)',
  cleaning:    'var(--cleaning)',
  maintenance: 'var(--maint)',
};
const SRCCOLOR: Record<BookingSource, string> = {
  direct:  'var(--gold)',
  airbnb:  'var(--checkout)',
  booking: 'var(--info)',
  gathern: 'var(--free)',
};
const SRCCOLOR_HEX: Record<BookingSource, string> = {
  direct:  '#C6A253',
  airbnb:  '#E0823C',
  booking: '#5B8DD9',
  gathern: '#2FA36B',
};

type RangeOption = 7 | 14 | 30;
type OccFilter = 'alltime' | 'current' | 'last7' | 'lastmonth';

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (timezone-safe, no toISOString)
// ─────────────────────────────────────────────────────────────────────────────

function nightsBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, diffDays(a, b));
}

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

function floorOf(no: number): 1 | 2 { return no <= 10 ? 1 : 2; }

interface FloorStats { occ: number; total: number; pct: number; }

function floorOcc(rooms: Room[], bookings: Booking[], today: string, fl: 1 | 2): FloorStats {
  const rs = rooms.filter((r) => floorOf(r.no) === fl);
  const occ = rs.filter((r) => {
    const st = roomStatus(r, bookings, today);
    return st === 'booked' || st === 'checkout';
  }).length;
  return { occ, total: rs.length, pct: Math.round((occ / (rs.length || 1)) * 100) };
}

function niceMax(v: number): number {
  if (v === 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

// Period-over-period delta: positive = up, negative = down, 0 = flat
function delta(curr: number, prev: number): number {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return 100;
  return Math.round(((curr - prev) / prev) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flicker-free TrendChart — hover handled via refs + direct DOM, no setState
// ─────────────────────────────────────────────────────────────────────────────

interface TrendPoint { v: number; label: string; dayNum: number; }

interface TrendChartProps {
  series: TrendPoint[];
  color: string;       // hex only — used in SVG attributes
  areaColor: string;   // hex — area fill
  suffix: string;
}

function TrendChart({ series, color, areaColor, suffix }: TrendChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef<number>(-1);

  const W = 560; const H = 160; const PT = 16; const PB = 22; const PL = 36; const PR = 6;
  const n = Math.max(series.length, 1);

  const vals = series.map(p => p.v);
  const max = Math.max(...vals, 0);
  const yMax = niceMax(max);

  const X = (i: number) => PL + (W - PL - PR) * (n <= 1 ? 0.5 : i / (n - 1));
  const Y = (v: number) => max === 0 ? (H - PB) : PT + (H - PT - PB) * (1 - v / yMax);

  const pts = series.map((p, i) => ({ x: X(i), y: Y(p.v) }));
  const polyPts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const baseline = H - PB;
  const areaD = pts.length > 1
    ? `M${pts[0].x.toFixed(1)},${baseline} ` +
      pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L${pts[pts.length - 1].x.toFixed(1)},${baseline} Z`
    : '';

  const yTicks = max === 0
    ? [{ v: 0, y: Y(0) }]
    : [0, 0.5, 1].map(f => ({ v: Math.round(yMax * f), y: Y(yMax * f) }));

  const hitLeft  = (i: number) => i === 0 ? PL : (X(i - 1) + X(i)) / 2;
  const hitRight = (i: number) => i === n - 1 ? W : (X(i) + X(i + 1)) / 2;


  // Hover: SVG overlay for crosshair/highlight, HTML div for cursor-following tooltip
  const showOverlay = useCallback((i: number, clientX: number, clientY: number) => {
    activeIdxRef.current = i;
    const g = overlayRef.current;
    const tipEl = tipRef.current;
    const p = series[i];
    if (!p || !g) return;
    const cx = X(i);
    const cy = max > 0 ? Y(p.v) : baseline;
    const lx = hitLeft(i);
    const rx = hitRight(i);

    g.innerHTML = `
      <rect x="${lx.toFixed(1)}" y="${PT}" width="${Math.max(0, rx - lx).toFixed(1)}" height="${H - PT - PB}" fill="rgba(198,162,83,0.09)" rx="2"/>
      ${max > 0 ? `<line x1="${cx}" y1="${cy.toFixed(1)}" x2="${cx}" y2="${baseline}" stroke="rgba(198,162,83,0.35)" stroke-width="1" stroke-dasharray="3 3"/>` : ''}
      ${max > 0 ? `<circle cx="${cx}" cy="${cy.toFixed(1)}" r="5" fill="${color}" stroke="#0e1726" stroke-width="2"/>` : ''}
    `;
    g.style.display = 'block';

    if (tipEl) {
      tipEl.textContent = `${p.label}: ${p.v}${suffix}`;
      tipEl.style.display = 'block';
      // Auto-flip: if cursor is in right 40% of viewport, show tooltip to the left
      const tipW = tipEl.offsetWidth || 120;
      const flipLeft = clientX + tipW + 16 > window.innerWidth * 0.8;
      tipEl.style.left = flipLeft ? `${clientX - tipW - 8}px` : `${clientX + 10}px`;
      tipEl.style.top  = `${clientY + 7}px`;
    }
  }, [series, max, suffix, color]); // eslint-disable-line react-hooks/exhaustive-deps

  const hideOverlay = useCallback(() => {
    activeIdxRef.current = -1;
    const g = overlayRef.current;
    if (g) { g.innerHTML = ''; g.style.display = 'none'; }
    if (tipRef.current) tipRef.current.style.display = 'none';
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {/* Tooltip portal — rendered at body level to escape backdrop-filter stacking context */}
      {typeof document !== 'undefined' && createPortal(
        <div ref={tipRef} style={{
          display: 'none', position: 'fixed', zIndex: 9999, pointerEvents: 'none',
          background: '#c6a253', color: '#1b1407', borderRadius: 7,
          padding: '3px 9px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        }} />,
        document.body
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseLeave={hideOverlay}
      >
        {/* Grid lines */}
        {yTicks.map((tk, i) => (
          <g key={i}>
            <line x1={PL} y1={tk.y.toFixed(1)} x2={W - PR} y2={tk.y.toFixed(1)}
              stroke="rgba(128,128,128,0.15)" strokeWidth={i === 0 ? 1 : 0.7} />
            <text x={(PL - 5).toFixed(1)} y={(tk.y + 3.5).toFixed(1)}
              textAnchor="end" fontSize={8} fontWeight={600} fill="rgba(128,128,128,0.7)">
              {suffix === '%' ? `${tk.v}%` : tk.v === 0 ? '0' : `${(tk.v / 1000).toFixed(tk.v >= 1000 ? 0 : 1)}k`}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {max > 0 && <path d={areaD} fill={areaColor} opacity={0.13} />}

        {/* Zero baseline */}
        {max === 0 && (
          <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB}
            stroke={color} strokeWidth={1.5} strokeOpacity={0.3} strokeDasharray="4 5" />
        )}

        {/* Line */}
        {max > 0 && (
          <polyline
            points={polyPts} fill="none" stroke={color} strokeWidth={2.2}
            strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
            r={3.5} fill={color} stroke="#0e1726" strokeWidth={1.5} />
        ))}

        {/* Axis labels every other point */}
        {series.map((p, i) => (i % 2 === 0 || i === n - 1) && (
          <text key={i} x={X(i).toFixed(1)} y={H - 6}
            textAnchor="middle" fontSize={8.5} fontWeight={600} fill="rgba(128,128,128,0.7)">
            {p.dayNum}
          </text>
        ))}

        {/* Overlay group — written directly via innerHTML on hover */}
        <g ref={overlayRef} style={{ display: 'none' }} />

        {/* Transparent hit-rects — must be last so they're on top */}
        {series.map((_, i) => (
          <rect
            key={i}
            x={hitLeft(i).toFixed(1)} y={PT}
            width={Math.max(0, hitRight(i) - hitLeft(i)).toFixed(1)}
            height={H - PT - PB}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseEnter={(e) => showOverlay(i, e.clientX, e.clientY)}
            onMouseMove={(e) => showOverlay(i, e.clientX, e.clientY)}
            onMouseLeave={hideOverlay}
          />
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DonutChart — segments thicken on hover, tooltip via callback
// ─────────────────────────────────────────────────────────────────────────────

interface DonutSeg { v: number; c: string; chex: string; label: string; }

interface DonutProps {
  segs: DonutSeg[];
  centerTop: string;
  centerBot: string;
  onTip: (text: string, e: React.MouseEvent) => void;
  onTipHide: () => void;
}

function DonutChart({ segs, centerTop, centerBot, onTip, onTipHide }: DonutProps) {
  const r = 52;
  const C = 2 * Math.PI * r;
  const total = segs.reduce((s, x) => s + x.v, 0) || 1;
  let offset = 0;

  return (
    <svg viewBox="0 0 140 140" style={{ width: 150, height: 150, flex: 'none' }}>
      <circle cx={70} cy={70} r={r} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth={18} />
      {segs.map((s, idx) => {
        if (s.v <= 0) { return null; }
        const len = (s.v / total) * C;
        const dash = `${len.toFixed(2)} ${(C - len).toFixed(2)}`;
        const doffset = (C - offset).toFixed(2);
        offset += len;
        const pct = Math.round((s.v / total) * 100);
        const tipText = `${s.label}: ${s.v} (${pct}%)`;
        return (
          <circle
            key={idx}
            cx={70} cy={70} r={r}
            fill="none"
            stroke={s.chex}
            strokeWidth={18}
            strokeDasharray={dash}
            strokeDashoffset={doffset}
            transform="rotate(-90 70 70)"
            style={{ cursor: 'pointer', transition: 'stroke-width .15s' }}
            onMouseEnter={(e) => {
              (e.currentTarget as SVGCircleElement).style.strokeWidth = '25';
              onTip(tipText, e);
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as SVGCircleElement).style.strokeWidth = '18';
              onTipHide();
            }}
          />
        );
      })}
      <text x={70} y={64} textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 800, fill: 'var(--text)' }}>
        {centerTop}
      </text>
      <text x={70} y={82} textAnchor="middle"
        style={{ fontSize: 9, fontWeight: 700, fill: 'var(--faint)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
        {centerBot}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip hook (for donuts / bars — positioned near cursor)
// ─────────────────────────────────────────────────────────────────────────────

function useGlobalTip() {
  const [tip, setTip] = useState({ visible: false, text: '', x: 0, y: 0 });
  const show = useCallback((text: string, e: React.MouseEvent) => {
    setTip({ visible: true, text, x: e.clientX, y: e.clientY });
  }, []);
  const move = useCallback((e: React.MouseEvent) => {
    setTip(p => ({ ...p, x: e.clientX, y: e.clientY }));
  }, []);
  const hide = useCallback(() => setTip(p => ({ ...p, visible: false })), []);
  return { tip, show, move, hide };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delta chip — ▲ green / ▼ red / – neutral
// ─────────────────────────────────────────────────────────────────────────────

function DeltaChip({ curr, prev, tooltip }: { curr: number; prev: number; tooltip: string }) {
  const d = delta(curr, prev);
  if (curr === 0 && prev === 0) return null;
  const color = d > 0 ? '#2FA36B' : d < 0 ? '#CC4B4B' : '#888';
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '–';
  return (
    <span
      className="delta-chip"
      title={tooltip}
      style={{ color, background: `${color}18`, fontSize: 11, fontWeight: 700,
        padding: '2px 7px', borderRadius: 99, marginTop: 4, display: 'inline-block' }}
    >
      {arrow} {Math.abs(d)}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

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
  prevValue?: number;
  deltaTooltip?: string;
}

function StatCard({ label, value, rawValue, suffix, prefix, sub, icon, color, bar, prevValue, deltaTooltip }: StatCardProps) {
  const animated = useCountUp(rawValue ?? 0, 800);
  const displayValue = rawValue !== undefined
    ? `${prefix ?? ''}${animated.toLocaleString()}${suffix ?? ''}`
    : value;

  return (
    <div className="stat">
      <div className="sl">
        <span className="si" style={{ '--c': color } as React.CSSProperties}>{icon}</span>
        {label}
      </div>
      <div className="sv">{displayValue}</div>
      {prevValue !== undefined && rawValue !== undefined && deltaTooltip && (
        <DeltaChip curr={rawValue} prev={prevValue} tooltip={deltaTooltip} />
      )}
      {bar !== null && (
        <div className="sbar">
          <i style={{ width: `${bar}%`, background: color, display: 'block', height: '100%', borderRadius: 99, transition: 'width .6s' }} />
        </div>
      )}
      {sub && <div className="su">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Range switcher pill
// ─────────────────────────────────────────────────────────────────────────────

function RangeSwitcher({ range, onChange }: { range: RangeOption; onChange: (r: RangeOption) => void }) {
  const options: RangeOption[] = [7, 14, 30];
  return (
    <div className="range-sw">
      {options.map(o => (
        <button
          key={o}
          className={`range-btn${range === o ? ' on' : ''}`}
          onClick={() => onChange(o)}
        >
          {o}d
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Panel (admin only)
// ─────────────────────────────────────────────────────────────────────────────

function RatePanel({ lang, currentRate, rateSaved, onSave }: {
  lang: 'ar' | 'en'; currentRate: number; rateSaved: boolean; onSave: (r: number) => void;
}) {
  const tl = T[lang];
  const [value, setValue] = useState(String(currentRate));
  useEffect(() => { setValue(String(currentRate)); }, [currentRate]);

  return (
    <div className="panel rate-panel" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>{tl.rateTitle}</h3>
      <div className="rate-row">
        <span className="rate-cur">SAR</span>
        <input
          type="text" dir="ltr" inputMode="numeric" value={value}
          onChange={e => setValue(e.target.value)}
          style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 11, padding: '12px 14px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}
        />
        <button className={`btn-rate${rateSaved ? ' done' : ''}`} onClick={() => {
          const n = parseInt(value, 10);
          if (!isNaN(n) && n > 0) onSave(n);
        }}>
          {rateSaved ? (
            <span className="chk">
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'checkpop .35s cubic-bezier(.2,.9,.3,1.4) both' }}>
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
// Icons
// ─────────────────────────────────────────────────────────────────────────────

const Icons = {
  gauge: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 7.38 16.75"/><path d="M12 2A10 10 0 0 0 4.62 18.75"/><path d="M12 12l3.5-3.5"/><circle cx={12} cy={12} r={1}/></svg>,
  bed:   <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 9V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v5"/><path d="M2 20v-5a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v5"/><path d="M2 16h20"/></svg>,
  arrive:<svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  depart:<svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>,
  money: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={12} y1={1} x2={12} y2={23}/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  chart: <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={20} x2={18} y2={10}/><line x1={12} y1={20} x2={12} y2={4}/><line x1={6} y1={20} x2={6} y2={14}/></svg>,
  cal:   <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={4} width={18} height={18} rx={2} ry={2}/><line x1={16} y1={2} x2={16} y2={6}/><line x1={8} y1={2} x2={8} y2={6}/><line x1={3} y1={10} x2={21} y2={10}/></svg>,
  wrench:<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  broom: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l9-9"/><path d="M12.22 6.22L16 2l4 4-4.22 4.22"/><path d="M3.58 16.42L7 13l4 4-3.42 3.42"/><line x1={16} y1={8} x2={12} y2={12}/></svg>,
};

// ─────────────────────────────────────────────────────────────────────────────
// OccRateCard — occupancy rate with period filter chips
// ─────────────────────────────────────────────────────────────────────────────

const OCC_FILTERS: { key: OccFilter; ar: string; en: string }[] = [
  { key: 'current',   ar: 'الآن',     en: 'Current'  },
  { key: 'last7',     ar: 'آخر 7 أيام', en: 'Last 7 days' },
  { key: 'lastmonth', ar: 'آخر 30 يوم', en: 'Last 30 days' },
  { key: 'alltime',   ar: 'كل الوقت', en: 'All time' },
];

function OccRateCard({ occPct, prevOccPct, deltaLabel, lang }: {
  occPct: number; prevOccPct: number; deltaLabel: string; lang: 'ar' | 'en';
}) {
  const animated = useCountUp(occPct, 600);
  const d = delta(occPct, prevOccPct);
  const dColor = d > 0 ? '#2FA36B' : d < 0 ? '#CC4B4B' : '#888';
  const dArrow = d > 0 ? '▲' : d < 0 ? '▼' : '–';

  return (
    <div className="stat occ-rate-card">
      <div className="sl">
        <span className="si" style={{ '--c': 'var(--gold-deep)' } as React.CSSProperties}>{Icons.gauge}</span>
        {T[lang].occRate}
      </div>
      <div className="sv">{animated}%</div>
      <span title={deltaLabel} style={{
        color: dColor, background: `${dColor}18`, fontSize: 11, fontWeight: 700,
        padding: '2px 7px', borderRadius: 99, marginTop: 2, display: 'inline-block',
        visibility: d === 0 ? 'hidden' : 'visible',
      }}>
        {dArrow} {Math.abs(d)}%
      </span>
      <div className="sbar">
        <i style={{ width: `${occPct}%`, background: 'var(--gold-deep)', display: 'block', height: '100%', borderRadius: 99, transition: 'width .6s' }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main OverviewScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function OverviewScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { rooms, bookings, settings, user, lang, rateSaved, loading } = state;
  const tl = T[lang];
  const today = localToday();
  const isAdmin = user?.role === 'admin';
  const { tip, show: showTip, move: moveTip, hide: hideTip } = useGlobalTip();

  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<RangeOption>(14);
  const [occFilter, setOccFilter] = useState<OccFilter>('current');
  const pageRef = useReveal();

  useEffect(() => { setMounted(true); }, []);

  // ── Build date series for current and previous period ────────────────────
  const { currSeries, prevSeries } = useMemo(() => {
    const curr: string[] = [];
    const prev: string[] = [];
    for (let i = range - 1; i >= 0; i--) curr.push(isoAdd(today, -i));
    for (let i = range * 2 - 1; i >= range; i--) prev.push(isoAdd(today, -i));
    return { currSeries: curr, prevSeries: prev };
  }, [today, range]);

  // ── Today's stats ─────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = { empty: 0, booked: 0, checkout: 0, cleaning: 0, maintenance: 0, arrivals: 0, departures: 0 };
    rooms.forEach((r) => {
      const st = roomStatus(r, bookings, today);
      c[st] = (c[st] || 0) + 1;
      if (bookings.some(b => b.room_no === r.no && !b.checked_out && b.check_in === today)) c.arrivals++;
      if (bookings.some(b => b.room_no === r.no && !b.checked_out && b.check_out === today)) c.departures++;
    });
    return c;
  }, [rooms, bookings, today]);

  const totalRooms = rooms.length || TOTAL_ROOMS;
  const inHouse = (counts.booked || 0) + (counts.checkout || 0);
  // True in-house count: only rooms with check_in <= today < check_out (excludes upcoming)
  const inHouseToday = occOnDate(bookings, today) + (counts.checkout || 0);
  const occPct = Math.round((inHouseToday / totalRooms) * 100);

  // Occupancy filter: compute avg occupancy for the selected window
  const filteredOccPct = useMemo((): number => {
    try {
      if (occFilter === 'current') return occPct;
      const safe = (avg: number, n: number) => n > 0 ? Math.round((avg / n / totalRooms) * 100) : 0;
      if (occFilter === 'alltime') {
        if (bookings.length === 0) return 0;
        const earliest = bookings.reduce((m, b) => b.check_in < m ? b.check_in : m, today);
        const n = Math.min(Math.max(0, diffDays(earliest, today)), 1095);
        if (n === 0) return occPct;
        let sum = 0;
        for (let i = 0; i < n; i++) sum += occOnDate(bookings, isoAdd(earliest, i));
        return safe(sum, n);
      }
      if (occFilter === 'last7') {
        let sum = 0;
        for (let i = 6; i >= 0; i--) sum += occOnDate(bookings, isoAdd(today, -i));
        return safe(sum, 7);
      }
      if (occFilter === 'lastmonth') {
        let sum = 0;
        for (let i = 29; i >= 0; i--) sum += occOnDate(bookings, isoAdd(today, -i));
        return safe(sum, 30);
      }
      return occPct;
    } catch { return occPct; }
  }, [occFilter, occPct, bookings, today, totalRooms]);

  const rev = useMemo(() =>
    bookings.filter(b => !b.checked_out).reduce((s, b) => s + (Number(b.amount) || 0), 0),
  [bookings]);

  const adr = inHouseToday ? Math.round(rev / inHouseToday) : 0;
  const revpar = Math.round(rev / totalRooms);

  const stays = useMemo(() => bookings.map(b => nightsBetween(b.check_in, b.check_out)).filter(n => n > 0), [bookings]);
  const avgStay = stays.length ? stays.reduce((a, b) => a + b, 0) / stays.length : 0;

  // ── Period-over-period (previous range) ───────────────────────────────────
  const prevCounts = useMemo(() => {
    const startPrev = prevSeries[0];
    const endPrev = prevSeries[prevSeries.length - 1];
    let prevInHouse = 0, prevRev = 0;
    prevSeries.forEach(d => {
      prevInHouse += occOnDate(bookings, d);
    });
    prevInHouse = prevSeries.length ? Math.round(prevInHouse / prevSeries.length) : 0;
    prevSeries.forEach(d => { prevRev += revOnDate(bookings, d); });
    const prevOccPct = Math.round((prevInHouse / totalRooms) * 100);
    const prevArrivals = bookings.filter(b => b.check_in >= startPrev && b.check_in <= endPrev).length;
    const prevDepartures = bookings.filter(b => b.check_out >= startPrev && b.check_out <= endPrev).length;
    return { prevOccPct, prevInHouse, prevRev, prevArrivals, prevDepartures };
  }, [bookings, prevSeries, totalRooms]);

  // ── Trend series ──────────────────────────────────────────────────────────
  const occTrend: TrendPoint[] = useMemo(() =>
    currSeries.map(d => ({
      v: Math.round((occOnDate(bookings, d) / totalRooms) * 100),
      label: fmtDate(d, lang),
      dayNum: parseInt(d.split('-')[2], 10),
    })),
  [bookings, currSeries, totalRooms, lang]);

  const revTrend: TrendPoint[] = useMemo(() =>
    currSeries.map(d => ({
      v: revOnDate(bookings, d),
      label: fmtDate(d, lang),
      dayNum: parseInt(d.split('-')[2], 10),
    })),
  [bookings, currSeries, lang]);

  // ── Donuts ────────────────────────────────────────────────────────────────
  const occSegs: DonutSeg[] = [
    { v: inHouse,               c: 'var(--booked)',  chex: '#C6A253', label: tl.occupiedLeg },
    { v: counts.cleaning  || 0, c: 'var(--cleaning)',chex: '#7C6BB0', label: tl.cleaning },
    { v: counts.maintenance||0, c: 'var(--maint)',   chex: '#CC4B4B', label: tl.maintenance },
    { v: counts.empty     || 0, c: 'var(--free)',    chex: '#2FA36B', label: tl.empty },
  ];

  const srcCounts: Record<BookingSource, number> = { direct: 0, airbnb: 0, booking: 0, gathern: 0 };
  bookings.forEach(b => { const s = (b.source || 'direct') as BookingSource; srcCounts[s]++; });
  const totalBookings = bookings.length;

  const srcSegs: DonutSeg[] = SOURCES.map(sx => ({
    v: srcCounts[sx],
    c: SRCCOLOR[sx],
    chex: SRCCOLOR_HEX[sx],
    label: tl[`src_${sx}` as keyof typeof tl] as string,
  }));

  // ── Floor perf ────────────────────────────────────────────────────────────
  const fo1 = floorOcc(rooms, bookings, today, 1);
  const fo2 = floorOcc(rooms, bookings, today, 2);

  // ── Rooms needing attention ───────────────────────────────────────────────
  const attentionRooms = useMemo(() =>
    rooms.filter(r => {
      const st = roomStatus(r, bookings, today);
      return st === 'cleaning' || st === 'maintenance';
    }).map(r => ({ r, st: roomStatus(r, bookings, today) })),
  [rooms, bookings, today]);

  // ── Busiest next 7 days ───────────────────────────────────────────────────
  const next7: { day: string; label: string; occ: number; pct: number }[] = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = isoAdd(today, i + 1);
      const occ = occOnDate(bookings, d);
      return { day: d, label: fmtDate(d, lang), occ, pct: Math.round((occ / totalRooms) * 100) };
    }).sort((a, b) => b.occ - a.occ);
  }, [bookings, today, lang, totalRooms]);

  // ── Rate save ─────────────────────────────────────────────────────────────
  const handleSaveRate = useCallback(async (rate: number) => {
    if (!settings) return;
    const { error } = await saveSettings(rate);
    if (error) {
      const id = `rate-err-${Date.now()}`;
      dispatch({ type: 'PUSH_TOAST', payload: { id, message: String(error), variant: 'error' } });
      setTimeout(() => dispatch({ type: 'DISMISS_TOAST', payload: id }), 3500);
      return;
    }
    dispatch({ type: 'SET_SETTINGS', payload: { ...settings, daily_rate: rate } });
    dispatch({ type: 'SET_RATE_SAVED', payload: true });
    const okId = `rate-ok-${Date.now()}`;
    dispatch({ type: 'PUSH_TOAST', payload: { id: okId, message: lang === 'ar' ? 'تم حفظ السعر الليلي' : 'Nightly rate saved', variant: 'success' } });
    setTimeout(() => dispatch({ type: 'DISMISS_TOAST', payload: okId }), 2500);
    setTimeout(() => dispatch({ type: 'SET_RATE_SAVED', payload: false }), 2000);
  }, [settings, lang, dispatch]);

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (!mounted || loading || (rooms.length === 0 && bookings.length === 0)) {
    return (
      <div>
        <div className="page-h stagger" style={{ marginBottom: 18 }}>{tl.overviewTitle}</div>
        <StatsSkeleton count={8} />
        <div className="panels" style={{ marginTop: 14 }}>
          <ChartSkeleton h={160} /><ChartSkeleton h={160} />
        </div>
      </div>
    );
  }

  const deltaLabel = lang === 'ar'
    ? `مقارنة بـ ${range} يوماً سابقة`
    : `vs previous ${range} days`;

  return (
    <div ref={pageRef as React.RefObject<HTMLDivElement>}>
      {/* Global tooltip — portal to body to escape backdrop-filter stacking context */}
      {tip.visible && typeof document !== 'undefined' && createPortal(
        <div className="qtip show" style={{
          left: tip.x + (tip.x > window.innerWidth * 0.7 ? -(180) : 10),
          top: tip.y + 7, transform: 'none',
          position: 'fixed', zIndex: 9999, pointerEvents: 'none',
        }}>
          {tip.text}
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="ov-header">
        <div className="page-h stagger">{tl.overviewTitle}</div>
        <RangeSwitcher range={range} onChange={setRange} />
        <div className="ov-filter-group">
          <span className="occ-filter-label">{lang === 'ar' ? 'الإشغال:' : 'Occupancy:'}</span>
          <select
            value={occFilter}
            onChange={e => setOccFilter(e.target.value as OccFilter)}
            className="occ-select"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {OCC_FILTERS.map(f => (
              <option key={f.key} value={f.key}>{lang === 'ar' ? f.ar : f.en}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="page-sub stagger" style={{ marginBottom: 12 }}>{tl.overviewSub}</div>

      {/* ── KPI cards ── */}
      <div className="stats stats-animate">
        <OccRateCard
          occPct={filteredOccPct}
          prevOccPct={prevCounts.prevOccPct}
          deltaLabel={deltaLabel}
          lang={lang}
        />
        <StatCard
          label={tl.occupiedRooms} value={`${inHouseToday} / ${totalRooms}`}
          rawValue={inHouseToday} suffix={` / ${totalRooms}`} sub={tl.occupied_lab}
          icon={Icons.bed} color="var(--booked)" bar={null}
          prevValue={prevCounts.prevInHouse} deltaTooltip={deltaLabel}
        />
        <StatCard
          label={tl.arrivals} value={String(counts.arrivals || 0)} rawValue={counts.arrivals || 0}
          sub={null} icon={Icons.arrive} color="var(--info)" bar={null}
          prevValue={prevCounts.prevArrivals} deltaTooltip={deltaLabel}
        />
        <StatCard
          label={tl.departuresLab} value={String(counts.departures || 0)} rawValue={counts.departures || 0}
          sub={null} icon={Icons.depart} color="var(--checkout)" bar={null}
          prevValue={prevCounts.prevDepartures} deltaTooltip={deltaLabel}
        />
        {isAdmin && (
          <StatCard
            label={tl.revenue} value={fmtMoney(rev, lang)} rawValue={Math.round(rev)} prefix="﷼ "
            sub={tl.revenueSub} icon={Icons.money} color="var(--free)" bar={null}
            prevValue={Math.round(prevCounts.prevRev)} deltaTooltip={deltaLabel}
          />
        )}
        {isAdmin && (
          <StatCard
            label={tl.adr} value={fmtMoney(adr, lang)} rawValue={Math.round(adr)} prefix="﷼ "
            sub={tl.adrSub} icon={Icons.chart} color="var(--cleaning)" bar={null}
          />
        )}
        {isAdmin && (
          <StatCard
            label={tl.revpar} value={fmtMoney(revpar, lang)} rawValue={Math.round(revpar)} prefix="﷼ "
            sub={tl.revparSub} icon={Icons.gauge} color="var(--info)" bar={null}
          />
        )}
        <StatCard
          label={tl.avgStay}
          value={`${avgStay ? avgStay.toFixed(1) : '0'} ${tl.nightsShort}`}
          rawValue={Math.round(avgStay || 0)} suffix={` ${tl.nightsShort}`}
          sub={tl.avgStaySub} icon={Icons.cal} color="var(--booked)" bar={null}
        />
      </div>

      {/* ── Donuts ── */}
      <div className="panels reveal" style={{ marginTop: 14 }}>
        <div className="panel">
          <h3>{tl.occTitle}</h3>
          <div className="donut-wrap">
            <DonutChart segs={occSegs} centerTop={`${occPct}%`} centerBot={tl.occupiedLeg}
              onTip={showTip} onTipHide={hideTip} />
            <div className="dlegend">
              {occSegs.map(s => (
                <div key={s.label} className="li">
                  <span className="dot" style={{ '--c': s.c } as React.CSSProperties} />
                  {s.label}
                  <span className="lv">{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel">
          <h3>{tl.sourcesTitle}</h3>
          <div className="donut-wrap">
            <DonutChart segs={srcSegs} centerTop={String(totalBookings)} centerBot={tl.histBookings}
              onTip={showTip} onTipHide={hideTip} />
            <div className="dlegend">
              {SOURCES.map(sx => (
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

      {/* ── Trend charts ── */}
      <div className="panel wpanel reveal" style={{ marginTop: 14 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{lang === 'ar' ? `الإشغال (${range} يوم)` : `Occupancy (${range} days)`}</span>
        </h3>
        <TrendChart series={occTrend} color="#c6a253" areaColor="#c6a253" suffix="%" />
      </div>

      {isAdmin && (
        <div className="panel wpanel reveal" style={{ marginTop: 14 }}>
          <h3>{lang === 'ar' ? `الإيراد (${range} يوم)` : `Revenue (${range} days)`}</h3>
          <TrendChart series={revTrend} color="#2FA36B" areaColor="#2FA36B" suffix=" SAR" />
        </div>
      )}

      {/* ── Status bars + Floor bars ── */}
      <div className="panels reveal" style={{}}>
        <div className="panel">
          <h3>{tl.statusTitle}</h3>
          {([ ['empty', counts.empty||0, SCOLOR.empty, SCOLOR_HEX.empty],
              ['booked', counts.booked||0, SCOLOR.booked, SCOLOR_HEX.booked],
              ['checkout', counts.checkout||0, SCOLOR.checkout, SCOLOR_HEX.checkout],
              ['cleaning', counts.cleaning||0, SCOLOR.cleaning, SCOLOR_HEX.cleaning],
              ['maintenance', counts.maintenance||0, SCOLOR.maintenance, SCOLOR_HEX.maintenance],
          ] as [string, number, string, string][]).map(([key, count, color, hex]) => (
            <div key={key} className="bk-row"
              onMouseEnter={e => showTip(`${tl[key as keyof typeof tl]}: ${count}`, e)}
              onMouseMove={moveTip} onMouseLeave={hideTip}>
              <span className="bl">
                <span className="dot" style={{ '--c': color } as React.CSSProperties} />
                {tl[key as keyof typeof tl] as string}
              </span>
              <span className="bt">
                <i style={{ width: `${Math.round((count / totalRooms) * 100)}%`, background: hex, display: 'block', height: '100%', borderRadius: 99, transition: 'width .6s' }} />
              </span>
              <span className="bv">{count}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>{tl.floorTitle}</h3>
          {([
            [tl.floor1, fo1, '#c6a253'],
            [tl.floor2, fo2, '#5B8DD9'],
          ] as [string, FloorStats, string][]).map(([label, fo, hex]) => (
            <div key={label} className="bk-row"
              onMouseEnter={e => showTip(`${label}: ${fo.pct}%`, e)}
              onMouseMove={moveTip} onMouseLeave={hideTip}>
              <span className="bl">
                <span className="dot" style={{ background: hex, width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flexShrink: 0 } as React.CSSProperties} />
                {label}
                <i className="fnum">{fo.occ}/{fo.total}</i>
              </span>
              <span className="bt">
                <i style={{ width: `${fo.pct}%`, background: hex, display: 'block', height: '100%', borderRadius: 99, transition: 'width .6s' }} />
              </span>
              <span className="bv">{fo.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Attention + Upcoming ── */}
      <div className="panels reveal" style={{}}>
        {/* Rooms needing attention */}
        <div className="panel">
          <h3>{lang === 'ar' ? 'غرف تحتاج اهتمام' : 'Rooms needing attention'}</h3>
          {attentionRooms.length === 0 ? (
            <p className="attn-empty">
              {lang === 'ar' ? 'لا توجد غرف تحتاج اهتمام' : 'All rooms are in good shape'}
            </p>
          ) : (
            <div className="attn-list">
              {attentionRooms.map(({ r, st }) => (
                <div key={r.no} className="attn-row">
                  <span className={`attn-icon ${st === 'maintenance' ? 'maint' : 'clean'}`}>
                    {st === 'maintenance' ? Icons.wrench : Icons.broom}
                  </span>
                  <span className="attn-name">
                    {lang === 'ar' ? 'غرفة' : 'Room'} {r.no}
                  </span>
                  <span className="attn-status">
                    {tl[st as keyof typeof tl] as string}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Busiest upcoming 7 days */}
        <div className="panel">
          <h3>{lang === 'ar' ? 'أكثر الأيام إشغالاً (7 أيام)' : 'Busiest upcoming days (7d)'}</h3>
          <div className="busy-list">
            {next7.map(({ day, label, occ, pct }) => (
              <div key={day} className="bk-row"
                onMouseEnter={e => showTip(`${label}: ${pct}%`, e)}
                onMouseMove={moveTip} onMouseLeave={hideTip}>
                <span className="bl">{label}</span>
                <span className="bt">
                  <i className="busy-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="bv">{occ}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
