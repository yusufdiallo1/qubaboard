"use client";

/** Shimmer skeleton building blocks. No Tailwind — CSS class only. */

export function SkeletonRect({
  w = "100%",
  h = 16,
  r = 8,
  className = "",
}: {
  w?: string | number;
  h?: number;
  r?: number;
  className?: string;
}) {
  return (
    <div
      className={`skel ${className}`}
      style={{
        width: typeof w === "number" ? `${w}px` : w,
        height: `${h}px`,
        borderRadius: `${r}px`,
      }}
      aria-hidden="true"
    />
  );
}

/** Board tile skeleton */
export function TileSkeleton() {
  return (
    <div className="tile" aria-hidden="true" style={{ minHeight: 128 }}>
      <div className="tile-photo skel" style={{ height: 86 }} />
      <div className="tile-inner" style={{ gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SkeletonRect w={44} h={32} r={6} />
          <SkeletonRect w={72} h={22} r={11} />
        </div>
        <SkeletonRect w="70%" h={14} />
        <SkeletonRect w="50%" h={12} />
      </div>
    </div>
  );
}

/** Board grid skeleton — renders N tile placeholders */
export function BoardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading rooms…">
      {Array.from({ length: count }, (_, i) => (
        <TileSkeleton key={i} />
      ))}
    </div>
  );
}

/** KPI stat card skeleton */
export function StatSkeleton() {
  return (
    <div className="stat" aria-hidden="true">
      <div className="sl" style={{ marginBottom: 12 }}>
        <SkeletonRect w={32} h={32} r={9} />
        <SkeletonRect w="60%" h={13} />
      </div>
      <SkeletonRect w="55%" h={28} r={6} />
      <div className="sbar" style={{ marginTop: 12 }}>
        <SkeletonRect w="40%" h={7} r={4} className="" />
      </div>
    </div>
  );
}

/** Overview stats grid skeleton */
export function StatsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="stats" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <StatSkeleton key={i} />
      ))}
    </div>
  );
}

/** Chart panel skeleton */
export function ChartSkeleton({ h = 160 }: { h?: number }) {
  return (
    <div className="panel" aria-hidden="true" style={{ minHeight: h + 56 }}>
      <SkeletonRect w="45%" h={14} r={7} />
      <div style={{ marginTop: 20 }}>
        <SkeletonRect w="100%" h={h} r={10} />
      </div>
    </div>
  );
}

/** Timeline row skeleton */
export function TimelineSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 4, height: 40 }}>
          <SkeletonRect w={48} h={40} r={8} />
          {Array.from({ length: 10 }, (_, j) => (
            <SkeletonRect key={j} w="100%" h={40} r={8} />
          ))}
        </div>
      ))}
    </div>
  );
}
