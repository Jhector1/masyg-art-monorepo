'use client'// packages/ui/src/TestBlock.tsx
export function TestBlock() {
  return (
    <div className="space-y-6 p-6 border rounded-xl">
      <div className="bg-emerald-900 text-white p-4 rounded-lg">UI OK?</div>
      <div className="bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 h-10 rounded-lg" />
      <div className="bg-hero-radial h-16 rounded-lg" />
      <div className="text-yellow-600">Hello</div>
    </div>
  );
}

// packages/ui/src/index.ts
// export * from "./TestBlock";
