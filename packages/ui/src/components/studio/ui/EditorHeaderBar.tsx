// ───────────────────────────────────────────────────────────
// file: src/components/editor/ui/EditorHeaderBar.tsx
// ───────────────────────────────────────────────────────────
"use client";

import React from "react";
import type { ExportFormat } from "../types";
import ExportFormatBar from "./ExportFormatBar";
import { useDesignContext } from "../contexts/DesignContext"; // ⬅️ NEW
import { RedoIcon, RotateCcwIcon, UndoIcon } from "lucide-react";
// import { useLivePreview } from "../hooks/useLivePreview";

interface Props {
  loading: boolean;
  saving: boolean;
  canExport: boolean;
  purchased: boolean;
  exporting: boolean;
  purchasedDigital: boolean;
  exportsLeft: number;
  onSave: () => void;
  onQuickPng: () => void;
  onExport: (fmt: ExportFormat) => void;
  showControls: boolean;
    resetting: boolean;
    handleReset: () => void;
  onPurchaseClick: () => void;
  setShowControls: (f: (prev: boolean) => boolean) => void;
  onPurchaseArtClick: () => void;
}

export default function EditorHeaderBar({
  loading,
  saving,
  canExport,
  purchased,
  purchasedDigital,
  exporting,
  exportsLeft,
  onSave,
  onQuickPng,
  onExport,
  showControls,
  resetting, 
  handleReset,
  setShowControls,
  onPurchaseClick,
  onPurchaseArtClick,
}: Props) {
  // ⬅️ NEW: history controls
  const { undo, redo, canUndo, canRedo } = useDesignContext();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 p-3 md:p-4 ring-1 ring-black/5">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.125rem,2.5vw,1.5rem)] font-semibold">Zile Studio</h1>
        <p className="text-sm text-black/60">Edit colors & stroke, then export in PNG/JPG/WebP/TIFF/SVG.</p>
      </div>

      <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
        {/* ⬅️ NEW: Undo / Redo icon buttons */}
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo || loading || saving}
            title="Undo (Ctrl/⌘+Z)"
            aria-label="Undo"
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/10 bg-white",
              "hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            <UndoIcon/>
            {/* Undo icon (left arrow) */}
            {/* <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 14l-4-4 4-4" />
              <path d="M20 20a8 8 0 00-8-8H5" />
            </svg> */}
          </button>

          <button
            type="button"
            onClick={redo}
            disabled={!canRedo || loading || saving}
            title="Redo (Shift+Ctrl/⌘+Z or Ctrl+Y)"
            aria-label="Redo"
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/10 bg-white",
              "hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            <RedoIcon/>
            {/* Redo icon (right arrow) */}
            {/* <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l4 4-4 4" />
              <path d="M4 20a8 8 0 018-8h7" />
            </svg> */}
          </button>
        </div>

          {/* ⬇️ NEW: Reset */}
        <button
          type="button"
          onClick={handleReset}
          disabled={loading || saving || resetting}
          aria-busy={resetting}
          title="Reset design (deletes your saved design)"
          className={[
            "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            "ring-1 ring-rose-200 bg-white hover:bg-rose-50",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {resetting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
              </svg>
              <span>Resetting…</span>
            </>
          ) : (
            <>
              <RotateCcwIcon className="h-4 w-4" />
              <span>Reset</span>
            </>
          )}
        </button>

        <button
          onClick={onSave}
          disabled={saving || loading}
          aria-busy={saving}
          title={saving ? "Saving…" : "Save your current edit"}
          className={[
            "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            "ring-1 ring-black/10 bg-white hover:bg-emerald-50",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {saving ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
              </svg>
              <span>Saving…</span>
            </>
          ) : (
            <>
              <span role="img" aria-label="save">💾</span>
              <span>Save</span>
            </>
          )}
        </button>

        <button
          onClick={onQuickPng}
          className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-black/10 bg-white hover:bg-amber-50 disabled:opacity-60"
          disabled={loading}
          title="Quick download current view as PNG (client-side)"
        >
          Quick PNG
        </button>

        <span
          className={[
            "inline-flex items-center rounded-xl px-2 py-1 text-xs font-medium ring-1",
            exportsLeft <= 3 ? "text-amber-900 bg-amber-50 ring-amber-200" : "text-black/70 bg-white ring-black/10",
          ].join(" ")}
          title="Exports remaining"
        >
          {exportsLeft} left
        </span>

        <button
          onClick={onPurchaseClick}
          className={[
            "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium",
            "ring-1 ring-emerald-600/20",
            exportsLeft === 0 || !canExport
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-white text-emerald-700 hover:bg-emerald-50",
          ].join(" ")}
        >
          Buy exports
        </button>

        {!purchased || !purchasedDigital ? (
          <button
            onClick={onPurchaseArtClick}
            className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 ring-1 ring-indigo-600/20"
          >
            Purchase Now
          </button>
        ) : null}

        <ExportFormatBar
          purchasedDigital={purchasedDigital}
          purchased={purchased}
          formats={["png", "jpg", "webp", "tiff"]} //svg can be added
          canExport={canExport}
          exporting={exporting}
          loading={loading}
          exportsLeft={exportsLeft}
          onExport={onExport}
        />

        <button
          className="sm:hidden inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-black/10 bg-white hover:bg-emerald-50"
          onClick={() =>
            setShowControls((prev) => {
              const next = !prev;
              if (!prev) {
                const scroll = () => {
                  const el = document.getElementById("controls-panel");
                  if (el) {
                    el.setAttribute("tabindex", "-1");
                    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
                    el.focus({ preventScroll: true });
                  }
                };
                requestAnimationFrame(() => requestAnimationFrame(scroll));
              }
              return next;
            })
          }
          aria-expanded={showControls}
          aria-controls="controls-panel"
        >
          {showControls ? "Hide Controls" : "Show Controls"}
        </button>
      </div>
    </div>
  );
}











