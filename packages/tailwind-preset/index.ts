// packages/tailwind-preset/index.ts
import type { Config } from "tailwindcss";

const preset: Config = {
  // v4: do NOT include `content` in a preset
  // theme: {
  //   extend: {
  //     /* ---------- COLORS ---------- */
  //     colors: {
  //       background: "hsl(0 0% 100%)",
  //       foreground: "hsl(222 47% 10%)",
  //       primary: "hsl(222 47% 11%)",
  //       "primary-foreground": "hsl(0 0% 100%)",
  //       muted: "hsl(215 16% 95%)",
  //       "muted-foreground": "hsl(xx215 10% 40%)",
  //       surface: "#0b0f19",
  //     },

  //     /* ---------- RADII ---------- */
  //     borderRadius: {
  //       xl: "1rem",
  //       "2xl": "1.25rem",
  //     },

  //     /* ---------- BACKGROUND IMAGES (unique keys) ---------- */
  //     backgroundImage: {
  //       "grid-dots":
  //         "radial-gradient(circle at 0 0, rgba(255,255,255,0.10) 1px, transparent 1px)",
  //       "grid-tiles":
  //         "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 16px), \
  //          repeating-linear-gradient(180deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 16px)",
  //       "hero-radial":
  //         "radial-gradient(circle at 25% 25%, rgba(0,255,195,0.10), transparent 45%), \
  //          radial-gradient(circle at 75% 75%, rgba(0,140,255,0.10), transparent 50%)",
  //     },

  //     /* ---------- BACKGROUND SIZE (use a different key) ---------- */
  //     backgroundSize: {
  //       "grid-dots-size": "20px 20px",
  //     },
  //   },
  // },

  // /* Optional: CSS variables / base resets */
  // plugins: [
  //   function ({ addBase }) {
  //     addBase({
  //       ":root": {
  //         "--radius-xl": "1rem",
  //         "--radius-2xl": "1.25rem",
  //       },
  //       "html, body": { height: "100%" },
  //     });
  //   },
  // ],
};

export default preset;
