"use client";

import { useCallback, useRef } from "react";
import { useAppDispatch } from "@/lib/store";
import type { ToastVariant } from "@/lib/store";

let toastCounter = 0;

export function useToast() {
  const dispatch = useAppDispatch();
  const undoMap = useRef<Map<string, () => void>>(new Map());

  const toast = useCallback(
    (
      message: string,
      variant: ToastVariant = "success",
      opts?: { undoFn?: () => void; duration?: number }
    ) => {
      const id = `t${++toastCounter}`;
      const undoKey = opts?.undoFn ? id : undefined;
      if (opts?.undoFn && undoKey) {
        undoMap.current.set(undoKey, opts.undoFn);
      }
      dispatch({
        type: "PUSH_TOAST",
        payload: { id, message, variant, undoKey, duration: opts?.duration },
      });
      // Auto-dismiss
      const ms = opts?.duration ?? (undoKey ? 5000 : 3000);
      setTimeout(() => {
        dispatch({ type: "DISMISS_TOAST", payload: id });
        if (undoKey) undoMap.current.delete(undoKey);
      }, ms);
      return id;
    },
    [dispatch]
  );

  const triggerUndo = useCallback(
    (undoKey: string) => {
      const fn = undoMap.current.get(undoKey);
      if (fn) {
        fn();
        undoMap.current.delete(undoKey);
      }
      dispatch({ type: "DISMISS_TOAST", payload: undoKey });
    },
    [dispatch]
  );

  return { toast, triggerUndo };
}
