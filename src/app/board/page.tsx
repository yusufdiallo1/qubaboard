import AppProvider from '@/components/AppProvider';
import AppShell    from '@/components/AppShell';

/**
 * Board page — the main entry point after login.
 * AppProvider sets up the store, loads auth/data, and applies lang/theme.
 * AppShell renders the full shell: topbar, sidenav, content area, sheet, toast.
 */
export default function BoardPage() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
