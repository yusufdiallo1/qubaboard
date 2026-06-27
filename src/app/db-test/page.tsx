import { testConnection } from "./actions";

export const dynamic = "force-dynamic";

export default async function DbTestPage() {
  const result = await testConnection();

  return (
    <main dir="ltr" className="min-h-screen brand-bg flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md animate-fade-in-up">
        <h1 className="text-xl font-bold mb-6">Supabase Connection Test</h1>

        {result.ok ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-free/10 border border-free/30 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-free flex-none" />
              <span className="font-semibold text-free">Connected successfully</span>
            </div>

            <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm space-y-2">
              <p className="text-muted font-medium">app_settings (id = 1)</p>
              <p>
                <span className="text-faint">daily_rate: </span>
                <span className="font-bold">{result.settings?.daily_rate}</span>
              </p>
              <p>
                <span className="text-faint">currency: </span>
                <span className="font-bold">{result.settings?.currency}</span>
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm space-y-2">
              <p className="text-muted font-medium">rooms table</p>
              <p>
                <span className="text-faint">row count: </span>
                <span className="font-bold">{result.roomCount}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-maint/10 border border-maint/30 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-maint flex-none" />
              <span className="font-semibold text-maint">Connection failed</span>
            </div>
            <pre className="rounded-xl bg-surface-2 border border-line p-4 text-xs text-muted whitespace-pre-wrap">
              {result.error}
            </pre>
          </div>
        )}

        <p className="mt-6 text-xs text-faint">
          This page uses the service-role key (server-side only) to query{" "}
          <code className="bg-surface-2 px-1 rounded">app_settings</code> and{" "}
          <code className="bg-surface-2 px-1 rounded">rooms</code>.
        </p>
      </div>
    </main>
  );
}
