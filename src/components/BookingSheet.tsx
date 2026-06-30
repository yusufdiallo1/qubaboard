"use client";

/**
 * BookingSheet — glass bottom-sheet that opens when a room is tapped.
 *
 * Renders in three logical modes:
 *   VIEW   — displays guest info for an existing booking
 *   EDIT   — booking create/edit form with custom date-picker, CC picker, etc.
 *   (always) SET STATUS section for empty/cleaning/maintenance rooms
 *   (always) ROOM HISTORY section
 *   (admin + openFrom==="rooms") ROOM DETAILS section
 *
 * Uses CSS classes only (no Tailwind). All class names come from globals.css
 * which was ported verbatim from the reference prototype.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import { useAppState, useAppDispatch } from "@/lib/AppProvider";
import {
  localToday,
  fmtDate,
  fmtTime,
  diffDays,
  isoAdd,
  weekdayOf,
  bookingPhase,
  currentBooking,
  upcomingBooking,
  statusColor,
  bookingExpected,
  timeOptions,
  fmtMoney,
  fullPhone,
} from "@/lib/helpers";
import { T } from "@/lib/i18n";
import type {
  Booking,
  BookingForm,
  BookingSource,
  HistFilter,
  Room,
  RoomStatus,
} from "@/lib/types";
import {
  saveBooking,
  deleteBooking,
  checkoutBooking,
  setRoomOverride,
  saveRoomDetails,
} from "@/lib/supabaseActions";

// ---------------------------------------------------------------------------
// Country codes
// ---------------------------------------------------------------------------
const CC = [
  { f: "🇸🇦", d: "+966", n: "Saudi Arabia" },
  { f: "🇦🇪", d: "+971", n: "UAE" },
  { f: "🇰🇼", d: "+965", n: "Kuwait" },
  { f: "🇶🇦", d: "+974", n: "Qatar" },
  { f: "🇧🇭", d: "+973", n: "Bahrain" },
  { f: "🇴🇲", d: "+968", n: "Oman" },
  { f: "🇪🇬", d: "+20", n: "Egypt" },
  { f: "🇯🇴", d: "+962", n: "Jordan" },
  { f: "🇾🇪", d: "+967", n: "Yemen" },
  { f: "🇸🇩", d: "+249", n: "Sudan" },
  { f: "🇵🇰", d: "+92", n: "Pakistan" },
  { f: "🇮🇳", d: "+91", n: "India" },
  { f: "🇧🇩", d: "+880", n: "Bangladesh" },
  { f: "🇮🇩", d: "+62", n: "Indonesia" },
  { f: "🇲🇾", d: "+60", n: "Malaysia" },
  { f: "🇵🇭", d: "+63", n: "Philippines" },
  { f: "🇹🇷", d: "+90", n: "Türkiye" },
  { f: "🇳🇬", d: "+234", n: "Nigeria" },
  { f: "🇦🇫", d: "+93", n: "Afghanistan" },
  { f: "🇦🇱", d: "+355", n: "Albania" },
  { f: "🇩🇿", d: "+213", n: "Algeria" },
  { f: "🇦🇩", d: "+376", n: "Andorra" },
  { f: "🇦🇴", d: "+244", n: "Angola" },
  { f: "🇦🇬", d: "+1", n: "Antigua & Barbuda" },
  { f: "🇦🇷", d: "+54", n: "Argentina" },
  { f: "🇦🇲", d: "+374", n: "Armenia" },
  { f: "🇦🇺", d: "+61", n: "Australia" },
  { f: "🇦🇹", d: "+43", n: "Austria" },
  { f: "🇦🇿", d: "+994", n: "Azerbaijan" },
  { f: "🇧🇸", d: "+1", n: "Bahamas" },
  { f: "🇧🇧", d: "+1", n: "Barbados" },
  { f: "🇧🇾", d: "+375", n: "Belarus" },
  { f: "🇧🇪", d: "+32", n: "Belgium" },
  { f: "🇧🇿", d: "+501", n: "Belize" },
  { f: "🇧🇯", d: "+229", n: "Benin" },
  { f: "🇧🇹", d: "+975", n: "Bhutan" },
  { f: "🇧🇴", d: "+591", n: "Bolivia" },
  { f: "🇧🇦", d: "+387", n: "Bosnia & Herzegovina" },
  { f: "🇧🇼", d: "+267", n: "Botswana" },
  { f: "🇧🇷", d: "+55", n: "Brazil" },
  { f: "🇧🇳", d: "+673", n: "Brunei" },
  { f: "🇧🇬", d: "+359", n: "Bulgaria" },
  { f: "🇧🇫", d: "+226", n: "Burkina Faso" },
  { f: "🇧🇮", d: "+257", n: "Burundi" },
  { f: "🇰🇭", d: "+855", n: "Cambodia" },
  { f: "🇨🇲", d: "+237", n: "Cameroon" },
  { f: "🇨🇦", d: "+1", n: "Canada" },
  { f: "🇨🇻", d: "+238", n: "Cape Verde" },
  { f: "🇨🇫", d: "+236", n: "Central African Rep." },
  { f: "🇹🇩", d: "+235", n: "Chad" },
  { f: "🇨🇱", d: "+56", n: "Chile" },
  { f: "🇨🇳", d: "+86", n: "China" },
  { f: "🇨🇴", d: "+57", n: "Colombia" },
  { f: "🇰🇲", d: "+269", n: "Comoros" },
  { f: "🇨🇬", d: "+242", n: "Congo" },
  { f: "🇨🇩", d: "+243", n: "Congo (DRC)" },
  { f: "🇨🇷", d: "+506", n: "Costa Rica" },
  { f: "🇨🇮", d: "+225", n: "Côte d'Ivoire" },
  { f: "🇭🇷", d: "+385", n: "Croatia" },
  { f: "🇨🇺", d: "+53", n: "Cuba" },
  { f: "🇨🇾", d: "+357", n: "Cyprus" },
  { f: "🇨🇿", d: "+420", n: "Czechia" },
  { f: "🇩🇰", d: "+45", n: "Denmark" },
  { f: "🇩🇯", d: "+253", n: "Djibouti" },
  { f: "🇩🇲", d: "+1", n: "Dominica" },
  { f: "🇩🇴", d: "+1", n: "Dominican Republic" },
  { f: "🇪🇨", d: "+593", n: "Ecuador" },
  { f: "🇸🇻", d: "+503", n: "El Salvador" },
  { f: "🇬🇶", d: "+240", n: "Equatorial Guinea" },
  { f: "🇪🇷", d: "+291", n: "Eritrea" },
  { f: "🇪🇪", d: "+372", n: "Estonia" },
  { f: "🇸🇿", d: "+268", n: "Eswatini" },
  { f: "🇪🇹", d: "+251", n: "Ethiopia" },
  { f: "🇫🇯", d: "+679", n: "Fiji" },
  { f: "🇫🇮", d: "+358", n: "Finland" },
  { f: "🇫🇷", d: "+33", n: "France" },
  { f: "🇬🇦", d: "+241", n: "Gabon" },
  { f: "🇬🇲", d: "+220", n: "Gambia" },
  { f: "🇬🇪", d: "+995", n: "Georgia" },
  { f: "🇩🇪", d: "+49", n: "Germany" },
  { f: "🇬🇭", d: "+233", n: "Ghana" },
  { f: "🇬🇷", d: "+30", n: "Greece" },
  { f: "🇬🇩", d: "+1", n: "Grenada" },
  { f: "🇬🇹", d: "+502", n: "Guatemala" },
  { f: "🇬🇳", d: "+224", n: "Guinea" },
  { f: "🇬🇼", d: "+245", n: "Guinea-Bissau" },
  { f: "🇬🇾", d: "+592", n: "Guyana" },
  { f: "🇭🇹", d: "+509", n: "Haiti" },
  { f: "🇭🇳", d: "+504", n: "Honduras" },
  { f: "🇭🇰", d: "+852", n: "Hong Kong" },
  { f: "🇭🇺", d: "+36", n: "Hungary" },
  { f: "🇮🇸", d: "+354", n: "Iceland" },
  { f: "🇮🇷", d: "+98", n: "Iran" },
  { f: "🇮🇶", d: "+964", n: "Iraq" },
  { f: "🇮🇪", d: "+353", n: "Ireland" },
  { f: "🇮🇱", d: "+972", n: "Israel" },
  { f: "🇮🇹", d: "+39", n: "Italy" },
  { f: "🇯🇲", d: "+1", n: "Jamaica" },
  { f: "🇯🇵", d: "+81", n: "Japan" },
  { f: "🇰🇿", d: "+7", n: "Kazakhstan" },
  { f: "🇰🇪", d: "+254", n: "Kenya" },
  { f: "🇰🇮", d: "+686", n: "Kiribati" },
  { f: "🇰🇬", d: "+996", n: "Kyrgyzstan" },
  { f: "🇱🇦", d: "+856", n: "Laos" },
  { f: "🇱🇻", d: "+371", n: "Latvia" },
  { f: "🇱🇧", d: "+961", n: "Lebanon" },
  { f: "🇱🇸", d: "+266", n: "Lesotho" },
  { f: "🇱🇷", d: "+231", n: "Liberia" },
  { f: "🇱🇾", d: "+218", n: "Libya" },
  { f: "🇱🇮", d: "+423", n: "Liechtenstein" },
  { f: "🇱🇹", d: "+370", n: "Lithuania" },
  { f: "🇱🇺", d: "+352", n: "Luxembourg" },
  { f: "🇲🇴", d: "+853", n: "Macau" },
  { f: "🇲🇬", d: "+261", n: "Madagascar" },
  { f: "🇲🇼", d: "+265", n: "Malawi" },
  { f: "🇲🇻", d: "+960", n: "Maldives" },
  { f: "🇲🇱", d: "+223", n: "Mali" },
  { f: "🇲🇹", d: "+356", n: "Malta" },
  { f: "🇲🇭", d: "+692", n: "Marshall Islands" },
  { f: "🇲🇷", d: "+222", n: "Mauritania" },
  { f: "🇲🇺", d: "+230", n: "Mauritius" },
  { f: "🇲🇽", d: "+52", n: "Mexico" },
  { f: "🇫🇲", d: "+691", n: "Micronesia" },
  { f: "🇲🇩", d: "+373", n: "Moldova" },
  { f: "🇲🇨", d: "+377", n: "Monaco" },
  { f: "🇲🇳", d: "+976", n: "Mongolia" },
  { f: "🇲🇪", d: "+382", n: "Montenegro" },
  { f: "🇲🇦", d: "+212", n: "Morocco" },
  { f: "🇲🇿", d: "+258", n: "Mozambique" },
  { f: "🇲🇲", d: "+95", n: "Myanmar" },
  { f: "🇳🇦", d: "+264", n: "Namibia" },
  { f: "🇳🇷", d: "+674", n: "Nauru" },
  { f: "🇳🇵", d: "+977", n: "Nepal" },
  { f: "🇳🇱", d: "+31", n: "Netherlands" },
  { f: "🇳🇿", d: "+64", n: "New Zealand" },
  { f: "🇳🇮", d: "+505", n: "Nicaragua" },
  { f: "🇳🇪", d: "+227", n: "Niger" },
  { f: "🇰🇵", d: "+850", n: "North Korea" },
  { f: "🇲🇰", d: "+389", n: "North Macedonia" },
  { f: "🇳🇴", d: "+47", n: "Norway" },
  { f: "🇵🇼", d: "+680", n: "Palau" },
  { f: "🇵🇸", d: "+970", n: "Palestine" },
  { f: "🇵🇦", d: "+507", n: "Panama" },
  { f: "🇵🇬", d: "+675", n: "Papua New Guinea" },
  { f: "🇵🇾", d: "+595", n: "Paraguay" },
  { f: "🇵🇪", d: "+51", n: "Peru" },
  { f: "🇵🇱", d: "+48", n: "Poland" },
  { f: "🇵🇹", d: "+351", n: "Portugal" },
  { f: "🇷🇴", d: "+40", n: "Romania" },
  { f: "🇷🇺", d: "+7", n: "Russia" },
  { f: "🇷🇼", d: "+250", n: "Rwanda" },
  { f: "🇰🇳", d: "+1", n: "St Kitts & Nevis" },
  { f: "🇱🇨", d: "+1", n: "St Lucia" },
  { f: "🇻🇨", d: "+1", n: "St Vincent" },
  { f: "🇼🇸", d: "+685", n: "Samoa" },
  { f: "🇸🇲", d: "+378", n: "San Marino" },
  { f: "🇸🇹", d: "+239", n: "São Tomé & Príncipe" },
  { f: "🇸🇳", d: "+221", n: "Senegal" },
  { f: "🇷🇸", d: "+381", n: "Serbia" },
  { f: "🇸🇨", d: "+248", n: "Seychelles" },
  { f: "🇸🇱", d: "+232", n: "Sierra Leone" },
  { f: "🇸🇬", d: "+65", n: "Singapore" },
  { f: "🇸🇰", d: "+421", n: "Slovakia" },
  { f: "🇸🇮", d: "+386", n: "Slovenia" },
  { f: "🇸🇧", d: "+677", n: "Solomon Islands" },
  { f: "🇸🇴", d: "+252", n: "Somalia" },
  { f: "🇿🇦", d: "+27", n: "South Africa" },
  { f: "🇰🇷", d: "+82", n: "South Korea" },
  { f: "🇸🇸", d: "+211", n: "South Sudan" },
  { f: "🇪🇸", d: "+34", n: "Spain" },
  { f: "🇱🇰", d: "+94", n: "Sri Lanka" },
  { f: "🇸🇷", d: "+597", n: "Suriname" },
  { f: "🇸🇪", d: "+46", n: "Sweden" },
  { f: "🇨🇭", d: "+41", n: "Switzerland" },
  { f: "🇸🇾", d: "+963", n: "Syria" },
  { f: "🇹🇼", d: "+886", n: "Taiwan" },
  { f: "🇹🇯", d: "+992", n: "Tajikistan" },
  { f: "🇹🇿", d: "+255", n: "Tanzania" },
  { f: "🇹🇭", d: "+66", n: "Thailand" },
  { f: "🇹🇱", d: "+670", n: "Timor-Leste" },
  { f: "🇹🇬", d: "+228", n: "Togo" },
  { f: "🇹🇴", d: "+676", n: "Tonga" },
  { f: "🇹🇹", d: "+1", n: "Trinidad & Tobago" },
  { f: "🇹🇳", d: "+216", n: "Tunisia" },
  { f: "🇹🇲", d: "+993", n: "Turkmenistan" },
  { f: "🇹🇻", d: "+688", n: "Tuvalu" },
  { f: "🇺🇬", d: "+256", n: "Uganda" },
  { f: "🇺🇦", d: "+380", n: "Ukraine" },
  { f: "🇬🇧", d: "+44", n: "United Kingdom" },
  { f: "🇺🇸", d: "+1", n: "United States" },
  { f: "🇺🇾", d: "+598", n: "Uruguay" },
  { f: "🇺🇿", d: "+998", n: "Uzbekistan" },
  { f: "🇻🇺", d: "+678", n: "Vanuatu" },
  { f: "🇻🇪", d: "+58", n: "Venezuela" },
  { f: "🇻🇳", d: "+84", n: "Vietnam" },
  { f: "🇿🇲", d: "+260", n: "Zambia" },
  { f: "🇿🇼", d: "+263", n: "Zimbabwe" },
];

const PRESET_SOURCES = ["direct", "airbnb", "booking", "gathern"];
const SETOPTS: Array<"empty" | "cleaning" | "maintenance"> = [
  "empty",
  "cleaning",
  "maintenance",
];

// ---------------------------------------------------------------------------
// SVG icons (inline — same SVGs as the reference prototype)
// ---------------------------------------------------------------------------
const IUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
  </svg>
);
const IPhone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L17 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 1-2z"
      strokeLinejoin="round"
    />
  </svg>
);
const IArrive = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      d="M12 3v12M7 10l5 5 5-5M5 21h14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IDepart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      d="M12 15V3M7 8l5-5 5 5M5 21h14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IMoney = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9v6M18 9v6" strokeLinecap="round" />
  </svg>
);
const IGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path
      d="M3 12h18M12 3c2.6 2.5 2.6 15.5 0 18M12 3c-2.6 2.5-2.6 15.5 0 18"
      strokeLinecap="round"
    />
  </svg>
);
const IWarn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path d="M12 3l9 16H3z" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
  </svg>
);
const INote = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      d="M5 3.5h10l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 20V5a1.5 1.5 0 0 1 1.5-1.5z"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 3.5V8h4.5M8 13h8M8 16.5h5"
      strokeLinecap="round"
    />
  </svg>
);
const IWrench = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
    <path
      d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.4L5 15.8 8.2 19l4.9-4.9a3.5 3.5 0 0 0 4.4-4.6l-2 2-2.1-2.1z"
      strokeLinejoin="round"
    />
  </svg>
);
const ICal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="4.5" width="18" height="16" rx="3" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
  </svg>
);
const IChev = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IChevL = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IChevR = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);
const IBed = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path
      d="M3 7v12M3 13h18v6M21 19v-6a3 3 0 0 0-3-3H9v3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);


// ---------------------------------------------------------------------------
// Custom Date Picker
// ---------------------------------------------------------------------------
interface DatePickerProps {
  which: "in" | "out";
  selectedDate: string | null;
  minDate?: string | null;
  dpMonth: string;
  lang: "ar" | "en";
  onPickDate: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function DatePicker({
  which,
  selectedDate,
  minDate,
  dpMonth,
  lang,
  onPickDate,
  onPrevMonth,
  onNextMonth,
}: DatePickerProps) {
  const today = localToday();
  const parts = dpMonth.split("-");
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const dim = new Date(y, m, 0).getDate(); // days in month
  const fw = weekdayOf(dpMonth); // first weekday (0=Sun..6=Sat)
  const months = T[lang].months as unknown as string[];
  const wmin = T[lang].wmin as unknown as string[];

  const days: React.ReactNode[] = [];
  // blank cells before first day
  for (let i = 0; i < fw; i++) {
    days.push(<span key={`b${i}`} className="dp-day blank" />);
  }
  for (let d = 1; d <= dim; d++) {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const iso = `${y}-${mm}-${dd}`;
    const isPast = iso < today;
    const isTooEarly = which === "out" && minDate != null && iso <= minDate;
    const muted = isPast || isTooEarly;
    let cls = "dp-day";
    if (iso === today) cls += " today";
    if (iso === selectedDate) cls += " sel";
    if (muted) cls += " muted";
    days.push(
      <button
        key={iso}
        className={cls}
        disabled={muted}
        onClick={() => !muted && onPickDate(iso)}
        type="button"
      >
        {d}
      </button>
    );
  }

  return (
    <div className="dp">
      <div className="dp-top">
        <button type="button" onClick={onPrevMonth}>
          <IChevL />
        </button>
        <b>
          {months[m - 1]} {y}
        </b>
        <button type="button" onClick={onNextMonth}>
          <IChevR />
        </button>
      </div>
      <div className="dp-wd">
        {wmin.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="dp-days">{days}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function BookingSheet() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const {
    open: roomNo,
    rooms,
    bookings,
    settings,
    user,
    lang,
    editing,
    form,
    dpOpen,
    dpMonth,
    ccOpen,
    ccSearch,
    openBookingId,
    newBookingDate,
    sheetError,
    openFrom,
    histFilter,
    maintEntry,
    maintErr,
  } = state;

  // ---- Local state that doesn't need to be in the global store ----
  const [isSaving, setIsSaving] = useState(false);
  const [localMaintIssue, setLocalMaintIssue] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [confirm, setConfirm] = useState<{ action: () => void; label: string } | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ----  Translation helper ----
  const tl = useCallback(
    (key: string) => {
      const dict = T[lang] as Record<string, unknown>;
      const val = dict[key] ?? (T.en as Record<string, unknown>)[key] ?? key;
      if (Array.isArray(val)) return (val as string[]).join(", ");
      return val as string;
    },
    [lang]
  );

  const today = localToday();

  // ---- Room & booking resolution ----
  const room = rooms.find((r) => r.no === roomNo) ?? null;

  const curBooking = roomNo != null ? currentBooking(roomNo, bookings, today) : null;
  const upcomingBk = roomNo != null ? upcomingBooking(roomNo, bookings, today) : null;

  // The booking we focus on: if a specific bookingId was requested, use that;
  // otherwise use current, then upcoming.
  const focusedBooking: Booking | null = (() => {
    if (openBookingId) {
      return bookings.find((b) => b.id === openBookingId) ?? null;
    }
    return curBooking ?? upcomingBk;
  })();

  // Compute the "display status" for the sheet header. When creating a new
  // booking the pill shows "New booking".
  const creating = editing && openBookingId == null;

  // The actual room status: override > current > upcoming > empty
  const ds: RoomStatus = (() => {
    if (!room) return "empty";
    if (room.override) return room.override as RoomStatus;
    if (curBooking) return curBooking.check_out === today ? "checkout" : "booked";
    if (upcomingBk) return "booked";
    return "empty";
  })();

  // The focused booking's status (if we're viewing a specific booking)
  const focusStatus: RoomStatus = (() => {
    if (openBookingId && focusedBooking) {
      if (focusedBooking.checked_out) return "empty";
      if (
        focusedBooking.check_in <= today &&
        today <= focusedBooking.check_out
      ) {
        return focusedBooking.check_out === today ? "checkout" : "booked";
      }
      return "booked";
    }
    return ds;
  })();

  const headLabel = creating ? tl("newBooking") : tl(focusStatus);
  const headColor = creating ? "var(--booked)" : statusColor(focusStatus);

  // ---- Toast helper — dispatch to global store ----
  const showToast = useCallback((msg: string, variant: "success" | "error" | "info" = "info") => {
    const id = `bs-${Date.now()}`;
    dispatch({ type: "PUSH_TOAST", payload: { id, message: msg, variant } });
    setTimeout(() => dispatch({ type: "DISMISS_TOAST", payload: id }), 3000);
  }, [dispatch]);

  // ---- Initialise form when editing starts ----
  useEffect(() => {
    if (!editing || form !== null || roomNo == null) return;
    const g = focusedBooking;
    const ci = newBookingDate ?? (g ? g.check_in : today);
    const co = g ? g.check_out : isoAdd(ci, 1);
    const rate = settings?.daily_rate ?? 0;
    const nights = Math.max(0, diffDays(ci, co));
    const autoAmt = rate > 0 && nights > 0 ? String(rate * nights) : "";
    const initForm: BookingForm = {
      name: g?.guest_name ?? "",
      cc: g?.cc ?? "+966",
      phone: g?.phone ?? "",
      inDate: ci,
      outDate: co,
      inTime: g?.check_in_time ?? "15:00",
      outTime: g?.check_out_time ?? "12:00",
      source: g?.source ?? "direct",
      amount: g?.amount != null ? String(g.amount) : autoAmt,
      amountAuto: g == null,
      reason: g?.reason ?? "",
    };
    dispatch({ type: "SET_FORM", payload: initForm });
    // Set initial dp month
    dispatch({
      type: "SET_DP_MONTH",
      payload: ci.slice(0, 8) + "01",
    });
  }, [editing, form, roomNo, focusedBooking, newBookingDate, today, settings, dispatch]);

  // ---- Sync localMaintIssue when maintEntry changes ----
  useEffect(() => {
    if (maintEntry === roomNo && room) {
      setLocalMaintIssue(room.issue ?? "");
    }
  }, [maintEntry, roomNo, room]);

  // ---- Sync localDesc when room details section is visible ----
  useEffect(() => {
    if (room && openFrom === "rooms" && user?.role === "admin") {
      setLocalDesc(room.description ?? "");
      setPhotoPreview(null);
      setPhotoFile(null);
      setDetailsSaved(false);
    }
  }, [room, openFrom, user?.role]);

  // ---- Recalculate amount when dates change ----
  useEffect(() => {
    if (!form?.amountAuto || !settings?.daily_rate) return;
    if (!form.inDate || !form.outDate) return;
    const nights = Math.max(0, diffDays(form.inDate, form.outDate));
    const newAmt = nights > 0 ? String(settings.daily_rate * nights) : "";
    if (newAmt !== form.amount) {
      dispatch({ type: "UPDATE_FORM", payload: { amount: newAmt } });
    }
  }, [form?.inDate, form?.outDate, form?.amountAuto, settings?.daily_rate, form?.amount, dispatch]);

  // ---- Close handlers ----
  const closeSheet = useCallback(() => {
    dispatch({ type: "CLOSE_SHEET" });
  }, [dispatch]);

  const handleBackdropClick = useCallback(() => {
    closeSheet();
  }, [closeSheet]);

  const stopPropagation = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  // ---- EDIT form field changes ----
  const updateField = useCallback(
    (patch: Partial<BookingForm>) => {
      dispatch({ type: "UPDATE_FORM", payload: patch });
    },
    [dispatch]
  );

  const handleAmountChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      updateField({ amount: e.target.value, amountAuto: false });
    },
    [updateField]
  );

  // ---- Date picker ----
  const openDp = useCallback(
    (which: "in" | "out") => {
      const currentSel = which === "in" ? form?.inDate : form?.outDate;
      const anchor = currentSel ?? today;
      dispatch({ type: "SET_DP_OPEN", payload: which });
      dispatch({ type: "SET_DP_MONTH", payload: anchor.slice(0, 8) + "01" });
    },
    [form, today, dispatch]
  );

  const handleDpPick = useCallback(
    (iso: string) => {
      if (dpOpen === "in") {
        updateField({ inDate: iso, amountAuto: form?.amountAuto ?? true });
        // If out <= in, push out to in+1
        if (form?.outDate && form.outDate <= iso) {
          updateField({ outDate: isoAdd(iso, 1) });
        }
      } else if (dpOpen === "out") {
        updateField({ outDate: iso });
      }
      dispatch({ type: "SET_DP_OPEN", payload: null });
    },
    [dpOpen, form, updateField, dispatch]
  );

  const shiftDpMonth = useCallback(
    (n: number) => {
      if (!dpMonth) return;
      const p = dpMonth.split("-");
      const d = new Date(+p[0], +p[1] - 1, 1);
      d.setMonth(d.getMonth() + n);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      dispatch({
        type: "SET_DP_MONTH",
        payload: `${d.getFullYear()}-${mm}-01`,
      });
    },
    [dpMonth, dispatch]
  );

  // ---- Country code picker ----
  const toggleCc = useCallback(() => {
    dispatch({ type: "SET_CC_OPEN", payload: !ccOpen });
    dispatch({ type: "SET_CC_SEARCH", payload: "" });
  }, [ccOpen, dispatch]);

  const pickCc = useCallback(
    (code: string) => {
      updateField({ cc: code });
      dispatch({ type: "SET_CC_OPEN", payload: false });
    },
    [updateField, dispatch]
  );

  // ---- Save booking ----
  const handleSave = useCallback(async () => {
    if (!form || roomNo == null || !user) return;
    if (!form.inDate || !form.outDate) {
      dispatch({ type: "SET_MAINT_ERR", payload: tl("dateErr") });
      return;
    }
    if (form.inDate >= form.outDate) {
      dispatch({ type: "SET_MAINT_ERR", payload: tl("dateErr") });
      return;
    }

    setIsSaving(true);
    const rate = settings?.daily_rate ?? 0;
    const result = await saveBooking(
      form,
      roomNo,
      rate,
      user.id,
      openBookingId ?? undefined
    );
    setIsSaving(false);

    if (result.error) {
      // Show the error message as sheetError
      dispatch({ type: "SET_MAINT_ERR", payload: result.error });
      return;
    }

    if (result.booking) {
      dispatch({ type: "UPSERT_BOOKING", payload: result.booking });
    }
    dispatch({ type: "SET_EDITING", payload: false });
    dispatch({ type: "SET_FORM", payload: null });
    showToast(openBookingId ? tl("bookingEdited") : tl("bookingCreated"), "success");
  }, [form, roomNo, user, settings, openBookingId, tl, showToast, dispatch]);

  // ---- Cancel edit ----
  const handleCancelEdit = useCallback(() => {
    dispatch({ type: "SET_EDITING", payload: false });
    dispatch({ type: "SET_FORM", payload: null });
    dispatch({ type: "SET_DP_OPEN", payload: null });
    dispatch({ type: "SET_CC_OPEN", payload: false });
  }, [dispatch]);

  // ---- Checkout ----
  const doCheckout = useCallback(
    async (bookingId: string) => {
      if (roomNo == null) return;
      setIsSaving(true);
      const result = await checkoutBooking(bookingId, roomNo);
      setIsSaving(false);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      dispatch({
        type: "UPSERT_BOOKING",
        payload: {
          ...(bookings.find((b) => b.id === bookingId) as Booking),
          checked_out: true,
        },
      });
      dispatch({
        type: "UPDATE_ROOM",
        payload: { no: roomNo, override: "cleaning", issue: "" },
      });
      showToast(tl("nowCleaning"));
    },
    [roomNo, bookings, tl, showToast, dispatch]
  );
  const handleCheckout = useCallback(
    (bookingId: string) => {
      setConfirm({ action: () => doCheckout(bookingId), label: tl("checkOutAct") });
    },
    [doCheckout, tl]
  );

  // ---- Cancel booking ----
  const doCancelBooking = useCallback(
    async (bookingId: string) => {
      setIsSaving(true);
      const result = await deleteBooking(bookingId);
      setIsSaving(false);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      dispatch({ type: "DELETE_BOOKING", payload: bookingId });
    },
    [showToast, dispatch]
  );
  const handleCancelBooking = useCallback(
    (bookingId: string) => {
      setConfirm({ action: () => doCancelBooking(bookingId), label: tl("cancelBooking") });
    },
    [doCancelBooking, tl]
  );

  // ---- Mark room ready ----
  const handleMarkReady = useCallback(async () => {
    if (roomNo == null) return;
    setIsSaving(true);
    const result = await setRoomOverride(roomNo, null);
    setIsSaving(false);
    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    dispatch({ type: "UPDATE_ROOM", payload: { no: roomNo, override: null, issue: "" } });
    showToast(tl("markReady"), "success");
  }, [roomNo, tl, showToast, dispatch]);

  // ---- Set room status (empty/cleaning) ----
  const handleSetStatus = useCallback(
    async (status: "empty" | "cleaning" | "maintenance") => {
      if (roomNo == null) return;
      if (status === "maintenance") {
        // Show textarea to enter issue — toggle maintEntry
        dispatch({
          type: "SET_MAINT_ENTRY",
          payload: maintEntry === roomNo ? null : roomNo,
        });
        return;
      }
      setIsSaving(true);
      const override = status === "empty" ? null : "cleaning";
      const result = await setRoomOverride(roomNo, override);
      setIsSaving(false);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      dispatch({ type: "UPDATE_ROOM", payload: { no: roomNo, override, issue: "" } });
      showToast(tl("statusChanged"), "success");
    },
    [roomNo, maintEntry, tl, showToast, dispatch]
  );

  // ---- Confirm maintenance ----
  const handleConfirmMaint = useCallback(async () => {
    if (roomNo == null) return;
    if (!localMaintIssue.trim()) {
      dispatch({ type: "SET_MAINT_ERR", payload: tl("issueRequired") });
      return;
    }
    setIsSaving(true);
    const result = await setRoomOverride(roomNo, "maintenance", localMaintIssue.trim());
    setIsSaving(false);
    if (result.error) {
      dispatch({ type: "SET_MAINT_ERR", payload: result.error });
      return;
    }
    dispatch({
      type: "UPDATE_ROOM",
      payload: { no: roomNo, override: "maintenance", issue: localMaintIssue.trim() },
    });
    dispatch({ type: "SET_MAINT_ENTRY", payload: null });
    dispatch({ type: "SET_MAINT_ERR", payload: "" });
    showToast(tl("issueSaved"), "success");
  }, [roomNo, localMaintIssue, tl, showToast, dispatch]);

  // ---- Room details save ----
  const handleSaveRoomDetails = useCallback(async () => {
    if (roomNo == null) return;
    let uploadedUrl: string | undefined;

    // If a photo was selected, upload to Supabase Storage
    if (photoFile) {
      // Resize and convert to ~720px
      const resized = await resizeImage(photoFile, 720);
      // For now: we convert to a data URL and store as photo_url
      // In production this would upload to Supabase Storage
      uploadedUrl = resized;
    }

    setIsSaving(true);
    const result = await saveRoomDetails(roomNo, localDesc, uploadedUrl);
    setIsSaving(false);

    if (result.error) {
      showToast(result.error, "error");
      return;
    }
    dispatch({
      type: "UPDATE_ROOM",
      payload: {
        no: roomNo,
        description: localDesc,
        description_tr: {},
        ...(uploadedUrl !== undefined ? { photo_url: uploadedUrl } : {}),
      },
    });
    setDetailsSaved(true);
    showToast(tl("photoUploaded"), "success");
    setTimeout(() => setDetailsSaved(false), 2000);
  }, [roomNo, localDesc, photoFile, tl, showToast, dispatch]);

  // ---- Resize image helper ----
  async function resizeImage(file: File, maxPx: number): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (Math.max(w, h) > maxPx) {
            const sc = maxPx / Math.max(w, h);
            w = Math.round(w * sc);
            h = Math.round(h * sc);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.62));
          } catch {
            resolve(ev.target?.result as string);
          }
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  if (roomNo == null || !room) return null;

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const isAdmin = user?.role === "admin";

  // ---- Nights display ----
  const nightsCount =
    form?.inDate && form?.outDate
      ? Math.max(0, diffDays(form.inDate, form.outDate))
      : 0;

  // ---- Expected total ----
  const dailyRate = settings?.daily_rate ?? 0;
  const expectedTotal =
    form?.inDate && form?.outDate && dailyRate > 0
      ? bookingExpected(form.inDate, form.outDate, dailyRate)
      : 0;
  const paidAmount = parseFloat(form?.amount ?? "") || 0;

  // ---- CC picker ----
  const ccItem = CC.find((c) => c.d === (form?.cc ?? "+966")) ?? CC[0];
  const filteredCC = (() => {
    const q = (ccSearch ?? "").trim().toLowerCase();
    const dq = q.replace(/[^0-9]/g, "");
    if (!q) return CC;
    return CC.filter(
      (c) =>
        c.n.toLowerCase().includes(q) ||
        (dq && c.d.replace("+", "").includes(dq))
    );
  })();

  // ---- History ----
  const roomBookings = bookings
    .filter((b) => b.room_no === roomNo)
    .slice()
    .sort((a, b) => (a.check_in < b.check_in ? 1 : -1));

  const histFiltered: Booking[] =
    histFilter === "all"
      ? roomBookings
      : roomBookings.filter((b) => bookingPhase(b, today) === histFilter);

  const histTotalNights = roomBookings.reduce(
    (s, b) => s + Math.max(0, diffDays(b.check_in, b.check_out)),
    0
  );
  const histTotalRev = roomBookings.reduce(
    (s, b) => s + (Number(b.amount) || 0),
    0
  );

  // ---- Focus booking phase ----
  const fbPhase = focusedBooking ? bookingPhase(focusedBooking, today) : null;
  const fbIsCurrent =
    focusedBooking &&
    !focusedBooking.checked_out &&
    focusedBooking.check_in <= today &&
    today <= focusedBooking.check_out;

  // ---- Show SET STATUS block ----
  const showSetStatus =
    !editing &&
    openBookingId == null &&
    (ds === "empty" || ds === "cleaning" || ds === "maintenance");

  // ---- Show room details block ----
  const showRoomDetails = isAdmin && openFrom === "rooms" && !editing;

  // ---- Source color helper ----
  function srcColor(source: string): string {
    const map: Record<string, string> = {
      direct: "var(--gold)",
      airbnb: "var(--checkout)",
      booking: "var(--info)",
      gathern: "var(--free)",
    };
    return map[source] ?? "var(--cleaning)";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <div className="backdrop in" onClick={handleBackdropClick}>
        <div className="sheet in" ref={sheetRef} onClick={stopPropagation}>
          <div className="grab" />

          {/* ─── Header ─── */}
          <div className="sh-head">
            <div className="sh-rnum">
              <span>{tl("roomWord")}</span>
              <b>{roomNo}</b>
            </div>
            <span
              className="spill sh-status"
              style={{ "--sc": headColor } as React.CSSProperties}
            >
              <i className="d" />
              {headLabel}
            </span>
            <button className="sh-close" onClick={closeSheet} type="button">
              <IX />
            </button>
          </div>

          {/* ─── Guest section label ─── */}
          {!editing && <div className="sec-l">{tl("guest")}</div>}

          {/* ─── EDITING: Form ─── */}
          {editing && form && (
            <div>
              {/* Sheet error */}
              {(sheetError || maintErr) && (
                <div className="sheet-err">
                  <IWarn />
                  <span>{sheetError || maintErr}</span>
                </div>
              )}

              {/* Name */}
              <div className="field">
                <label>{tl("name")}</label>
                <input
                  type="text"
                  value={form.name}
                  placeholder={tl("namePh")}
                  onChange={(e) => updateField({ name: e.target.value })}
                />
              </div>

              {/* Phone */}
              <div className="field">
                <label>{tl("phone")}</label>
                <div className="phone-row">
                  <button
                    type="button"
                    className="cc-btn"
                    onClick={toggleCc}
                  >
                    <span className="ccf">{ccItem.f}</span>
                    <span className="ccd">{ccItem.d}</span>
                    <span className="ccchev">
                      <IChev />
                    </span>
                  </button>
                  <input
                    type="tel"
                    dir="ltr"
                    value={form.phone}
                    placeholder={tl("phonePh")}
                    onChange={(e) => updateField({ phone: e.target.value })}
                  />
                </div>

                {/* Country code list */}
                {ccOpen && (
                  <div className="cc-list">
                    <input
                      className="cc-search"
                      type="text"
                      value={ccSearch}
                      placeholder={tl("ccSearchPh")}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_CC_SEARCH",
                          payload: e.target.value,
                        })
                      }
                      autoFocus
                    />
                    <div className="cc-scroll">
                      {filteredCC.length === 0 ? (
                        <div className="cc-empty">{tl("noMatch")}</div>
                      ) : (
                        filteredCC.map((c) => (
                          <button
                            key={c.d + c.n}
                            type="button"
                            className={`cc-item${c.d === form.cc ? " on" : ""}`}
                            onClick={() => pickCc(c.d)}
                          >
                            <span className="ccf">{c.f}</span>
                            <span className="ccn">{c.n}</span>
                            <span className="ccd">{c.d}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Check-in / Check-out dates */}
              <div className="frow">
                <div className="field">
                  <label>{tl("checkIn")}</label>
                  <button
                    type="button"
                    className={`datefield${dpOpen === "in" ? " on" : ""}`}
                    onClick={() =>
                      dpOpen === "in"
                        ? dispatch({ type: "SET_DP_OPEN", payload: null })
                        : openDp("in")
                    }
                  >
                    <span>{form.inDate ? fmtDate(form.inDate, lang) : "—"}</span>
                    <span className="dfi">
                      <ICal />
                    </span>
                  </button>
                </div>
                <div className="field">
                  <label>{tl("checkOut")}</label>
                  <button
                    type="button"
                    className={`datefield${dpOpen === "out" ? " on" : ""}`}
                    onClick={() =>
                      dpOpen === "out"
                        ? dispatch({ type: "SET_DP_OPEN", payload: null })
                        : openDp("out")
                    }
                  >
                    <span>{form.outDate ? fmtDate(form.outDate, lang) : "—"}</span>
                    <span className="dfi">
                      <ICal />
                    </span>
                  </button>
                </div>
              </div>

              {/* Nights line */}
              <div className="nights-line">
                {nightsCount}{" "}
                {nightsCount === 1 ? tl("night") : tl("nights")}
              </div>

              {/* Date picker calendar */}
              {dpOpen && dpMonth && (
                <DatePicker
                  which={dpOpen}
                  selectedDate={
                    dpOpen === "in" ? form.inDate : form.outDate
                  }
                  minDate={dpOpen === "out" ? form.inDate : undefined}
                  dpMonth={dpMonth}
                  lang={lang}
                  onPickDate={handleDpPick}
                  onPrevMonth={() => shiftDpMonth(-1)}
                  onNextMonth={() => shiftDpMonth(1)}
                />
              )}

              {/* Times */}
              <div className="frow">
                <div className="field">
                  <label>{tl("checkInTime")}</label>
                  <div className="selectwrap">
                    <select
                      value={form.inTime}
                      onChange={(e) => updateField({ inTime: e.target.value })}
                    >
                      {timeOptions(lang).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="selchev">
                      <IChev />
                    </span>
                  </div>
                </div>
                <div className="field">
                  <label>{tl("checkOutTime")}</label>
                  <div className="selectwrap">
                    <select
                      value={form.outTime}
                      onChange={(e) =>
                        updateField({ outTime: e.target.value })
                      }
                    >
                      {timeOptions(lang).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="selchev">
                      <IChev />
                    </span>
                  </div>
                </div>
              </div>

              {/* Source chips + custom */}
              <div className="field">
                <label>{tl("source")}</label>
                <div className="srcchips">
                  {PRESET_SOURCES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`srcchip${form.source === s ? " on" : ""}`}
                      onClick={() => updateField({ source: s })}
                    >
                      {tl("src_" + s)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`srcchip${!PRESET_SOURCES.includes(form.source) ? " on" : ""}`}
                    onClick={() => updateField({ source: "" })}
                  >
                    {tl("src_other")}
                  </button>
                </div>
                {!PRESET_SOURCES.includes(form.source) && (
                  <input
                    type="text"
                    className="src-custom-input"
                    placeholder={tl("src_custom_ph")}
                    value={form.source}
                    onChange={e => updateField({ source: e.target.value })}
                    autoComplete="off"
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>

              {/* Amount */}
              <div className="field">
                <label>{tl("amount")}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={form.amount}
                  placeholder={tl("amountPh")}
                  onChange={handleAmountChange}
                />
              </div>

              {/* Calc block */}
              {expectedTotal > 0 && (
                <>
                  <div className="rate-calc">
                    {fmtMoney(dailyRate, lang)} × {nightsCount}{" "}
                    {nightsCount === 1 ? tl("night") : tl("nights")} ={" "}
                    <b>{fmtMoney(expectedTotal, lang)}</b>
                  </div>
                  {form.amount !== "" && paidAmount < expectedTotal && (
                    <>
                      <div className="short-note">
                        <IWarn />
                        <span>
                          {fmtMoney(expectedTotal - paidAmount, lang)}{" "}
                          {tl("belowTotal")}
                        </span>
                      </div>
                      <div className="field">
                        <label>{tl("reasonLabel")}</label>
                        <input
                          type="text"
                          value={form.reason}
                          placeholder={tl("reasonPh")}
                          onChange={(e) =>
                            updateField({ reason: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Save / Cancel */}
              <div className="btnrow" style={{ marginTop: "14px" }}>
                <button
                  type="button"
                  className="btn soft"
                  onClick={handleCancelEdit}
                >
                  {tl("cancel")}
                </button>
                <button
                  type="button"
                  className="btn gold"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {tl("save")}
                </button>
              </div>
            </div>
          )}

          {/* ─── VIEW: Guest card ─── */}
          {!editing && focusedBooking && (() => {
            const g = focusedBooking;
            const n = Math.max(0, diffDays(g.check_in, g.check_out));
            const nlabel = `${n} ${n === 1 ? tl("night") : tl("nights")}`;
            const ph = fullPhone(g.cc, g.phone);
            const exp = bookingExpected(g.check_in, g.check_out, g.rate ?? dailyRate);
            const paidNum = Number(g.amount) || 0;
            const showShort = isAdmin && paidNum > 0 && exp > 0 && paidNum < exp;

            return (
              <div className="gcard">
                <div className="grow">
                  <span className="gi"><IUser /></span>
                  <div className="col">
                    <span className="gk">{tl("guest")}</span>
                    <span className="gv">{g.guest_name}</span>
                  </div>
                </div>

                <div className="grow">
                  <span className="gi"><IPhone /></span>
                  <div className="col">
                    <span className="gk">{tl("phone")}</span>
                    <a
                      className="gv ph"
                      href={`tel:${ph.replace(/\s/g, "")}`}
                    >
                      {ph}
                    </a>
                  </div>
                </div>

                <div className="grow">
                  <span className="gi"><IArrive /></span>
                  <div className="col">
                    <span className="gk">{tl("checkIn")}</span>
                    <span className="gv">
                      {fmtDate(g.check_in, lang)} ·{" "}
                      {fmtTime(g.check_in_time ?? "15:00", lang)}
                    </span>
                  </div>
                </div>

                <div className="grow">
                  <span className="gi"><IDepart /></span>
                  <div className="col">
                    <span className="gk">{tl("checkOut")}</span>
                    <span className="gv">
                      {fmtDate(g.check_out, lang)} ·{" "}
                      {fmtTime(g.check_out_time ?? "12:00", lang)}
                    </span>
                  </div>
                  <span className="nights">{nlabel}</span>
                </div>

                <div className="grow">
                  <span className="gi"><IGlobe /></span>
                  <div className="col">
                    <span className="gk">{tl("source")}</span>
                    <span className="gv">{tl("src_" + (g.source ?? "direct"))}</span>
                  </div>
                </div>

                {g.amount ? (
                  <div className="grow">
                    <span className="gi"><IMoney /></span>
                    <div className="col">
                      <span className="gk">{tl("amount")}</span>
                      <span className="gv">{fmtMoney(g.amount, lang)}</span>
                    </div>
                  </div>
                ) : null}

                {showShort && (
                  <>
                    <div className="grow exp">
                      <span className="gi"><IWarn /></span>
                      <div className="col">
                        <span className="gk">{tl("expectedLab")}</span>
                        <span className="gv">
                          {fmtMoney(exp, lang)} ·{" "}
                          {fmtMoney(exp - paidNum, lang)} {tl("belowTotal")}
                        </span>
                      </div>
                    </div>
                    {g.reason && (
                      <div className="grow reason">
                        <span className="gi"><INote /></span>
                        <div className="col">
                          <span className="gk">{tl("reasonShort")}</span>
                          <span className="gv">{g.reason}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* ─── VIEW: No guest ─── */}
          {!editing && !focusedBooking && (
            <div className="noguest">{tl("noGuest")}</div>
          )}

          {/* ─── ACTIONS ─── */}
          {!editing && (
            <div>
              <div className="sec-l">{tl("actions")}</div>

              {/* Empty room → Add guest */}
              {ds === "empty" && (
                <button
                  type="button"
                  className="btn gold"
                  onClick={() => dispatch({ type: "SET_EDITING", payload: true })}
                >
                  <IUser />
                  {tl("addGuest")}
                </button>
              )}

              {/* Cleaning or maintenance → Mark ready */}
              {(ds === "cleaning" || ds === "maintenance") && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleMarkReady}
                  disabled={isSaving}
                >
                  <IBed />
                  {tl("markReady")}
                </button>
              )}

              {/* Current booking */}
              {fbIsCurrent && focusedBooking && (
                <>
                  <div className="btnrow">
                    <button
                      type="button"
                      className="btn soft"
                      onClick={() => dispatch({ type: "SET_EDITING", payload: true })}
                    >
                      {tl("editDetails")}
                    </button>
                    <button
                      type="button"
                      className={`btn ${focusStatus === "checkout" ? "gold" : "primary"}`}
                      onClick={() => handleCheckout(focusedBooking.id)}
                      disabled={isSaving}
                    >
                      <IDepart />
                      {tl("checkOutAct")}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn danger"
                    style={{ marginTop: "10px" }}
                    onClick={() => handleCancelBooking(focusedBooking.id)}
                    disabled={isSaving}
                  >
                    {tl("cancelBooking")}
                  </button>
                </>
              )}

              {/* Upcoming booking */}
              {!fbIsCurrent && focusedBooking && fbPhase === "upcoming" && (
                <div className="btnrow">
                  <button
                    type="button"
                    className="btn soft"
                    onClick={() => dispatch({ type: "SET_EDITING", payload: true })}
                  >
                    {tl("editDetails")}
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => handleCancelBooking(focusedBooking.id)}
                    disabled={isSaving}
                  >
                    {tl("cancelBooking")}
                  </button>
                </div>
              )}

              {/* Issue note for maintenance rooms */}
              {room.override === "maintenance" && room.issue && (
                <div className="issue-note">
                  <IWrench />
                  <span>{room.issue || tl("issueBadge")}</span>
                </div>
              )}
            </div>
          )}

          {/* ─── SET STATUS ─── */}
          {showSetStatus && (
            <div>
              <div className="sec-l" style={{ marginTop: "18px" }}>
                {tl("setStatus")}
              </div>
              <div className="statusset">
                {SETOPTS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`sopt${ds === k ? " on" : ""}`}
                    style={
                      {
                        "--sc":
                          k === "empty"
                            ? "var(--free)"
                            : k === "cleaning"
                            ? "var(--cleaning)"
                            : "var(--maint)",
                      } as React.CSSProperties
                    }
                    onClick={() => handleSetStatus(k)}
                  >
                    <span className="sc" />
                    {tl(k)}
                  </button>
                ))}
              </div>

              {/* Maintenance textarea */}
              {maintEntry === roomNo && (
                <div className="maint-entry">
                  {maintErr && (
                    <div className="maint-err">
                      <IWarn />
                      <span>{maintErr}</span>
                    </div>
                  )}
                  <label>{tl("issueLabel")}</label>
                  <textarea
                    className="rd-desc"
                    rows={2}
                    placeholder={tl("issuePh")}
                    value={localMaintIssue}
                    onChange={(e) => setLocalMaintIssue(e.target.value)}
                  />
                  <div className="btnrow">
                    <button
                      type="button"
                      className="btn soft"
                      onClick={() => {
                        dispatch({ type: "SET_MAINT_ENTRY", payload: null });
                        dispatch({ type: "SET_MAINT_ERR", payload: "" });
                      }}
                    >
                      {tl("cancel")}
                    </button>
                    <button
                      type="button"
                      className="btn danger-solid"
                      onClick={handleConfirmMaint}
                      disabled={isSaving}
                    >
                      <IWrench />
                      {tl("confirmMaint")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── ROOM DETAILS (admin, openFrom=rooms) ─── */}
          {showRoomDetails && (
            <div>
              <div className="sec-l" style={{ marginTop: "18px" }}>
                {tl("roomDetails")} · {tl("floor")}{" "}
                {roomNo <= 10 ? "1" : "2"}
              </div>
              <div className="rd">
                {/* Photo display */}
                {photoPreview || room.photo_url ? (
                  <div
                    className="rd-photo"
                    style={{
                      backgroundImage: `url('${photoPreview ?? room.photo_url}')`,
                    }}
                  />
                ) : (
                  <div className="rd-photo empty">
                    <IBed />
                    <span>{tl("noPhoto")}</span>
                  </div>
                )}

                {/* Upload button */}
                <label className="rd-upload">
                  <INote />
                  <span>
                    {room.photo_url || photoPreview
                      ? tl("changePhoto")
                      : tl("addPhoto")}
                  </span>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setPhotoFile(f);
                        const url = URL.createObjectURL(f);
                        setPhotoPreview(url);
                      }
                    }}
                  />
                </label>

                {/* Description */}
                <textarea
                  className="rd-desc"
                  rows={3}
                  placeholder={tl("descPh")}
                  value={localDesc}
                  onChange={(e) => setLocalDesc(e.target.value)}
                />

                {/* Save button */}
                <button
                  type="button"
                  className="btn soft"
                  onClick={handleSaveRoomDetails}
                  disabled={isSaving}
                >
                  {detailsSaved ? tl("savedDetails") : tl("saveDetails")}
                </button>
              </div>
            </div>
          )}

          {/* ─── ROOM HISTORY ─── */}
          {!editing && (
            <div>
              <div className="sec-l" style={{ marginTop: "18px" }}>
                {tl("histTitle")}
              </div>

              {/* Stats */}
              <div className="rh-stats">
                <div className="rh-stat">
                  <b>{roomBookings.length}</b>
                  <span>{tl("histBookings")}</span>
                </div>
                <div className="rh-stat">
                  <b>{histTotalNights}</b>
                  <span>{tl("histNights")}</span>
                </div>
                {isAdmin && (
                  <div className="rh-stat">
                    <b>{fmtMoney(histTotalRev, lang)}</b>
                    <span>{tl("histRevenue")}</span>
                  </div>
                )}
              </div>

              {/* Filter chips */}
              <div className="rh-chips">
                {(["all", "current", "upcoming", "past"] as HistFilter[]).map(
                  (k) => (
                    <button
                      key={k}
                      type="button"
                      className={`rh-chip${histFilter === k ? " on" : ""}`}
                      onClick={() =>
                        dispatch({ type: "SET_HIST_FILTER", payload: k })
                      }
                    >
                      {tl("hist_" + k)}
                    </button>
                  )
                )}
              </div>

              {/* Booking list */}
              <div className="rh-list">
                {histFiltered.length === 0 ? (
                  <div className="rh-empty">{tl("histEmpty")}</div>
                ) : (
                  histFiltered.map((b) => {
                    const ph = bookingPhase(b, today);
                    const n = Math.max(
                      0,
                      diffDays(b.check_in, b.check_out)
                    );
                    return (
                      <div key={b.id} className="rh-item">
                        <div className="rh-itop">
                          <b>{b.guest_name}</b>
                          <span className={`rh-phase ${ph}`}>
                            {tl("hist_" + ph)}
                          </span>
                        </div>
                        <div className="rh-imeta">
                          <ICal />
                          <span>
                            {fmtDate(b.check_in, lang)} →{" "}
                            {fmtDate(b.check_out, lang)} · {n}{" "}
                            {n === 1 ? tl("night") : tl("nights")}
                          </span>
                        </div>
                        <div className="rh-imeta">
                          <IGlobe />
                          <span>
                            {tl("src_" + (b.source ?? "direct"))}
                            {isAdmin && b.amount
                              ? ` · ${fmtMoney(b.amount, lang)}`
                              : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm modal ── */}
      {confirm && (
        <div className="backdrop in" style={{ zIndex: 120 }} onClick={() => setConfirm(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-msg">{tl("areYouSure")}</p>
            <div className="confirm-btns">
              <button className="btn soft" onClick={() => setConfirm(null)}>{tl("cancel")}</button>
              <button
                className="btn danger"
                onClick={() => { confirm.action(); setConfirm(null); }}
              >
                {confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