// ───────────────────────────────────────────────────────────
// file: src/components/editor/ui/EditorHeaderBar.tsx
// ───────────────────────────────────────────────────────────
// "use client";

// import React, { useState } from "react";
// import type { ExportFormat } from "../types";
// import ExportFormatBar from "./ExportFormatBar";
// import { useDesignContext } from "../contexts/DesignContext";
// import { RedoIcon, UndoIcon, RotateCcwIcon } from "lucide-react"; // ⬅️ add RotateCcwIcon

// interface Props {
//   loading: boolean;
//   saving: boolean;
//   canExport: boolean;
//   purchased: boolean;
//   exporting: boolean;
//   purchasedDigital: boolean;
//   exportsLeft: number;
//   onSave: () => void;
//   onQuickPng: () => void;
//   onExport: (fmt: ExportFormat) => void;
//   showControls: boolean;
//   onPurchaseClick: () => void;
//   setShowControls: (f: (prev: boolean) => boolean) => void;
//   onPurchaseArtClick: () => void;

//   /** ⬇️ NEW: needed so the header can call the DELETE API */
//   productId: string;
//   /** ⬇️ NEW: optional hook for parent to clear local state after delete */
//   onAfterReset?: () => void;
// }

// export default function EditorHeaderBar({
//   loading,
//   saving,
//   canExport,
//   purchased,
//   purchasedDigital,
//   exporting,
//   exportsLeft,
//   onSave,
//   onQuickPng,
//   onExport,
//   showControls,
//   setShowControls,
//   onPurchaseClick,
//   onPurchaseArtClick,
//   productId,
//   onAfterReset,
// }: Props) {
//   const { undo, redo, canUndo, canRedo } = useDesignContext();

//   // ⬇️ NEW
//   const [resetting, setResetting] = useState(false);
//   const handleReset = async () => {
//     if (!productId || resetting) return;
//     const ok = window.confirm(
//       "Reset this design?\n\nThis will delete your saved colors/preview for this product. This cannot be undone."
//     );
//     if (!ok) return;

//     try {
//       setResetting(true);
//       const res = await fetch(`/api/products/${productId}/saveUserDesign`, {
//         method: "DELETE",
//       });
//       if (!res.ok) {
//         // try to surface server error message
//         let msg = "Delete failed";
//         try {
//           const j = await res.json();
//           msg = j?.error || msg;
//         } catch {}
//         throw new Error(msg);
//       }
//       // Let parent wipe local state (style, preview, selections, etc.)
//       onAfterReset?.();
//     } catch (e: any) {
//       alert(e?.message || "Could not reset the design. Please try again.");
//     } finally {
//       setResetting(false);
//     }
//   };

