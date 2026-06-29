/**
 * Pure date/booking helper functions ported exactly from
 * reference/Quba-Room-Board.html.
 *
 * Rules:
 * - NEVER use toISOString() for date keys — local-component math only.
 * - Always parse ISO dates as "YYYY-MM-DDT00:00:00" to avoid UTC offset bugs.
 */

import { T } from './i18n';
import type {
  Booking,
  Room,
  RoomStatus,
  BookingPhase,
  BookingSource,
} from './types';

// ---------------------------------------------------------------------------
// Zero-pad helper (private)
// ---------------------------------------------------------------------------
function z(n: number): string {
  return ('0' + n).slice(-2);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns "YYYY-MM-DD" for today in local time. */
export function localToday(): string {
  const d = new Date();
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

/**
 * "YYYY-MM-DD" → "D MonthName"  (e.g. "27 Jun" or "27 يونيو")
 * Returns "—" for null/empty input.
 */
export function fmtDate(iso: string | null, lang: 'ar' | 'en'): string {
  if (!iso) return '—';
  const p = iso.split('-');
  return parseInt(p[2], 10) + ' ' + T[lang].months[parseInt(p[1], 10) - 1];
}

/**
 * "YYYY-MM-DD" → "Weekday، D MonthName YYYY"
 * Returns "—" for null/empty input.
 */
export function fmtDateLong(iso: string | null, lang: 'ar' | 'en'): string {
  if (!iso) return '—';
  const p = iso.split('-');
  const wd = T[lang].wdays[weekdayOf(iso)];
  const sep = lang === 'ar' ? '، ' : ', ';
  return wd + sep + parseInt(p[2], 10) + ' ' + T[lang].months[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

/**
 * "HH:MM" → "H:MM AM/PM" (English) or "H:MM ص/م" (Arabic).
 * Mirrors the prototype's fmtTime function exactly.
 */
export function fmtTime(hhmm: string, lang: 'ar' | 'en'): string {
  const p = (hhmm || '').split(':');
  let h = parseInt(p[0], 10) || 0;
  const m = p[1] || '00';
  const ap = h < 12 ? T[lang].am : T[lang].pm;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + m + ' ' + ap;
}

/**
 * Number of days between two ISO dates (b − a).
 * Uses T00:00:00 parsing to avoid UTC offset bugs.
 */
export function diffDays(aISO: string, bISO: string): number {
  return Math.round(
    (new Date(bISO + 'T00:00:00').getTime() -
      new Date(aISO + 'T00:00:00').getTime()) /
      86400000,
  );
}

/** Add n days to an ISO date. Uses local component math. */
export function isoAdd(baseISO: string, n: number): string {
  const p = baseISO.split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

/** First day of the month for a given ISO date ("YYYY-MM-01"). */
export function monthFirst(iso: string): string {
  return iso.slice(0, 8) + '01';
}

/**
 * Number of days in the month that contains the given ISO date.
 * Uses local component math — never UTC.
 * new Date(year, month, 0) gives the last day of the previous month.
 */
export function daysInMonthOf(iso: string): number {
  const p = iso.split('-');
  return new Date(+p[0], +p[1], 0).getDate();
}

/** Shift month forward/back by n. Returns first day of resulting month. */
export function shiftMonth(iso: string, n: number): string {
  const p = iso.split('-');
  const d = new Date(+p[0], +p[1] - 1, 1);
  d.setMonth(d.getMonth() + n);
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-01';
}

/** Day of week (0=Sun … 6=Sat). Uses T00:00:00 to stay in local time. */
export function weekdayOf(iso: string): number {
  return new Date(iso + 'T00:00:00').getDay();
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a monetary amount. */
export function fmtMoney(n: number, lang: 'ar' | 'en'): string {
  const v = Number(n || 0).toLocaleString('en-US');
  return lang === 'ar' ? v + ' ريال' : 'SAR ' + v;
}

// ---------------------------------------------------------------------------
// Booking / occupancy helpers
// ---------------------------------------------------------------------------

/**
 * Count rooms occupied (check_in <= iso < check_out, not checked_out) on a date.
 * Mirrors prototype's occOnDate function.
 */
export function occOnDate(bookings: Booking[], iso: string): number {
  return bookings.filter(b => !b.checked_out && b.check_in <= iso && iso < b.check_out)
    .length;
}

/**
 * Booking phase relative to today.
 * - "past"     if checked_out OR check_out < today
 * - "upcoming" if check_in > today
 * - "current"  otherwise (in-house)
 */
export function bookingPhase(b: Booking, today: string): BookingPhase {
  if (b.checked_out || b.check_out < today) return 'past';
  if (b.check_in > today) return 'upcoming';
  return 'current';
}

/**
 * Room status logic (matches prototype's roomStatus):
 *   override > current booking (checkout/booked) > upcoming > empty
 *
 * A booking counts as "checkout" when check_out === today.
 * Upcoming bookings (check_in > today) yield "booked".
 */
export function roomStatus(
  room: Room,
  bookings: Booking[],
  today: string,
): RoomStatus {
  if (room.override) return room.override as RoomStatus;
  const cur = currentBooking(room.no, bookings, today);
  if (cur) return cur.check_out === today ? 'checkout' : 'booked';
  if (upcomingBooking(room.no, bookings, today)) return 'booked';
  return 'empty';
}

/**
 * Get the current active booking for a room:
 *   checked_out=false AND check_in <= today <= check_out
 */
export function currentBooking(
  roomNo: number,
  bookings: Booking[],
  today: string,
): Booking | null {
  return (
    bookings.find(
      b =>
        b.room_no === roomNo &&
        !b.checked_out &&
        b.check_in <= today &&
        today <= b.check_out,
    ) ?? null
  );
}

/**
 * Get the next upcoming booking (checked_out=false, check_in > today),
 * sorted ascending by check_in.
 */
export function upcomingBooking(
  roomNo: number,
  bookings: Booking[],
  today: string,
): Booking | null {
  const fut = bookings
    .filter(b => b.room_no === roomNo && !b.checked_out && b.check_in > today)
    .sort((a, b) => (a.check_in < b.check_in ? -1 : 1));
  return fut[0] ?? null;
}

/** Display booking: current booking first, then upcoming. */
export function displayBooking(
  roomNo: number,
  bookings: Booking[],
  today: string,
): Booking | null {
  return currentBooking(roomNo, bookings, today) ?? upcomingBooking(roomNo, bookings, today);
}

/**
 * Overlap check — returns true if [inD, outD) overlaps any existing
 * non-checked-out booking for roomNo (excluding exceptId).
 * Uses half-open interval: inD < other.check_out && other.check_in < outD
 */
export function hasOverlap(
  roomNo: number,
  inD: string,
  outD: string,
  bookings: Booking[],
  exceptId?: string,
): boolean {
  return bookings.some(
    b =>
      b.room_no === roomNo &&
      !b.checked_out &&
      b.id !== exceptId &&
      inD < b.check_out &&
      b.check_in < outD,
  );
}

/**
 * Expected booking total = nights × rate.
 * Uses diffDays (local math) to compute nights.
 */
export function bookingExpected(
  inD: string,
  outD: string,
  rate: number,
): number {
  if (!inD || !outD || rate <= 0) return 0;
  const nights = Math.max(0, diffDays(inD, outD));
  return nights > 0 ? nights * rate : 0;
}

/** Full phone string: "cc phone" trimmed. */
export function fullPhone(cc: string, phone: string): string {
  return ((cc ? cc + ' ' : '') + (phone || '')).trim();
}

// ---------------------------------------------------------------------------
// Color helpers (CSS variable strings)
// ---------------------------------------------------------------------------

/** Maps RoomStatus to the corresponding CSS variable. */
export function statusColor(status: RoomStatus): string {
  const map: Record<RoomStatus, string> = {
    empty: 'var(--free)',
    booked: 'var(--booked)',
    checkout: 'var(--checkout)',
    cleaning: 'var(--cleaning)',
    maintenance: 'var(--maint)',
  };
  return map[status] ?? 'var(--faint)';
}

/** Maps BookingSource to the corresponding CSS variable. */
export function sourceColor(source: BookingSource): string {
  const map: Record<BookingSource, string> = {
    direct: 'var(--gold)',
    airbnb: 'var(--checkout)',
    booking: 'var(--info)',
    gathern: 'var(--free)',
  };
  return map[source] ?? 'var(--faint)';
}

// ---------------------------------------------------------------------------
// Time options
// ---------------------------------------------------------------------------

/**
 * Generate 30-min time options as { value, label } array.
 * Covers 00:00 → 23:30 in 30-minute steps.
 * Labels are formatted with fmtTime (12h + AM/PM or ص/م).
 */
export function timeOptions(lang: 'ar' | 'en'): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let k = 0; k < 2; k++) {
      const value = z(h) + ':' + (k ? '30' : '00');
      opts.push({ value, label: fmtTime(value, lang) });
    }
  }
  return opts;
}
