export type Lang = 'ar' | 'en';
export type Theme = 'light' | 'dark';
export type RoomOverride = 'cleaning' | 'maintenance' | null;
export type RoomStatus = 'empty' | 'booked' | 'checkout' | 'cleaning' | 'maintenance';
export type BookingSource = string; // free text — preset chips + custom input
export type BookingPhase = 'current' | 'upcoming' | 'past';
export type UserRole = 'admin' | 'staff';
export type NavPage = 'board' | 'timeline' | 'overview' | 'rooms' | 'employees' | 'villa' | 'apt';
export type ViewMode = 'grid' | 'list';
export type CalView = 'timeline' | 'month';
export type HistFilter = 'all' | 'current' | 'upcoming' | 'past';
export type DpField = 'in' | 'out';

export interface Room {
  no: number;
  floor: number;
  override: RoomOverride;
  issue: string;
  photo_url: string | null;
  description: string;
  description_tr: Record<string, string>;
  updated_at: string;
}

export interface Booking {
  id: string;
  room_no: number;
  guest_name: string;
  cc: string;
  phone: string;
  check_in: string;   // ISO date "YYYY-MM-DD"
  check_out: string;
  check_in_time: string;   // "HH:MM"
  check_out_time: string;
  source: BookingSource;
  amount: number;
  rate: number;
  reason: string;
  checked_out: boolean;
  created_by: string | null;
  created_at: string;
}

export interface AppSettings {
  id: number;
  daily_rate: number;
  currency: string;
}

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
  username: string;
}

export interface BookingForm {
  name: string;
  cc: string;
  phone: string;
  inDate: string | null;
  outDate: string | null;
  inTime: string;
  outTime: string;
  source: BookingSource;
  amount: string;
  amountAuto: boolean;
  reason: string;
}

export interface CountryCode {
  f: string;   // emoji flag
  d: string;   // dial code e.g. "+966"
  n: string;   // country name
}
