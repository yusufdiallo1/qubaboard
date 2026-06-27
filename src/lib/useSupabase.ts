"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppDispatch } from "@/lib/store";
import type { Room, Booking, AppSettings } from "@/lib/types";

type Employee = {
  id: string;
  name: string;
  username: string;
  role: "admin" | "staff";
};

/**
 * useSupabaseData — fetches rooms, bookings, app_settings, and profiles on
 * mount, then wires realtime subscriptions for all three core tables.
 *
 * Call this once inside a client component that sits under <AppProvider>.
 */
export function useSupabaseData() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const supabase = createClient();

    // ------------------------------------------------------------------ fetch
    async function fetchAll() {
      // Fetch rooms
      const { data: rooms, error: roomsErr } = await supabase
        .from("rooms")
        .select("*")
        .order("no", { ascending: true });

      if (roomsErr) {
        console.error("[useSupabaseData] rooms fetch error:", roomsErr.message);
      } else {
        dispatch({ type: "SET_ROOMS", payload: (rooms ?? []) as Room[] });
      }

      // Fetch bookings
      const { data: bookings, error: bookingsErr } = await supabase
        .from("bookings")
        .select("*")
        .order("check_in", { ascending: true });

      if (bookingsErr) {
        console.error(
          "[useSupabaseData] bookings fetch error:",
          bookingsErr.message,
        );
      } else {
        dispatch({
          type: "SET_BOOKINGS",
          payload: (bookings ?? []) as Booking[],
        });
      }

      // Fetch app_settings (we take the first row)
      const { data: settings, error: settingsErr } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .single();

      if (settingsErr && settingsErr.code !== "PGRST116") {
        // PGRST116 = no rows found — not an error we care about
        console.error(
          "[useSupabaseData] app_settings fetch error:",
          settingsErr.message,
        );
      } else {
        dispatch({
          type: "SET_SETTINGS",
          payload: settings ? (settings as AppSettings) : null,
        });
      }

      // Fetch profiles (employees list)
      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, name, role, created_at")
        .order("created_at", { ascending: true });

      if (profilesErr) {
        console.error(
          "[useSupabaseData] profiles fetch error:",
          profilesErr.message,
        );
      } else {
        // Derive username from auth.users email — stored in profiles as
        // email = username@aurion.local, so we reconstruct via a separate
        // auth admin query if available, but since this is the browser client
        // we rely on a join or a stored username column.
        //
        // The profiles table in schema.sql does NOT have a username column,
        // so we fetch the corresponding auth user email via a custom RPC or
        // accept that username is the profile id prefix.
        //
        // Pattern per spec: username = email.split('@')[0] where
        // email = username@aurion.local.  The profiles table holds user id
        // which maps to auth.users.id.  We fetch the email separately via the
        // Supabase auth API (available on browser client as getUser, but that
        // only returns the current user).  For the employees list we need all
        // users — this requires either a server action or a view.
        //
        // We use a Supabase database view "profiles_with_email" if available,
        // otherwise fall back to using the profile id as username (admin UI
        // can still display name + role).  The addEmployee server action stores
        // the username as the email prefix, so we reconstruct it by calling the
        // /api/profiles-with-usernames route if needed.
        //
        // For now, the username is derived client-side as the first segment of
        // the profile name if it contains an "@", otherwise we fetch it from the
        // auth users table via a database function exposed as an RPC.
        //
        // Simplest safe approach: call an RPC that returns profiles + email prefix.
        // If the RPC doesn't exist, fall back to showing id.
        const employees: Employee[] = (profiles ?? []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
          username: "", // filled in below if the RPC succeeds
          role: p.role as "admin" | "staff",
        }));

        // Try to enrich with usernames via RPC (created in Prompt 2 migration)
        const { data: withEmails } = await supabase.rpc(
          "get_profiles_with_usernames",
        );

        if (withEmails && Array.isArray(withEmails)) {
          const emailMap: Record<string, string> = {};
          (
            withEmails as Array<{ id: string; email: string }>
          ).forEach((row) => {
            // email = username@aurion.local → username
            emailMap[row.id] = (row.email ?? "").split("@")[0];
          });
          employees.forEach((emp) => {
            emp.username = emailMap[emp.id] ?? emp.id;
          });
        } else {
          // Fallback: use name as username proxy
          employees.forEach((emp) => {
            emp.username = emp.name;
          });
        }

        dispatch({ type: "SET_EMPLOYEES", payload: employees });
      }
    }

    fetchAll();

    // --------------------------------------------------------- realtime setup
    const channel = supabase
      .channel("quba-realtime")

      // ---- bookings ----
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        (payload) => {
          dispatch({
            type: "UPSERT_BOOKING",
            payload: payload.new as Booking,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings" },
        (payload) => {
          dispatch({
            type: "UPSERT_BOOKING",
            payload: payload.new as Booking,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "bookings" },
        (payload) => {
          // payload.old contains the deleted row (id must be in replica identity)
          const old = payload.old as { id?: string };
          if (old?.id) {
            dispatch({ type: "DELETE_BOOKING", payload: old.id });
          }
        },
      )

      // ---- rooms ----
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms" },
        (payload) => {
          const room = payload.new as Room;
          dispatch({
            type: "UPDATE_ROOM",
            payload: room,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rooms" },
        (payload) => {
          // Full re-fetch is the safest for INSERT on rooms (rare)
          fetchAll();
        },
      )

      // ---- app_settings ----
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_settings" },
        (payload) => {
          dispatch({
            type: "SET_SETTINGS",
            payload: payload.new as AppSettings,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_settings" },
        (payload) => {
          dispatch({
            type: "SET_SETTINGS",
            payload: payload.new as AppSettings,
          });
        },
      )

      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("[useSupabaseData] realtime channel error");
        }
      });

    // --------------------------------------------------------------- cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dispatch]);
}
