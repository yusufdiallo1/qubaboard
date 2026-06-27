# Setup

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **SQL Editor → New query** → paste the contents of `supabase/schema.sql` → **Run**.
   This creates all tables, RLS policies, realtime, the `room-photos` storage
   bucket, and seeds 20 rooms + settings.
3. **Authentication → Users → Add user** — create two users:
   - `admin@aurion.local` (Malsor — admin)
   - `reception@aurion.local` (front desk — staff)
4. Copy each user's **UUID** (Users list) and run, in SQL Editor:
   ```sql
   insert into public.profiles (id, name, role) values
     ('PASTE-ADMIN-UUID',     'Malsor',    'admin'),
     ('PASTE-RECEPTION-UUID', 'Reception', 'staff');
   ```
5. **Authentication → URL Configuration**: set **Site URL** and add **Redirect
   URLs** for `http://localhost:3000` and your Vercel domain.
   *(This is the #1 most-forgotten step — auth will silently fail without it.)*

## 2. Environment variables

Copy `.env.example` → `.env.local` and fill:

| Key | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role (server only) |
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally |
| `NEXT_PUBLIC_ISSUE_TRACKER_URL` | URL of the separate maintenance tracker (optional) |

## 3. Run

```bash
npm install
npm run dev
```

## 4. Build the screens

Open `CLAUDE.md` and run the prompts in Claude Code (in this repo). They port the
prototype in `reference/Quba-Room-Board.html` screen-by-screen onto Supabase.

## 5. Deploy (Vercel)

1. Push to GitHub.
2. [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add the same env vars (use your Vercel URL for `NEXT_PUBLIC_SITE_URL`).
4. Add the Vercel domain to Supabase **Redirect URLs** (step 1.5).
5. Deploy.
