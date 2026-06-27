"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface DbTestResult {
  ok: boolean;
  settings: { daily_rate: number; currency: string } | null;
  roomCount: number;
  error: string | null;
}

export async function testConnection(): Promise<DbTestResult> {
  const supabase = createAdminClient();

  const [settingsRes, roomsRes] = await Promise.all([
    supabase.from("app_settings").select("daily_rate, currency").eq("id", 1).single(),
    supabase.from("rooms").select("no", { count: "exact", head: true }),
  ]);

  if (settingsRes.error) {
    return { ok: false, settings: null, roomCount: 0, error: settingsRes.error.message };
  }
  if (roomsRes.error) {
    return { ok: false, settings: null, roomCount: 0, error: roomsRes.error.message };
  }

  return {
    ok: true,
    settings: settingsRes.data,
    roomCount: roomsRes.count ?? 0,
    error: null,
  };
}
