# Quba Room Board — Aurion Hotels

Front-desk operations board: room grid, bookings, 30-day timeline, occupancy &
revenue analytics. Arabic-first (RTL) with an English toggle, light/dark themes,
and a liquid-glass UI in the Aurion brand.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Supabase (Auth + DB +
Realtime + Storage) · Groq (AI translation) · Vercel.

---

## Quickstart

```bash
# 1. install
npm install

# 2. env
cp .env.example .env.local      # then fill in your keys (see SETUP.md)

# 3. database
#    open supabase/schema.sql in the Supabase SQL editor and run it

# 4. run
npm run dev                     # http://localhost:3000
```

You'll land on a styled getting-started page that demonstrates the design system.
The actual board screens are built from the working prototype in
[`reference/Quba-Room-Board.html`](reference/Quba-Room-Board.html) using the
prompts in [`CLAUDE.md`](CLAUDE.md).

## What's in here

| Path | What it is |
|---|---|
| `reference/Quba-Room-Board.html` | The complete, working prototype (UI source of truth) |
| `supabase/schema.sql` | All tables, RLS, realtime, storage, seed |
| `src/app/globals.css` | Design tokens (colors) + Resend-style animations |
| `tailwind.config.ts` | Brand / status / accent colors + animation utilities |
| `src/lib/supabase/*` | Browser + server Supabase clients |
| `src/lib/types.ts` | DB types (match the schema) |
| `src/lib/i18n.ts` | Bilingual dictionary (ar/en) starter |
| `SETUP.md` | Step-by-step setup + deploy |
| `CLAUDE.md` | Copy-paste prompts to build the app in Claude Code |

## Test accounts (after seeding)

- **Admin** (Malsor): `admin@aurion.local`
- **Staff** (Reception): `reception@aurion.local`

> The prototype uses simple username/password; the real build uses Supabase Auth
> with the synthetic-email pattern (`username@aurion.local`).
