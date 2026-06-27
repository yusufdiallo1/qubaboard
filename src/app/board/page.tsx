// Placeholder. Build this out with the prompts in CLAUDE.md (ports /reference/Quba-Room-Board.html).
export default function BoardPage() {
  return (
    <main className="brand-bg min-h-screen" dir="ltr">
      <div className="mx-auto max-w-2xl px-6 py-24 text-center animate-fade-in-up">
        <h1 className="font-serif text-4xl font-bold text-gradient">Board</h1>
        <p className="mt-3 text-muted">
          This screen is scaffolded but not yet built. Run the porting prompt in{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">CLAUDE.md</code> to generate the
          full room grid, calendar, and analytics from the prototype reference.
        </p>
        <a href="/" className="btn btn-primary mt-6">← Back</a>
      </div>
    </main>
  );
}
