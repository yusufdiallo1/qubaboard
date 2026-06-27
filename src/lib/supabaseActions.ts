"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, BookingForm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Overlap check run server-side before saving a booking.
 * Returns true if [inD, outD) overlaps any active booking for roomNo
 * (excluding exceptId so edits don't conflict with themselves).
 * Uses half-open interval logic: inD < other.check_out AND other.check_in < outD
 */
async function serverHasOverlap(
  supabase: ReturnType<typeof createAdminClient>,
  roomNo: number,
  inD: string,
  outD: string,
  exceptId?: string,
): Promise<boolean> {
  let query = supabase
    .from("bookings")
    .select("id")
    .eq("room_no", roomNo)
    .eq("checked_out", false)
    .lt("check_in", outD) // other.check_in < outD
    .gt("check_out", inD); // other.check_out > inD  (i.e. inD < other.check_out)

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// saveBooking
// ---------------------------------------------------------------------------

/**
 * Create or update a booking.
 *
 * - Validates check_in < check_out.
 * - Runs overlap detection (server-side, authoritative).
 * - Snapshots the nightly rate at save time (stores in bookings.rate).
 * - Returns the saved Booking or an error string.
 */
export async function saveBooking(
  form: BookingForm,
  roomNo: number,
  dailyRate: number,
  userId: string,
  existingId?: string,
): Promise<{ booking: Booking | null; error: string | null }> {
  const supabase = createAdminClient();

  const inD = form.inDate;
  const outD = form.outDate;

  // --- basic validation ---
  if (!inD || !outD) {
    return { booking: null, error: "Check-in and check-out dates are required." };
  }
  if (inD >= outD) {
    return {
      booking: null,
      error: "Check-out date must be after check-in date.",
    };
  }
  if (!form.name.trim()) {
    return { booking: null, error: "Guest name is required." };
  }

  // --- overlap detection ---
  try {
    const overlap = await serverHasOverlap(
      supabase,
      roomNo,
      inD,
      outD,
      existingId,
    );
    if (overlap) {
      return {
        booking: null,
        error: "This room is already booked for the selected dates.",
      };
    }
  } catch (err) {
    return {
      booking: null,
      error: err instanceof Error ? err.message : "Overlap check failed.",
    };
  }

  // --- build row ---
  const row = {
    room_no: roomNo,
    guest_name: form.name.trim(),
    cc: form.cc,
    phone: form.phone.trim(),
    check_in: inD,
    check_out: outD,
    check_in_time: form.inTime,
    check_out_time: form.outTime,
    source: form.source,
    amount: parseFloat(form.amount) || 0,
    rate: dailyRate, // snapshot rate at booking time
    reason: form.reason.trim(),
    checked_out: false,
    created_by: userId,
  };

  let data: Booking | null = null;
  let error: string | null = null;

  if (existingId) {
    // --- update ---
    const { data: updated, error: updateErr } = await supabase
      .from("bookings")
      .update(row)
      .eq("id", existingId)
      .select()
      .single();

    if (updateErr) {
      error = updateErr.message;
    } else {
      data = updated as Booking;
    }
  } else {
    // --- insert ---
    const { data: inserted, error: insertErr } = await supabase
      .from("bookings")
      .insert(row)
      .select()
      .single();

    if (insertErr) {
      error = insertErr.message;
    } else {
      data = inserted as Booking;
    }
  }

  return { booking: data, error };
}

// ---------------------------------------------------------------------------
// deleteBooking
// ---------------------------------------------------------------------------

/** Hard-delete a booking by id. */
export async function deleteBooking(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("bookings").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// checkoutBooking
// ---------------------------------------------------------------------------

/**
 * Mark a booking as checked out and automatically set the room override to
 * 'cleaning' so staff know to prepare it.
 */
export async function checkoutBooking(
  id: string,
  roomNo: number,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  // 1. Mark booking checked_out = true
  const { error: bookingErr } = await supabase
    .from("bookings")
    .update({ checked_out: true })
    .eq("id", id);

  if (bookingErr) return { error: bookingErr.message };

  // 2. Set room override to 'cleaning'
  const { error: roomErr } = await supabase
    .from("rooms")
    .update({ override: "cleaning", issue: "" })
    .eq("no", roomNo);

  if (roomErr) return { error: roomErr.message };

  return { error: null };
}

// ---------------------------------------------------------------------------
// setRoomOverride
// ---------------------------------------------------------------------------

/**
 * Set (or clear) a room's override status.
 * Maintenance requires an issue string to be provided.
 */
export async function setRoomOverride(
  roomNo: number,
  override: "cleaning" | "maintenance" | null,
  issue?: string,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  if (override === "maintenance" && !issue?.trim()) {
    return {
      error: "An issue description is required for maintenance status.",
    };
  }

  const patch: Record<string, unknown> = {
    override: override,
    issue: override === "maintenance" ? (issue ?? "").trim() : "",
  };

  const { error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("no", roomNo);

  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// saveRoomDetails
// ---------------------------------------------------------------------------

/**
 * Persist a room's description and (optionally) its photo URL.
 * Also clears description_tr cache so the AI translation is regenerated on
 * next view.
 */
export async function saveRoomDetails(
  roomNo: number,
  description: string,
  photoUrl?: string,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const patch: Record<string, unknown> = {
    description: description.trim(),
    description_tr: {}, // clear translation cache
  };

  if (photoUrl !== undefined) {
    patch.photo_url = photoUrl;
  }

  const { error } = await supabase.from("rooms").update(patch).eq("no", roomNo);
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// saveSettings
// ---------------------------------------------------------------------------

/**
 * Upsert the daily rate in app_settings (assumes a single row with id=1).
 */
export async function saveSettings(
  dailyRate: number,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("app_settings")
    .update({ daily_rate: dailyRate })
    .eq("id", 1);

  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// addEmployee
// ---------------------------------------------------------------------------

/**
 * Create a new staff/admin account.
 *
 * Steps:
 *  1. Create auth user with email = username@aurion.local using the
 *     service-role client (bypasses email confirmation).
 *  2. Insert a corresponding public.profiles row (id = auth user id).
 */
export async function addEmployee(
  name: string,
  username: string,
  password: string,
  role: "admin" | "staff",
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  if (!name.trim() || !username.trim() || !password) {
    return { error: "Name, username, and password are all required." };
  }

  const email = `${username.trim().toLowerCase()}@aurion.local`;

  // 1. Create auth user
  const { data: authData, error: authErr } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation flow
    });

  if (authErr) {
    return { error: authErr.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Auth user created but id is missing." };
  }

  // 2. Insert profile row
  const { error: profileErr } = await supabase.from("profiles").insert({
    id: userId,
    name: name.trim(),
    role,
  });

  if (profileErr) {
    // Attempt to clean up the orphaned auth user
    await supabase.auth.admin.deleteUser(userId);
    return { error: profileErr.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// removeEmployee
// ---------------------------------------------------------------------------

/**
 * Delete a staff member: removes the auth user (which cascades to profiles
 * via the ON DELETE CASCADE foreign key defined in schema.sql).
 */
export async function removeEmployee(
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);
  return { error: error?.message ?? null };
}
