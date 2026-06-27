import Link from "next/link";

const statuses = [
  { key: "Empty", cls: "bg-free" },
  { key: "Booked", cls: "bg-booked" },
  { key: "Checkout", cls: "bg-checkout" },
  { key: "Cleaning", cls: "bg-cleaning" },
  { key: "Maintenance", cls: "bg-maint" },
];

const steps = [
  { n: 1, t: "Set environment", d: "Copy .env.example → .env.local and fill Supabase + Groq keys." },
  { n: 2, t: "Create database", d: "Run supabase/schema.sql in the Supabase SQL editor (tables, RLS, realtime, seed)." },
  { n: 3, t: "Add the two users", d: "Create admin + staff auth users, then insert their profiles (see SETUP.md)." },
  { n: 4, t: "Build the screens", d: "Open CLAUDE.md and run the prompts in Claude Code to port the board from /reference." },
];

export default function Home() {
  return (
    <main dir="ltr" className="brand-bg min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        {/* Hero */}
        <div className="stagger">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-free" /> Scaffold ready
          </span>
          <h1 className="mt-5 font-serif text-5xl font-bold tracking-tight sm:text-6xl">
            <span className="text-gradient">Quba Room Board</span>
          </h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Front-desk operations board for Aurion Hotels — rooms, bookings, occupancy
            analytics, Arabic-first with English toggle.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/board" className="btn btn-primary">
              Open the board →
            </Link>
            <a href="https://supabase.com/dashboard" className="btn border border-line bg-surface text-text">
              Supabase dashboard
            </a>
          </div>

          {/* Status palette swatches */}
          <div className="mt-10 flex flex-wrap gap-2">
            {statuses.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium shadow-card"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${s.cls}`} />
                {s.key}
              </span>
            ))}
          </div>
        </div>

        {/* Setup steps */}
        <div className="stagger mt-14 grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-3 font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-sm text-faint">
          Stack: Next.js App Router · TypeScript · Tailwind · Supabase (Auth + DB + Realtime +
          Storage) · Groq · Vercel. The working UI reference lives in{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">/reference/Quba-Room-Board.html</code>.
        </p>
      </div>
    </main>
  );
}