//   return (
//     <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 p-3 md:p-4 ring-1 ring-black/5">
//       <div className="min-w-0">
//         <h1 className="text-[clamp(1.125rem,2.5vw,1.5rem)] font-semibold">Zile Studio</h1>
//         <p className="text-sm text-black/60">Edit colors & stroke, then export in PNG/JPG/WebP/TIFF/SVG.</p>
//       </div>

//       <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
//         {/* Undo / Redo */}
//         <div className="inline-flex items-center gap-1">
//           <button
//             type="button"
//             onClick={undo}
//             disabled={!canUndo || loading || saving}
//             title="Undo (Ctrl/⌘+Z)"
//             aria-label="Undo"
//             className={[
//               "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/10 bg-white",
//               "hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed",
//             ].join(" ")}
//           >
//             <UndoIcon />
//           </button>

//           <button
//             type="button"
//             onClick={redo}
//             disabled={!canRedo || loading || saving}
//             title="Redo (Shift+Ctrl/⌘+Z or Ctrl+Y)"
//             aria-label="Redo"
//             className={[
//               "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-black/10 bg-white",
//               "hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed",
//             ].join(" ")}
//           >
//             <RedoIcon />
//           </button>
//         </div>

//         {/* ⬇️ NEW: Reset */}
//         <button
//           type="button"
//           onClick={handleReset}
//           disabled={loading || saving || resetting}
//           aria-busy={resetting}
//           title="Reset design (deletes your saved design)"
//           className={[
//             "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
//             "ring-1 ring-rose-200 bg-white hover:bg-rose-50",
//             "disabled:opacity-60 disabled:cursor-not-allowed",
//           ].join(" ")}
//         >
//           {resetting ? (
//             <>
//               <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
//               </svg>
//               <span>Resetting…</span>
//             </>
//           ) : (
//             <>
//               <RotateCcwIcon className="h-4 w-4" />
//               <span>Reset</span>
//             </>
//           )}
//         </button>

//         {/* Save */}
//         <button
//           onClick={onSave}
//           disabled={saving || loading}
//           aria-busy={saving}
//           title={saving ? "Saving…" : "Save your current edit"}
//           className={[
//             "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
//             "ring-1 ring-black/10 bg-white hover:bg-emerald-50",
//             "disabled:opacity-60 disabled:cursor-not-allowed",
//           ].join(" ")}
//         >
//           {saving ? (
//             <>
//               <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 008 12H4z" />
//               </svg>
//               <span>Saving…</span>
//             </>
//           ) : (
//             <>
//               <span role="img" aria-label="save">💾</span>
//               <span>Save</span>
//             </>
//           )}
//         </button>

//         {/* Quick PNG, counters, purchase, formats ... (unchanged) */}
//         {/* ... keep the rest of your existing JSX ... */}

//         <ExportFormatBar
//           purchasedDigital={purchasedDigital}
//           purchased={purchased}
//           formats={["png", "jpg", "webp", "tiff", "svg"]}
//           canExport={canExport}
//           exporting={exporting}
//           loading={loading}
//           exportsLeft={exportsLeft}
//           onExport={onExport}
//         />

//         <button
//           className="sm:hidden inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-black/10 bg-white hover:bg-emerald-50"
//           onClick={() =>
//             setShowControls((prev) => {
//               const next = !prev;
//               if (!prev) {
//                 const scroll = () => {
//                   const el = document.getElementById("controls-panel");
//                   if (el) {
//                     el.setAttribute("tabindex", "-1");
//                     el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
//                     el.focus({ preventScroll: true });
//                   }
//                 };
//                 requestAnimationFrame(() => requestAnimationFrame(scroll));
//               }
//               return next;
//             })
//           }
//           aria-expanded={showControls}
//           aria-controls="controls-panel"
//         >
//           {showControls ? "Hide Controls" : "Show Controls"}
//         </button>
//       </div>
//     </div>
//   );
// }
