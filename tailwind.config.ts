import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ── Aurion brand ──────────────────────────────
        navy: { DEFAULT: "#1B2A47", deep: "#0E1726", soft: "#2A3A5C" },
        gold: { DEFAULT: "#C6A253", deep: "#A4924E", soft: "#E0CFA0" },
        cream: "#F6F1E7",
        ink: "#211F1A",

        // ── Status (semantic, fixed across themes) ────
        free: "#2FA36B",
        booked: "#C6A253",
        checkout: "#E0823C",
        cleaning: "#7C6BB0",
        maint: "#CC4B4B",
        info: "#2B5FA5",

        // ── Extra accents (charts, badges) ────────────
        teal: "#2BA39A",
        sky: "#4C8FD6",
        plum: "#8E6FB0",
        amber: "#E0A53C",
        rose: "#D46A8B",

        // ── Theme-aware surfaces (driven by CSS vars) ──
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: { xl: "18px", lg: "14px", md: "12px" },
      boxShadow: {
        card: "0 1px 2px rgba(16,23,38,.04), 0 8px 24px rgba(16,23,38,.06)",
        lift: "0 4px 10px rgba(16,23,38,.06), 0 20px 50px rgba(16,23,38,.12)",
        glow: "0 0 0 1px rgba(198,162,83,.25), 0 12px 40px rgba(198,162,83,.18)",
      },
      keyframes: {
        // Resend-style: soft rise + fade
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // slow drifting brand glow behind hero sections
        glow: {
          "0%,100%": { opacity: ".5", transform: "translate3d(0,0,0) scale(1)" },
          "50%": { opacity: ".8", transform: "translate3d(0,-8px,0) scale(1.05)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up .55s cubic-bezier(.22,.61,.36,1) both",
        "fade-in": "fade-in .5s ease both",
        "scale-in": "scale-in .4s cubic-bezier(.22,.61,.36,1) both",
        "slide-up": "slide-up .35s cubic-bezier(.22,.61,.36,1) both",
        shimmer: "shimmer 2.2s linear infinite",
        glow: "glow 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
