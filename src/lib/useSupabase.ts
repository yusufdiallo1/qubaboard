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

      // Fetch profiles with usernames via RPC (joins auth.users for email)
      // RPC returns lang + theme columns now too
      const { data: withEmails, error: profilesErr } = await supabase.rpc(
        "get_profiles_with_usernames",
      ) as { data: Array<{ id: string; name: string; role: string; email: string; lang?: string; theme?: string }> | null; error: unknown };

      if (profilesErr) {
        console.error("[useSupabaseData] profiles fetch error:", profilesErr);
      } else {
        const employees: Employee[] = (withEmails ?? []).map((p) => ({
          id: p.id,
          name: p.name ?? "",
          username: (p.email ?? "").split("@")[0],
          role: (p.role ?? "staff") as "admin" | "staff",
        }));
        dispatch({ type: "SET_EMPLOYEES", payload: employees });

        // Apply current user's saved lang/theme from their profile row
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const myProfile = (withEmails ?? []).find(p => p.id === authUser.id);
          if (myProfile?.lang) {
            dispatch({ type: "SET_LANG", payload: myProfile.lang as "ar" | "en" });
          }
          if (myProfile?.theme) {
            dispatch({ type: "SET_THEME", payload: myProfile.theme as "light" | "dark" });
          }
        }
      }
    }

    fetchAll().finally(() => {
      dispatch({ type: "SET_LOADING", payload: false });
    });

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
        if (status === "SUBSCRIBED") {
          dispatch({ type: "SET_REALTIME_STATUS", payload: "ok" });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dispatch({ type: "SET_REALTIME_STATUS", payload: "error" });
          console.error("[useSupabaseData] realtime channel:", status);
        }
      });

    // --------------------------------------------------------------- cleanup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dispatch]);
}
