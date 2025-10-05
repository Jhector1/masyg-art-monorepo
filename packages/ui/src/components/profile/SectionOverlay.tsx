"use client";

export default function SectionOverlay({
  show,
  label = "Updating…",
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="pointer-events-auto absolute inset-0 z-10 rounded-2xl
                 bg-white/65 backdrop-blur-sm ring-1 ring-black/5
                 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      {/* soft skeleton shimmer */}
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      <div className="relative flex h-full items-center justify-center">
        <svg
          className="h-5 w-5 animate-spin text-indigo-600"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
        <span className="ml-2 text-sm font-medium text-gray-700">{label}</span>
      </div>
    </div>
  );
}
