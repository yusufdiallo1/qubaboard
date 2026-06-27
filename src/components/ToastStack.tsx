"use client";

import { useAppState, useAppDispatch } from "@/lib/store";
import { getT } from "@/lib/i18n";

export default function ToastStack() {
  const S = useAppState();
  const dispatch = useAppDispatch();
  const t = getT(S.lang);

  if (!S.toasts.length) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {S.toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-item--${toast.variant} toast-item--in`}
          role="status"
        >
          <span className="toast-msg">{toast.message}</span>
          {toast.undoKey && (
            <button
              className="toast-undo"
              onClick={() => {
                dispatch({ type: "DISMISS_TOAST", payload: toast.id });
                // trigger undo via custom event — useToast will handle it
                window.dispatchEvent(
                  new CustomEvent("quba:undo", { detail: toast.undoKey })
                );
              }}
            >
              {t("undo")}
            </button>
          )}
          <button
            className="toast-close"
            aria-label="Dismiss"
            onClick={() =>
              dispatch({ type: "DISMISS_TOAST", payload: toast.id })
            }
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
