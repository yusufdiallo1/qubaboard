/**
 * Global app store — React context + useReducer.
 *
 * This file is plain TypeScript (no JSX).
 * The <AppProvider> React component lives in ./AppProvider.tsx and re-exports
 * everything from here so consumers can do either:
 *
 *   import { useAppState, AppProvider } from '@/lib/AppProvider';
 *   import { useAppState }              from '@/lib/store';          // no JSX needed
 */

import { createContext, useContext, useReducer } from 'react';
import type { Dispatch } from 'react';
import type {
  Lang,
  Theme,
  NavPage,
  ViewMode,
  CalView,
  HistFilter,
  DpField,
  CurrentUser,
  Room,
  Booking,
  AppSettings,
  BookingForm,
} from './types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AppState {
  // Global
  lang: Lang;
  theme: Theme;
  view: ViewMode;
  page: NavPage;

  // Board
  filter: string; // 'all'|'empty'|'booked'|'checkout'|'cleaning'|'maintenance'|'arrivals'
  search: string;
  filterOpen: boolean;
  menuOpen: boolean;
  drawerOpen: boolean;

  // Sheet
  open: number | null;          // room number
  editing: boolean;
  openBookingId: string | null;
  newBookingDate: string | null;
  sheetError: string;
  form: BookingForm | null;
  dpOpen: DpField | null;
  dpMonth: string | null;
  ccOpen: boolean;
  ccSearch: string;
  openFrom: 'board' | 'rooms';

  // Timeline
  tlStart: number;
  calView: CalView;
  calMonthOffset: number;

  // Maintenance
  maintEntry: number | null;
  maintErr: string;

  // History
  histFilter: HistFilter;

  // Data (from Supabase)
  rooms: Room[];
  bookings: Booking[];
  settings: AppSettings | null;

  // Auth
  user: CurrentUser | null;

  // Rate saved animation
  rateSaved: boolean;

  // Realtime connection status
  realtimeStatus: 'connecting' | 'ok' | 'error';

  // Employees (fetched from profiles table)
  employees: { id: string; name: string; username: string; role: 'admin' | 'staff' }[];
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialState: AppState = {
  // Global
  lang: 'ar',
  theme: 'light',
  view: 'grid',
  page: 'board',

  // Board
  filter: 'all',
  search: '',
  filterOpen: false,
  menuOpen: false,
  drawerOpen: false,

  // Sheet
  open: null,
  editing: false,
  openBookingId: null,
  newBookingDate: null,
  sheetError: '',
  form: null,
  dpOpen: null,
  dpMonth: null,
  ccOpen: false,
  ccSearch: '',
  openFrom: 'board',

  // Timeline
  tlStart: 0,
  calView: 'timeline',
  calMonthOffset: 0,

  // Maintenance
  maintEntry: null,
  maintErr: '',

  // History
  histFilter: 'all',

  // Data
  rooms: [],
  bookings: [],
  settings: null,

  // Auth
  user: null,

  // Rate saved animation
  rateSaved: false,

  // Realtime connection status
  realtimeStatus: 'connecting',

  // Employees
  employees: [],
};

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type AppAction =
  // Global
  | { type: 'SET_LANG'; payload: Lang }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_VIEW'; payload: ViewMode }
  | { type: 'SET_PAGE'; payload: NavPage }

  // Board
  | { type: 'SET_FILTER'; payload: string }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_FILTER_OPEN'; payload: boolean }
  | { type: 'SET_MENU_OPEN'; payload: boolean }
  | { type: 'SET_DRAWER_OPEN'; payload: boolean }

  // Sheet
  | { type: 'OPEN_SHEET'; payload: { roomNo: number; from: 'board' | 'rooms'; bookingId?: string; date?: string } }
  | { type: 'CLOSE_SHEET' }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'SET_FORM'; payload: BookingForm | null }
  | { type: 'UPDATE_FORM'; payload: Partial<BookingForm> }
  | { type: 'SET_DP_OPEN'; payload: DpField | null }
  | { type: 'SET_DP_MONTH'; payload: string | null }
  | { type: 'SET_CC_OPEN'; payload: boolean }
  | { type: 'SET_CC_SEARCH'; payload: string }

  // Timeline
  | { type: 'SET_TL_START'; payload: number }
  | { type: 'SET_CAL_VIEW'; payload: CalView }
  | { type: 'SET_CAL_MONTH_OFFSET'; payload: number }

  // Maintenance
  | { type: 'SET_MAINT_ENTRY'; payload: number | null }
  | { type: 'SET_MAINT_ERR'; payload: string }

  // History
  | { type: 'SET_HIST_FILTER'; payload: HistFilter }

  // Data
  | { type: 'SET_ROOMS'; payload: Room[] }
  | { type: 'SET_BOOKINGS'; payload: Booking[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings | null }
  | { type: 'SET_EMPLOYEES'; payload: { id: string; name: string; username: string; role: 'admin' | 'staff' }[] }
  | { type: 'UPSERT_BOOKING'; payload: Booking }
  | { type: 'DELETE_BOOKING'; payload: string }   // booking id
  | { type: 'UPDATE_ROOM'; payload: Partial<Room> & { no: number } }

  // Auth
  | { type: 'SET_USER'; payload: CurrentUser | null }
  | { type: 'SIGN_OUT' }

  // Rate saved animation
  | { type: 'SET_RATE_SAVED'; payload: boolean }

  // Realtime
  | { type: 'SET_REALTIME_STATUS'; payload: 'connecting' | 'ok' | 'error' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // ---- Global ----
    case 'SET_LANG':
      return { ...state, lang: action.payload };

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'SET_VIEW':
      return { ...state, view: action.payload };

    case 'SET_PAGE':
      return { ...state, page: action.payload };

    // ---- Board ----
    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    case 'SET_SEARCH':
      return { ...state, search: action.payload };

    case 'SET_FILTER_OPEN':
      return { ...state, filterOpen: action.payload };

    case 'SET_MENU_OPEN':
      return { ...state, menuOpen: action.payload };

    case 'SET_DRAWER_OPEN':
      return { ...state, drawerOpen: action.payload };

    // ---- Sheet ----
    case 'OPEN_SHEET':
      return {
        ...state,
        open: action.payload.roomNo,
        openFrom: action.payload.from,
        openBookingId: action.payload.bookingId ?? null,
        newBookingDate: action.payload.date ?? null,
        editing: false,
        sheetError: '',
        form: null,
        dpOpen: null,
        dpMonth: null,
        ccOpen: false,
        ccSearch: '',
        maintEntry: null,
        maintErr: '',
      };

    case 'CLOSE_SHEET':
      return {
        ...state,
        open: null,
        editing: false,
        openBookingId: null,
        newBookingDate: null,
        sheetError: '',
        form: null,
        dpOpen: null,
        dpMonth: null,
        ccOpen: false,
        ccSearch: '',
        maintEntry: null,
        maintErr: '',
      };

    case 'SET_EDITING':
      return { ...state, editing: action.payload };

    case 'SET_FORM':
      return { ...state, form: action.payload };

    case 'UPDATE_FORM':
      if (!state.form) return state;
      return { ...state, form: { ...state.form, ...action.payload } };

    case 'SET_DP_OPEN':
      return { ...state, dpOpen: action.payload };

    case 'SET_DP_MONTH':
      return { ...state, dpMonth: action.payload };

    case 'SET_CC_OPEN':
      return { ...state, ccOpen: action.payload };

    case 'SET_CC_SEARCH':
      return { ...state, ccSearch: action.payload };

    // ---- Timeline ----
    case 'SET_TL_START':
      return { ...state, tlStart: action.payload };

    case 'SET_CAL_VIEW':
      return { ...state, calView: action.payload };

    case 'SET_CAL_MONTH_OFFSET':
      return { ...state, calMonthOffset: action.payload };

    // ---- Maintenance ----
    case 'SET_MAINT_ENTRY':
      return { ...state, maintEntry: action.payload };

    case 'SET_MAINT_ERR':
      return { ...state, maintErr: action.payload };

    // ---- History ----
    case 'SET_HIST_FILTER':
      return { ...state, histFilter: action.payload };

    // ---- Data ----
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload };

    case 'SET_BOOKINGS':
      return { ...state, bookings: action.payload };

    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };

    case 'SET_EMPLOYEES':
      return { ...state, employees: action.payload };

    case 'UPSERT_BOOKING': {
      const idx = state.bookings.findIndex((b) => b.id === action.payload.id);
      if (idx === -1) {
        return { ...state, bookings: [...state.bookings, action.payload] };
      }
      const updated = [...state.bookings];
      updated[idx] = action.payload;
      return { ...state, bookings: updated };
    }

    case 'DELETE_BOOKING':
      return {
        ...state,
        bookings: state.bookings.filter((b) => b.id !== action.payload),
      };

    case 'UPDATE_ROOM': {
      const { no, ...patch } = action.payload;
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.no === no ? { ...r, ...patch } : r)),
      };
    }

    // ---- Auth ----
    case 'SET_USER':
      return { ...state, user: action.payload };

    case 'SIGN_OUT':
      // Preserve visual preferences across sign-out
      return { ...initialState, lang: state.lang, theme: state.theme };

    // ---- Rate saved animation ----
    case 'SET_RATE_SAVED':
      return { ...state, rateSaved: action.payload };

    // ---- Realtime ----
    case 'SET_REALTIME_STATUS':
      return { ...state, realtimeStatus: action.payload };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export const AppStateContext = createContext<AppState | undefined>(undefined);
export const AppDispatchContext = createContext<Dispatch<AppAction> | undefined>(undefined);

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (ctx === undefined) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return ctx;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const ctx = useContext(AppDispatchContext);
  if (ctx === undefined) {
    throw new Error('useAppDispatch must be used within an AppProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// useAppReducer — used by AppProvider.tsx to create the store
// ---------------------------------------------------------------------------

export function useAppReducer(seed?: Partial<AppState>) {
  return useReducer(appReducer, seed ? { ...initialState, ...seed } : initialState);
}
