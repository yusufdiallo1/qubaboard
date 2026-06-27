// Database types — mirror supabase/schema.sql

export type Role = "admin" | "staff";
export type RoomOverride = "cleaning" | "maintenance";
export type BookingSource = "direct" | "airbnb" | "booking" | "gathern";

// Derived front-desk status (computed, not stored)
export type RoomStatus = "empty" | "booked" | "checkout" | "cleaning" | "maintenance";

export interface Profile {
  id: string; // = auth.users.id
  name: string;
  role: Role;
  created_at: string;
}

export interface Room {
  no: number; // 1..20, unique business key
  floor: number; // 1 or 2
  override: RoomOverride | null; // null = derive from bookings
  issue: string; // maintenance note (required when override = 'maintenance')
  photo_url: string | null; // Supabase Storage public URL
  description: string; // original text (admin language)
  description_tr: Record<string, string>; // cached translations, e.g. { en: "...", ar: "..." }
}

export interface Booking {
  id: string;
  room_no: number;
  guest_name: string;
  cc: string; // country code, e.g. "+966"
  phone: string;
  check_in: string; // 'YYYY-MM-DD'
  check_out: string; // 'YYYY-MM-DD'
  check_in_time: string; // 'HH:MM' (default 15:00)
  check_out_time: string; // 'HH:MM' (default 12:00)
  source: BookingSource;
  amount: number;
  rate: number; // nightly rate snapshot at time of booking
  reason: string; // note if amount is below expected
  checked_out: boolean;
  created_by: string | null;
  created_at: string;
}

export interface AppSettings {
  id: number; // singleton = 1
  daily_rate: number;
  currency: string; // 'SAR'
}

export interface RoomStatusHistory {
  id: string;
  room_no: number;
  status: string;
  note: string;
  changed_by: string | null;
  changed_at: string;
}

// Convenience shape for the Supabase typed client (optional to wire up)
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile };
      rooms: { Row: Room };
      bookings: { Row: Booking };
      app_settings: { Row: AppSettings };
      room_status_history: { Row: RoomStatusHistory };
    };
  };
}
