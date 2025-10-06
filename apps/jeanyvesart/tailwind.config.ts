// apps/<app>/tailwind.config.ts
import type { Config } from "tailwindcss";
import presetImport from "@acme/tailwind-preset";
import path from 'path'
const r = (...p: string[]) => path.join(process.cwd(), ...p)
// handle both ESM/CJS preset exports
const preset = (presetImport as any)?.default ?? presetImport;

export default {
  presets: [preset],
  content: [
    // "./src/**/*.{ts,tsx}",
    // "../../packages/ui/src/**/*.{ts,tsx,js,jsx}",
    // "../../packages/core/src/**/*.{ts,tsx,js,jsx}",

      r('app/**/*.{js,ts,jsx,tsx,mdx}'),
    r('src/**/*.{js,ts,jsx,tsx,mdx}'),

    // shared workspaces used at runtime:
    r('../../packages/ui/**/*.{js,ts,jsx,tsx,mdx}'),
    r('../../packages/core/**/*.{js,ts,jsx,tsx,mdx}'),
    r('../../packages/server/**/*.{js,ts,jsx,tsx,mdx}'),
  ]
} satisfies Config;
