"use client";

import { useAppState } from "@/lib/store";
import { getT } from "@/lib/i18n";

export default function OfflineBanner() {
  const S = useAppState();
  const t = getT(S.lang);

  if (S.realtimeStatus !== "error") return null;

  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      <span className="offline-dot" />
      {t("offlineBanner")}
    </div>
  );
}
