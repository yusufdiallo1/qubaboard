"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppState, useAppDispatch } from "@/lib/store";
import { getT } from "@/lib/i18n";

type PaletteItem = {
  id: string;
  label: string;
  sub?: string;
  icon?: string;
  action: () => void;
  group: string;
};

export default function CommandPalette() {
  const S = useAppState();
  const dispatch = useAppDispatch();
  const t = getT(S.lang);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const close = useCallback(() => {
    dispatch({ type: "SET_PALETTE_OPEN", payload: false });
    setQuery("");
    setActive(0);
  }, [dispatch]);

  // Open on Cmd/Ctrl+K or ?
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        dispatch({ type: "SET_PALETTE_OPEN", payload: !S.paletteOpen });
        setQuery("");
        setActive(0);
      }
      if (e.key === "Escape" && S.paletteOpen) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [S.paletteOpen, close, dispatch]);

  // Focus input when opened
  useEffect(() => {
    if (S.paletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [S.paletteOpen]);

  const isAdmin = S.user?.role === "admin";

  const navItems: PaletteItem[] = [
    {
      id: "nav-board",
      label: t("nav_board"),
      icon: "⊞",
      group: t("cmdNav"),
      action: () => {
        dispatch({ type: "SET_PAGE", payload: "board" });
        close();
      },
    },
    {
      id: "nav-timeline",
      label: t("nav_timeline"),
      icon: "▦",
      group: t("cmdNav"),
      action: () => {
        dispatch({ type: "SET_PAGE", payload: "timeline" });
        close();
      },
    },
    {
      id: "nav-overview",
      label: t("nav_overview"),
      icon: "▲",
      group: t("cmdNav"),
      action: () => {
        dispatch({ type: "SET_PAGE", payload: "overview" });
        close();
      },
    },
    ...(isAdmin
      ? [
          {
            id: "nav-rooms",
            label: t("nav_rooms"),
            icon: "⊟",
            group: t("cmdNav"),
            action: () => {
              dispatch({ type: "SET_PAGE", payload: "rooms" });
              close();
            },
          },
          {
            id: "nav-employees",
            label: t("nav_employees"),
            icon: "⊕",
            group: t("cmdNav"),
            action: () => {
              dispatch({ type: "SET_PAGE", payload: "employees" });
              close();
            },
          },
        ]
      : []),
  ];

  const themeItem: PaletteItem = {
    id: "toggle-theme",
    label: S.theme === "light" ? t("darkMode") : t("lightMode"),
    icon: S.theme === "light" ? "◑" : "○",
    group: t("cmdActions"),
    action: () => {
      const newTheme = S.theme === "light" ? "dark" : "light";
      dispatch({ type: "SET_THEME", payload: newTheme });
      close();
    },
  };

  const langItem: PaletteItem = {
    id: "toggle-lang",
    label: S.lang === "ar" ? "English" : "العربية",
    icon: "⊛",
    group: t("cmdActions"),
    action: () => {
      dispatch({ type: "SET_LANG", payload: S.lang === "ar" ? "en" : "ar" });
      close();
    },
  };

  // Room jump items — only match query
  const roomItems: PaletteItem[] = query
    ? S.rooms
        .filter(
          (r) =>
            String(r.no).includes(query) ||
            (r.description ?? "").toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 6)
        .map((r) => ({
          id: `room-${r.no}`,
          label: `${t("roomWord")} ${r.no}`,
          sub: r.description?.slice(0, 40) || undefined,
          icon: "▷",
          group: t("cmdJump"),
          action: () => {
            dispatch({
              type: "OPEN_SHEET",
              payload: { roomNo: r.no, from: "board" },
            });
            close();
          },
        }))
    : [];

  const allItems: PaletteItem[] = [
    ...navItems,
    themeItem,
    langItem,
    ...roomItems,
  ].filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      (item.sub ?? "").toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q)
    );
  });

  // Keyboard nav within list
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!S.paletteOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        allItems[active]?.action();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [S.paletteOpen, allItems, active]);

  // Reset active on query change
  useEffect(() => setActive(0), [query]);

  // Scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!S.paletteOpen) return null;

  // Group items
  const groups: Record<string, PaletteItem[]> = {};
  allItems.forEach((item) => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });
  let globalIdx = 0;

  return (
    <div
      className="palette-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("cmdPlaceholder")}
    >
      <div className="palette-box" role="combobox" aria-expanded="true">
        <div className="palette-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="palette-icon">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder={t("cmdPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-autocomplete="list"
            aria-controls="palette-list"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="palette-esc">ESC</kbd>
        </div>

        <div className="palette-list" id="palette-list" ref={listRef} role="listbox">
          {allItems.length === 0 && (
            <div className="palette-empty">{t("noData")}</div>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="palette-group">
              <div className="palette-group-label">{group}</div>
              {items.map((item) => {
                const idx = globalIdx++;
                return (
                  <button
                    key={item.id}
                    data-idx={idx}
                    className={`palette-item${active === idx ? " palette-item--active" : ""}`}
                    role="option"
                    aria-selected={active === idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={item.action}
                  >
                    <span className="palette-item-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="palette-item-text">
                      <span className="palette-item-label">{item.label}</span>
                      {item.sub && (
                        <span className="palette-item-sub">{item.sub}</span>
                      )}
                    </span>
                    {active === idx && (
                      <kbd className="palette-enter">↵</kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
