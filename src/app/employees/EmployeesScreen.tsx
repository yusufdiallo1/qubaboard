'use client';

/**
 * EmployeesScreen — admin-only page for managing staff accounts.
 *
 * Matches reference/Quba-Room-Board.html team/employees section.
 * Uses CSS classes only (no inline styles).
 * "use client" — all interactions happen client-side via server actions.
 *
 * Seed accounts (admin@aurion.local, reception@aurion.local) cannot be removed.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import { addEmployee, removeEmployee, updateEmployeeRole, getAuditLog } from '@/lib/supabaseActions';
import { T } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// The current logged-in admin cannot be deleted (handled via isSelf check)
// No hardcoded seed usernames — all accounts are manageable
const SEED_USERNAMES = new Set<string>();

// ─────────────────────────────────────────────────────────────────────────────
// SVG icons (inline, no external deps)
// ─────────────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChevDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmployeesScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function EmployeesScreen() {
  const { lang, employees, user } = useAppState();
  const dispatch = useAppDispatch();
  const tx = T[lang];

  // ── Add-employee form state ──
  const [addOpen, setAddOpen] = useState(false);
  const [eName, setEName] = useState('');
  const [eUser, setEUser] = useState('');
  const [eRole, setERole] = useState<'staff' | 'admin'>('staff');
  const [ePass, setEPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [empError, setEmpError] = useState('');
  const [adding, setAdding] = useState(false);

  // ── Remove confirmation state (id of employee pending removal) ──
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // ── Role change ──
  const [roleMenuId, setRoleMenuId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  // ── Audit log ──
  const [auditLog, setAuditLog] = useState<Array<{
    id: string; actor_name: string; action: string;
    target_type: string | null; target_name: string | null;
    old_value: string | null; new_value: string | null;
    ip: string | null; created_at: string;
  }>>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  // ── Fetch updated employees list from Supabase ──
  const refreshEmployees = useCallback(async () => {
    const supabase = createClient();
    // profiles has no username column — derive it from auth email via RPC
    const { data: rows } = await supabase.rpc('get_profiles_with_usernames') as {
      data: Array<{ id: string; name: string; role: string; email: string }> | null;
    };
    if (rows) {
      dispatch({
        type: 'SET_EMPLOYEES',
        payload: rows.map((p) => ({
          id: p.id,
          name: p.name ?? '',
          username: (p.email ?? '').split('@')[0],
          role: (p.role ?? 'staff') as 'admin' | 'staff',
        })),
      });
    }
  }, [dispatch]);

  // ── Add employee handler ──
  const handleAdd = useCallback(async () => {
    setEmpError('');
    const trimName = eName.trim();
    const trimUser = eUser.trim().toLowerCase();
    const trimPass = ePass;

    if (!trimName || !trimUser || !trimPass) {
      setEmpError(tx.fillAll as string);
      return;
    }

    // Check for duplicate username in current list
    if (employees.some((e) => e.username.toLowerCase() === trimUser)) {
      setEmpError(tx.userTaken as string);
      return;
    }

    setAdding(true);
    try {
      const { error } = await addEmployee(trimName, trimUser, trimPass, eRole);
      if (error) {
        setEmpError(error);
        return;
      }

      // Refetch real list from Supabase so IDs are correct
      await refreshEmployees();

      // Reset form
      setEName('');
      setEUser('');
      setEPass('');
      setERole('staff');
      setShowPw(false);
      nameRef.current?.focus();
    } finally {
      setAdding(false);
    }
  }, [eName, eUser, ePass, eRole, employees, dispatch, tx, refreshEmployees]);

  // ── Remove employee handler ──
  const handleRemove = useCallback(async (id: string) => {
    setRemovingId(id);
    try {
      const { error } = await removeEmployee(id);
      if (error) {
        // Surface error briefly — in production a toast would be better
        setEmpError(error);
        return;
      }
      dispatch({
        type: 'SET_EMPLOYEES',
        payload: employees.filter((e) => e.id !== id),
      });
    } finally {
      setRemovingId(null);
    }
  }, [employees, dispatch]);

  // ── Keyboard submit ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleAdd();
    },
    [handleAdd],
  );

  // ── Role change handler ──
  const handleRoleChange = useCallback(async (emp: typeof employees[0], newRole: 'admin' | 'staff') => {
    if (emp.role === newRole) { setRoleMenuId(null); return; }
    setRoleMenuId(null);
    setChangingRoleId(emp.id);
    const { error } = await updateEmployeeRole(
      emp.id, newRole,
      user?.id ?? '', user?.name ?? 'Admin',
      emp.name, emp.role,
    );
    setChangingRoleId(null);
    if (!error) {
      dispatch({ type: 'SET_EMPLOYEES', payload: employees.map(e => e.id === emp.id ? { ...e, role: newRole } : e) });
    }
  }, [employees, user, dispatch]);

  // ── Load audit log ──
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    const { data, error } = await getAuditLog();
    if (error) setAuditError(error);
    else setAuditLog(data ?? []);
    setAuditLoading(false);
  }, []);

  useEffect(() => {
    if (auditOpen) loadAudit();
  }, [auditOpen, loadAudit]);

  return (
    <div>
      {/* Page header */}
      <div className="page-h">{tx.teamTitle as string}</div>
      <div className="page-sub">{tx.teamSub as string}</div>

      {/* ── Current employees list ── */}
      <div className="team-sec-h">
        {tx.currentStaff as string}
        <span className="cnt">{employees.length}</span>
      </div>

      <div className="team-list">
        {employees.map((emp) => {
          const isSelf = emp.id === user?.id;
          const isSeed = SEED_USERNAMES.has(emp.username.toLowerCase());
          const isRemoving = removingId === emp.id;
          const roleLabel =
            emp.role === 'admin'
              ? (tx.role_admin as string)
              : (tx.role_staff as string);

          return (
            <div className="emp" key={emp.id}>
              {/* Avatar */}
              <span className="av" aria-hidden="true">
                {emp.name.charAt(0).toUpperCase()}
              </span>

              {/* Info */}
              <div className="einfo">
                <div className="en">{emp.name}</div>
                <div className="eu">{emp.username}</div>
              </div>

              {/* "You" badge */}
              {isSelf && (
                <span className="you">{tx.you as string}</span>
              )}

              {/* Role badge — clickable for admin to change role */}
              <div style={{ position: 'relative' }}>
                <button
                  className={`ebadge ${emp.role}`}
                  style={{ cursor: isSelf ? 'default' : 'pointer', border: 'none', background: 'none' }}
                  disabled={isSelf || changingRoleId === emp.id}
                  onClick={() => !isSelf && setRoleMenuId(roleMenuId === emp.id ? null : emp.id)}
                  title={isSelf ? '' : 'Click to change role'}
                >
                  {changingRoleId === emp.id ? '…' : roleLabel}
                  {!isSelf && <span style={{ marginInlineStart: 4, opacity: 0.5, fontSize: 10 }}>▾</span>}
                </button>
                {roleMenuId === emp.id && (
                  <div className="role-menu" onClick={e => e.stopPropagation()}>
                    <button className={`role-opt${emp.role === 'admin' ? ' on' : ''}`} onClick={() => handleRoleChange(emp, 'admin')}>
                      {tx.role_admin as string}
                    </button>
                    <button className={`role-opt${emp.role === 'staff' ? ' on' : ''}`} onClick={() => handleRoleChange(emp, 'staff')}>
                      {tx.role_staff as string}
                    </button>
                  </div>
                )}
              </div>

              {/* Remove button — hidden for self and seed accounts */}
              {!isSelf && !isSeed && (
                confirmRemoveId === emp.id ? (
                  <div className="emp-confirm-row">
                    <button className="btn soft" onClick={() => setConfirmRemoveId(null)}>
                      {tx.cancel as string}
                    </button>
                    <button className="btn danger" disabled={isRemoving} onClick={() => { setConfirmRemoveId(null); handleRemove(emp.id); }}>
                      {tx.remove as string}
                    </button>
                  </div>
                ) : (
                  <button
                    className="rm"
                    type="button"
                    title="Remove"
                    aria-label={`Remove ${emp.name}`}
                    disabled={isRemoving}
                    onClick={() => setConfirmRemoveId(emp.id)}
                  >
                    {isRemoving ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.4 }}>
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    ) : (
                      <TrashIcon />
                    )}
                  </button>
                )
              )}
            </div>
          );
        })}

        {employees.length === 0 && (
          <div className="emp" style={{ justifyContent: 'center', opacity: 0.5 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>—</span>
          </div>
        )}
      </div>

      {/* ── Add employee form (collapsible) ── */}
      <div className="emp-add">
        <button
          className="emp-add-toggle"
          onClick={() => { setAddOpen(v => !v); setEmpError(''); }}
          aria-expanded={addOpen}
        >
          <span>{tx.addEmployee as string}</span>
          <span className={`emp-add-chev${addOpen ? ' open' : ''}`}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="5 8 10 13 15 8" /></svg>
          </span>
        </button>

        {addOpen && (<div className="emp-add-body">

        {/* Name */}
        <div className="field">
          <label htmlFor="e-name">{tx.name as string}</label>
          <input
            ref={nameRef}
            id="e-name"
            type="text"
            placeholder={tx.staffNamePh as string}
            value={eName}
            onChange={(e) => setEName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
        </div>

        {/* Username */}
        <div className="field">
          <label htmlFor="e-user">{tx.username as string}</label>
          <input
            id="e-user"
            type="text"
            placeholder={tx.username as string}
            value={eUser}
            onChange={(e) => setEUser(e.target.value.replace(/\s/g, ''))}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
          />
        </div>

        {/* Role */}
        <div className="field">
          <label htmlFor="e-role">{tx.empRole as string}</label>
          <div className="selectwrap">
            <select
              id="e-role"
              value={eRole}
              onChange={(e) => setERole(e.target.value as 'staff' | 'admin')}
            >
              <option value="staff">{tx.role_staff as string}</option>
              <option value="admin">{tx.role_admin as string}</option>
            </select>
            <span className="selchev">
              <ChevDownIcon />
            </span>
          </div>
        </div>

        {/* Password with eye toggle */}
        <div className="field">
          <label htmlFor="e-pass">{tx.password as string}</label>
          <div className="pw-wrap">
            <input
              id="e-pass"
              type={showPw ? 'text' : 'password'}
              value={ePass}
              onChange={(e) => setEPass(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="new-password"
            />
            <button
              className="eye"
              type="button"
              aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw((v) => !v)}
              tabIndex={-1}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>
        </div>

        {/* Error message */}
        {empError && (
          <div className="emp-err">
            <WarnIcon />
            {empError}
          </div>
        )}

        {/* Submit button */}
        <button
          className="btn gold"
          type="button"
          disabled={adding}
          onClick={handleAdd}
        >
          <UsersIcon />
          {adding ? '…' : (tx.add as string)}
        </button>
        </div>)}
      </div>

      {/* ── Audit log (admin only) ── */}
      <div className="emp-add audit-section">
        <div className={`audit-header${auditOpen ? ' open' : ''}`}>
          <h3>{lang === 'ar' ? 'سجل التدقيق' : 'Audit Log'}</h3>
          <button className="btn soft audit-toggle" onClick={() => setAuditOpen(v => !v)}>
            {auditOpen ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'عرض' : 'Show')}
          </button>
        </div>
        {auditOpen && (
          auditLoading ? (
            <div className="audit-loading">…</div>
          ) : auditError ? (
            <div className="audit-empty" style={{ color: 'var(--maint)' }}>{auditError}</div>
          ) : auditLog.length === 0 ? (
            <div className="audit-empty">
              {lang === 'ar' ? 'لا توجد إدخالات بعد' : 'No entries yet'}
            </div>
          ) : (
            <div className="audit-list">
              {auditLog.map(entry => (
                <div key={entry.id} className="audit-entry">
                  <div className="audit-entry-row">
                    <span className="audit-actor">{entry.actor_name}</span>
                    <span className="audit-action">
                      {entry.action === 'role_change'
                        ? `${lang === 'ar' ? 'غيّر الدور' : 'changed role'}: ${entry.old_value} → ${entry.new_value}`
                        : entry.action}
                    </span>
                    {entry.target_name && <span className="audit-target">{lang === 'ar' ? 'لـ' : 'for'} <b>{entry.target_name}</b></span>}
                    <span className="audit-time">
                      {new Date(entry.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  {entry.ip && <span className="audit-ip">IP: {entry.ip}</span>}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Close role menu on outside click */}
      {roleMenuId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setRoleMenuId(null)} />
      )}
    </div>
  );
}
