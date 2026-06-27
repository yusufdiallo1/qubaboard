# Supabase

Run `schema.sql` once in the SQL Editor. It is idempotent (safe to re-run).

It creates:

- **enums** — `role`, `room_override`, `booking_source`
- **tables** — `profiles`, `rooms`, `bookings`, `app_settings`, `room_status_history`
- **RLS + policies** — authenticated read everywhere; staff run the desk;
  admin-only `app_settings` writes and staff management; `is_admin()` helper
- **realtime** — `bookings`, `rooms`, `app_settings` added to `supabase_realtime`
- **storage** — public `room-photos` bucket (+ read/write policies)
- **seed** — 20 rooms (floors 1 & 2) and the settings singleton (rate 350 SAR)

After running it, create the two auth users and insert their `profiles` rows —
see the comment block at the bottom of `schema.sql` or `../SETUP.md`.
