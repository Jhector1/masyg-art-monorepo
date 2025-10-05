// put this near the top of your file
import React, { useState } from "react";

// drop-in component
export function DescriptionCard({ text }: { text?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (text?.length ?? 0) > 260;

  return (
    <section
      aria-labelledby="product-desc"
      className="rounded-2xl border border-black/5 bg-white/70 p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">✦</span>
        <h3 id="product-desc" className="text-base font-semibold tracking-tight">
          Description
        </h3>
      </div>

      <div className="mt-3 text-sm leading-7 text-zinc-700">
        <p className={`${expanded ? "" : "line-clamp-6"}`}>
          {text || "—"}
        </p>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="mt-2 text-emerald-700 hover:text-emerald-800 underline underline-offset-4"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
    </section>
  );
}
