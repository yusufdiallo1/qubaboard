# Build prompts — Quba Room Board

Run these **in order** inside Claude Code, from the repo root. Each block is a
prompt you can paste as-is. The working UI to match is
`reference/Quba-Room-Board.html` — open it in a browser side-by-side; it is the
source of truth for layout, colors, copy, and behavior.

> Golden rule for every prompt: **match the prototype exactly** — same Aurion
> brand colors, status colors, Arabic-default/RTL with English toggle, light/dark,
> liquid-glass styling, and the Resend-style animations already defined in
> `src/app/globals.css` and `tailwind.config.ts`.

---

## Prompt 0 — Orient

```
Read README.md, SETUP.md, src/lib/types.ts, src/lib/i18n.ts, tailwind.config.ts,
src/app/globals.css, and supabase/schema.sql. Then open
reference/Quba-Room-Board.html and study it end to end — this prototype is the
exact UI and behavior we are porting to Next.js + Supabase. Summarize the screens,
the data model, and the design system before writing any code.
```

## Prompt 1 — Environment

```
Verify my environment is wired correctly. Confirm .env.local has
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
GROQ_API_KEY, NEXT_PUBLIC_SITE_URL, and NEXT_PUBLIC_ISSUE_TRACKER_URL. Then write a
tiny server action that selects from app_settings and rooms to prove the Supabase
connection works, and tell me how to test it. Do not hardcode any secret.
```

## Prompt 2 — Supabase tables

```
Open supabase/schema.sql. Walk me through running it in the Supabase SQL editor,
creating the admin (admin@aurion.local) and staff (reception@aurion.local) auth
users, and inserting their public.profiles rows with the right roles. Then confirm
RLS is on for all tables and that bookings, rooms, and app_settings are in the
supabase_realtime publication. If anything in the schema needs to change for the
features below, propose the migration as a new file in supabase/ — never edit
history destructively.
```

## Prompt 3 — Auth + shell

```
Build login + the app shell, matching reference/Quba-Room-Board.html.
- Username/password login using Supabase Auth via the synthetic-email pattern
  (username -> username@aurion.local). RTL-safe password field (no dir="ltr"),
  show/hide eye that doesn't overlap in RTL.
- After login, load the current user's profile (role) and render the topbar
  (sticky, glass), the avatar dropdown (Language toggle, Theme toggle, Sign out),
  and the side nav. Nav base = Board, Timeline, Overview; admin also sees Rooms
  and Employees.
- Mobile (<=899px): hamburger opens a slide-in drawer that respects RTL edges and
  closes on nav/backdrop. Desktop nav is sticky.
- Arabic default (RTL) with English toggle (Western numerals in both). Light
  default with dark toggle. Persist language + theme.
- Sign out must work from the dropdown (no z-index/overlay trap).
Use the colors and animations already in globals.css/tailwind.config.ts. Add a
gentle fade-in-up on route content.
```

## Prompt 4 — Data layer + realtime

```
Create a typed data layer over Supabase (use src/lib/types.ts).
- Read rooms, bookings, app_settings; subscribe to realtime changes on all three
  so multiple devices stay in sync live.
- Port these helpers from the prototype with IDENTICAL behavior, and keep them
  timezone-safe: NEVER use toISOString for date keys — use local-component math
  (the prototype was bitten by a UTC off-by-one bug). Helpers: localToday,
  fmtDate, fmtDateLong, weekdayOf, diffDays, isoAdd, monthFirst, shiftMonth,
  fmtTime (12h with AM/PM, Arabic ص/م), occOnDate, bookingPhase, revOnDate.
- roomStatus(no) = override || (current booking ? (checkout day ? 'checkout' :
  'booked') : (upcoming ? 'booked' : 'empty')). A room "has issue" iff
  override = 'maintenance' (unified — maintenance == red == wrench == has issue
  text). Include overlap detection to guard double-booking.
Write a couple of unit tests for the date helpers and run them under
TZ=Asia/Riyadh to prove no off-by-one.
```

## Prompt 5 — Board screen

```
Build the Board exactly like the prototype: occupancy bar, glass filter dropdown,
search, and grid/list toggle.
- Grid tile: photo header strip, status pill (free/booked/checkout/cleaning/
  maintenance colors), guest-or-empty line, auto-translated description, red wrench
  only when maintenance (title = issue text).
- List row: leading photo thumbnail, name, description line, dates, wrench.
- Tapping a room opens the booking bottom-sheet (Prompt 7).
Use status colors from tailwind.config.ts. Subtle hover lift on tiles/rows.
```

