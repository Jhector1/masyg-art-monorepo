// apps/<app>/tailwind.config.ts
import type { Config } from "tailwindcss";
import presetImport from "@acme/tailwind-preset";

// handle both ESM/CJS preset exports
const preset = (presetImport as any)?.default ?? presetImport;

export default {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx,js,jsx}",
    "../../packages/core/src/**/*.{ts,tsx,js,jsx}"
  ]
} satisfies Config;