## Prompt 6 — Timeline + Overview (interactive analytics)

```
Build two screens.
TIMELINE: 30-day horizontally-scrollable strip, fixed-width day columns, month
labels with gold dividers on month boundaries, prev/next (±7d) + Today; tap an
empty cell to create a booking, tap a bar to view it. Plus a month heatmap view
with arrivals/departures and prev/next/Today.

OVERVIEW (all data REAL — no mock/sample data, ever): KPI cards (occupancy %,
rooms, arrivals, departures, revenue, ADR, RevPAR, avg stay); a 14-day occupancy
trend and an admin-only 14-day revenue trend; an occupancy donut and a channel-mix
donut; status bars and floor-performance bars (Floor 1 and Floor 2 in DIFFERENT
colors). EVERY chart must be interactive: hovering anywhere on a trend column shows
that day's value with a subtle highlight (use full-height transparent hit-rects —
make sure their fill is genuinely transparent, not the SVG default black); donut
segments thicken on hover; bars highlight on hover. With no bookings the charts
sit at a real zero baseline — that is correct, do not fabricate data.
```

## Prompt 7 — Booking sheet, form, room editor

```
Build the glass bottom-sheet.
- VIEW: guest card (tap-to-call), check-in/out as "date · 12h time", booking source
  row, admin-only expected-total + reason-if-short, and a per-room Booking History
  section (stats: bookings/nights/admin-revenue + filter chips All/Current/Upcoming/
  Past with phase badges).
- CREATE/EDIT form: name; phone with the 197-country-code picker (searchable,
  default +966); a custom themed inline date picker (NO native type=date);
  check-in/out time as themed selects (30-min steps, 12h labels); source as
  tappable chips; amount (numeric) with live total and reason-if-below-expected.
  Snapshot the nightly rate on save.
- Set-status: Empty / Cleaning / Maintenance. Maintenance REQUIRES typing an issue
  before confirm. Checkout auto-sets Cleaning and keeps the sheet open with a
  "Mark ready" action. Photo upload (resize ~720px) -> Supabase Storage
  room-photos; description textarea -> rooms.description. The room editor
  (photo+description) shows only for admin opening from the Rooms page.
Preserve scroll position on the sheet across re-renders.
```

## Prompt 8 — AI description translation (Groq)

```
Add a /api/translate route handler that calls Groq with the GROQ_API_KEY to
translate a room description between Arabic and English. On the board, display
descriptions in the active language: read rooms.description_tr cache first; on a
miss, call the route, then persist the translation back into description_tr
(jsonb) so it's cached. Clear the cache for a room when its description is edited.
Keep the editor textarea showing the original text.
```

## Prompt 9 — Admin pages

```
Build the admin-only Rooms page (Floor 1 = rooms 1–10, Floor 2 = 11–20, grouped
cards with photo/status/description/current guest; tapping opens the sheet with the
room editor) and the Employees page (list staff from profiles + an add-staff form
that creates a Supabase auth user via a server action using the service-role key,
then inserts a profile). Add the admin-only daily-rate panel with the checkmark
save animation. Gate all of this behind role = 'admin'.
```

## Prompt 10 — Deploy

```
Prepare for Vercel: confirm there are no client-side uses of the service-role key,
run npm run build and fix any type errors, then give me the exact Vercel steps
(import repo, env vars, set NEXT_PUBLIC_SITE_URL to the Vercel URL) and remind me
to add the Vercel domain to Supabase Auth redirect URLs.
```

---

### Notes / gotchas (carry these forward)

- **Never** use `toISOString()` for date keys — local-component math only.
- Maintenance is unified: red ⇔ wrench ⇔ `override='maintenance'` ⇔ has issue text.
- Charts: real data only; transparent hit-rects (explicit `fill:transparent`, no
  `color-mix` on an undefined CSS var or you get black bars).
- The Issue & Maintenance Tracker is a **separate** project/deploy; only link to it
  via `NEXT_PUBLIC_ISSUE_TRACKER_URL`.
- Guest data is name/phone/dates/times/source/amount only — no government/Shomool
  fields.
