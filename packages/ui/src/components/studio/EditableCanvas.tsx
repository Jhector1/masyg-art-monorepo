// src/components/editor/EditableCanvas.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@acme/core/contexts/UserContext";

import { DesignProvider, useDesignContext } from "./contexts/DesignContext";
import { useLivePreview } from "./hooks/useLivePreview";
import { useCanvasRender } from "./hooks/useCanvasRender";
import { useSaveDesign } from "./hooks/useSaveDesign";
import { useExportArtwork } from "./hooks/useExportArtwork";

import EditorHeaderBar from "./ui/EditorHeaderBar";
import CanvasStage from "./ui/CanvasStage";
import Palette from "./ui/Palette";
import AppearanceControls from "./ui/AppearanceControls";
import ExportSizeControls from "./ui/ExportSizeControls";

import type { ExportMode, ExportUnit, StyleState } from "./types";
// import { DEFAULT_STYLE } from "./utils/constants";
import { usePurchaseExports } from "./hooks/usePurchaseExports";
import PurchaseExportsModal from "./ui/PurchaseExportsModal";
import PurchaseArtModal from "./ui/PurchaseArtModal";
import { useLeaveConfirm } from "./hooks/useLeaveConfirm";

// ————————————————————————————————————————————————————————————————
// Skeletons (unchanged)
// ————————————————————————————————————————————————————————————————
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={["animate-pulse rounded-md bg-zinc-100", className].join(" ")}
    />
  );
}
function HeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 p-3 md:p-4 ring-1 ring-black/5">
      <div className="min-w-0">
        <Skeleton className="h-5 w-48 mb-2 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>
      <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-20 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl sm:hidden" />
      </div>
    </div>
  );
}

function BootLayoutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl py-4 md:py-6">
      <HeaderSkeleton />

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px] gap-4">
        <div className="relative rounded-2xl bg-white p-3 ring-1 ring-black/5">
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
          <div className="relative grid place-items-center overflow-auto rounded-xl bg-[conic-gradient(at_20%_20%,#fafafa,#f4f4f5)] p-2 sm:p-4 max-h-[70vh] md:max-h-[72vh]">
            <div className="w-full h-[48vh] sm:h-[60vh] rounded-xl ring-1 ring-black/5 bg-white grid place-items-center">
              <Skeleton className="h-[90%] w-[90%] rounded-xl" />
            </div>
          </div>
        </div>

        <aside className="rounded-2xl bg-white py-4 ring-1 ring-black/5 md:sticky md:top-4 md:h-fit">
          <div className="mb-4 rounded-2xl border border-black/10 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-4 w-24" />
              <div className="flex overflow-hidden rounded-xl ring-1 ring-black/10">
                <Skeleton className="h-7 w-16 rounded-none" />
                <Skeleton className="h-7 w-16 rounded-none" />
                <Skeleton className="h-7 w-20 rounded-none" />
              </div>
            </div>
            <div className="mb-3">
              <Skeleton className="h-3 w-16 mb-2" />
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg"
                  />
                ))}
              </div>
            </div>
            <div className="mb-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-12 rounded-lg" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-3 w-20 mb-2" />
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-12 rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          <Skeleton className="h-4 w-28 mb-3" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full col-span-2 rounded-md" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="col-span-2 flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>

          <Skeleton className="h-4 w-24 mb-3" />
          <div className="mb-2 flex gap-1 rounded-xl bg-white ring-1 ring-black/10 p-1 overflow-x-auto">
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-4 w-14" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs">
            <Skeleton className="h-4 w-40" />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Main editor
// ————————————————————————————————————————————————————————————————
function EditableCanvasInner({ productId }: { productId: string }) {
  const { isLoggedIn } = useUser();
  const { style, setStyle, defsMap, setDefsMap } = useDesignContext();
// const [reloadTick, setReloadTick] = useState(0);

  const { previewUrl, loading,handleReset, updatePreview, baseW, baseH, onImageLoad } =
    useLivePreview(productId);
  const { canvasRef, zoom, setZoom, drawUrl } = useCanvasRender();
  const { saveDesign, saving } = useSaveDesign(productId);
  const {
    exporting,
    canExport,
    purchased,
    exportsLeft,
    quickDownloadPng,
    refreshExportStatus,
    purchasedDigital,
    exportArtwork,
    fetchInitialExportStatus,
  } = useExportArtwork(productId);

  const [showControls, setShowControls] = useState(false);

  const [exportMode, setExportMode] = useState<ExportMode>("scale");
  const [scale, setScale] = useState(1);
  const [outW, setOutW] = useState("");
  const [outH, setOutH] = useState("");
  const [dpi, setDpi] = useState(300);
  const [unit, setUnit] = useState<ExportUnit>("in");
  const [printW, setPrintW] = useState(8);
  const [printH, setPrintH] = useState(10);
  const [booting, setBooting] = useState(true);
  const [headerBooting, setHeaderBooting] = useState<boolean>(false);

  // Exports (credits) modal
  const [showPurchase, setShowPurchase] = useState(false);
  const { busy: purchasing } = usePurchaseExports(productId);

  // Art purchase modal
  const [showBuyArt, setShowBuyArt] = useState(false);
  // const [creatingCheckout, setCreatingCheckout] = useState(false);

  // simple selector state for digital purchase
  // const selectedFormat = "png";
  const selectedLicense = "personal";

  // defs as a single stable string
  const defsString = useMemo(
    () => Object.values(defsMap).join("\n"),
    [defsMap]
  );
  // ——— unsaved-changes tracking
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedRef = React.useRef<string>(""); // snapshot of last saved state
  const dirtyRef = React.useRef(false); // ref for event listener closure

  // Serialize current editor state
  const currentHash = useMemo(
    () => JSON.stringify({ style, defs: defsString }),
    [style, defsString]
  );
  // in a component that stays mounted (e.g., editor page)
  // const { refreshExportStatus } = useExportArtwork(productId);

  useEffect(() => {
    let dead = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const refreshWithRetry = async (tries = 8, ms = 600) => {
      for (let i = 0; i < tries; i++) {
        const ok = await refreshExportStatus(); // should return boolean; if not, treat truthy
        if (ok) break;
        await sleep(ms);
      }
    };

    const stop = () => {
      if (!dead) setHeaderBooting(false);
    };

    const onComplete = async () => {
      try {
        await refreshWithRetry();
      } finally {
        stop();
      } // ✅ even if webhook isn’t done after retries, don’t leave header spinning
    };

    const onAbortOrError = () => stop();

    window.addEventListener("checkout-complete", onComplete);
    window.addEventListener("checkout-abort", onAbortOrError);
    window.addEventListener("checkout-error", onAbortOrError);

    return () => {
      dead = true;
      window.removeEventListener("checkout-complete", onComplete);
      window.removeEventListener("checkout-abort", onAbortOrError);
      window.removeEventListener("checkout-error", onAbortOrError);
    };
  }, [refreshExportStatus, setHeaderBooting]);

  // Keep state + ref in sync
  useEffect(() => {
    setIsDirty(currentHash !== lastSavedRef.current);
  }, [currentHash]);
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);







// inside EditableCanvasInner component
const { undo, redo } = useDesignContext();

React.useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const shift = e.shiftKey;

    // Undo: Cmd/Ctrl + Z
    if (e.key.toLowerCase() === "z" && !shift) {
      e.preventDefault();
      undo();
    }
    // Redo: Shift + Cmd/Ctrl + Z  (and also Ctrl+Y)
    if ((e.key.toLowerCase() === "z" && shift) || e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [undo, redo]);









  // Warn on refresh/close if dirty
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = ""; // required for Chrome
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  // ——— helper: quote price from your server (fallback to 0 if not available)
  // const quotePrice = async (variant: "digital" | "print", quantity: number) => {
  //   try {
  //     const res = await fetch("/api/pricing/quote", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         productId,
  //         variant,
  //         quantity,
  //         digital:
  //           variant === "digital"
  //             ? { format: selectedFormat, license: selectedLicense }
  //             : null,
  //         print:
  //           variant === "print"
  //             ? {
  //                 format: "jpg",
  //                 size: `${printW}x${printH}`,
  //                 material: null,
  //                 frame: null,
  //               }
  //             : null,
  //         // If your price depends on style/defs, include them:
  //         // style, defs: defsString,
  //       }),
  //     });
  //     if (!res.ok) throw new Error("no quote");
  //     const j = await res.json();
  //     return Number(j?.price) || 0;
  //   } catch {
  //     return 0;
  //   }
  // };

  // ——— initial boot: export status, load saved design, render fallback
  function reloadStatus(){
let cancelled = false;

    (async () => {
      await fetchInitialExportStatus();


      try {
        const s = await fetch(`/api/products/${productId}/saveUserDesign`, {
          cache: "no-store",
        });
        if (s.ok) {
          const j = await s.json();
          if (!cancelled && j?.found) {
            // AFTER (no DEFAULT_STYLE merge; use API as source of truth)
            const savedStyle = (j.style || {}) as StyleState;
            const savedDefs: string = j.defs || "";
            setStyle(savedStyle);
            setDefsMap(savedDefs ? { __persisted: savedDefs } : {});
            await updatePreview(savedStyle, savedDefs);

            // snapshot exactly what we just applied
            lastSavedRef.current = JSON.stringify({
              style: savedStyle,
              defs: savedDefs,
            });
            setIsDirty(false);

            setBooting(false);
            return;
          }
        }
      } catch {}
      try {
        const res = await fetch(`/api/products/${productId}/live-preview`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load preview");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        await drawUrl(url);
        lastSavedRef.current = JSON.stringify({
          style: { ...style },
          defs: defsString,
        });
        setIsDirty(false);
      } catch (err) {
        console.error(err);
      } finally {
        setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }
  useEffect(() => {
    reloadStatus();
  }, [
    productId,
    setStyle,
    setDefsMap,
    fetchInitialExportStatus,
    drawUrl,
    // defsString, style
      // reloadTick,           // ⬅️ add this

    updatePreview,
  ]);

  // debounced live preview
  useEffect(() => {
    if (booting) return;
    const id = window.setTimeout(() => {
      void updatePreview(style, defsString);
    }, 250);
    return () => window.clearTimeout(id);
  }, [booting, style, defsString, updatePreview]);

  // draw on preview/zoom changes
  useEffect(() => {
    if (previewUrl) void drawUrl(previewUrl);
  }, [previewUrl, drawUrl, zoom]);

  // capture intrinsic size
  useEffect(() => {
    if (!previewUrl) return;
    const img = new Image();
    img.onload = () => onImageLoad(img);
    img.src = previewUrl;
  }, [previewUrl, onImageLoad]);

  // wherever you already call onSaveClick
  const onSaveClick = async () => {
    if (!isLoggedIn) {
      alert("Please log in first to save your design.");
      return;
    }

    try {
      // setSaving(true);

      // 1) capture a snapshot to persist as Cloudinary preview
      const previewDataUrl =
        canvasRef.current?.toDataURL("image/webp", 0.85) ?? undefined;

      // 2) save (server should upsert + optionally upload preview & return previewUrl)
      const resp = await saveDesign(style, defsMap, {
        previewDataUrl,
        width: 800,
        quality: 70,
        endpoint: "saveUserDesign", // keep if your API path is /saveUserDesign
      });

      // 3) immediately show the saved Cloudinary preview in the canvas
      if ((resp as any)?.previewUrl) {
        const freshUrl = `${(resp as any).previewUrl}?v=${Date.now()}`; // cache-bust
        await drawUrl(freshUrl);
      } else {
        // Fallback: re-render the local preview
        await updatePreview(style, defsString);
      }
      // ✅ mark as saved baseline and clear dirty
      lastSavedRef.current = JSON.stringify({ style, defs: defsString });
      setIsDirty(false);
      // toast.success("Saved!");
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };

  const onQuickPng = () => quickDownloadPng(canvasRef.current, productId);

  const onExport = (fmt: any) => {
    if (!canExport) {
      alert("Purchase required or export limit reached.");
      return;
    }
    return exportArtwork(fmt, style, defsMap, {
      mode: exportMode,
      scale,
      outW,
      outH,
      unit,
      dpi,
      printW,
      printH,
      saveToLibrary: false,
    });
  };
  useLeaveConfirm(isDirty, "You have unsaved edits. Leave without saving?");

  // ——— early skeleton
  if (booting) return <BootLayoutSkeleton />;

  return (
    <div className="mx-auto w-full max-w-7xl  py-4 md:py-6">
      {headerBooting ? (
        // <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 md:py-6">
        <HeaderSkeleton />
      ) : (
        // </div>
        <EditorHeaderBar
        // productId={productId}
        resetting={loading}
        
        handleReset={() =>{  setStyle({} as StyleState); handleReset(()=>reloadStatus())}}

          purchased={purchased}
          purchasedDigital={purchasedDigital}
          loading={loading}
          saving={saving}
          canExport={canExport}
          exporting={exporting}
          exportsLeft={exportsLeft}
          onSave={onSaveClick}
          onQuickPng={onQuickPng}
          onExport={onExport}
          showControls={showControls}
          setShowControls={setShowControls}
          onPurchaseClick={() => setShowPurchase(true)}
          onPurchaseArtClick={() => setShowBuyArt(true)}
        />
      )}

      {/* Credits / exports pack */}
      <PurchaseExportsModal
        open={showPurchase}
        onClose={() => setShowPurchase(false)}
        busy={purchasing}
        productId={productId}
        onApplied={async () => {
          await refreshExportStatus(); // ⬅️ refresh the canonical instance
        }}
        //       onPick={async (qty) => {
        //         await startCheckout(qty);
        //       }}
      />

      {/* Art purchase (Add to cart + Buy now) */}

      <PurchaseArtModal
        setHeaderBooting={setHeaderBooting}
        open={showBuyArt}
        onClose={() => setShowBuyArt(false)}
        productId={productId}
        imageSrc={previewUrl || ""} // ✅ no 'product' here; use preview
        // baseDigitalPrice={20}                       // ✅ or fetch/compute; just avoid 'product.*'
        // basePrintPrice={30}

        // Optional catalogs — can omit, modal has defaults
        // licenses={...}
        // optionSizes={...}
        // materials={...}
        // frames={...}

        digital={{ format: "png", license: selectedLicense }}
        print={{ format: "jpg" }}
        // ✅ valid design payload; use your live editor state
        design={{ style, defs: defsString }}
        getPreviewDataUrl={async () =>
          canvasRef.current?.toDataURL("image/webp", 0.85) ?? null
        }
        onCheckout={async ({
          variant,
          quantity,
          productId,
          price,
          digital,
          print,
          design,
        }) => {
          const res = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "payment",
              productId,
              variant,
              quantity,
              price,
              digital,
              print,
              metadata: { designId: design?.id ?? null },
              successUrl: `${location.origin}/cart/checkout/success`,
              cancelUrl: location.href,
            }),
          });
          const { url } = await res.json();
          location.href = url;
        }}
      />

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px] gap-4">
        <div>
          {isDirty && (
            <i className="bg-white p-2 text-red-500 text-xs">
              Don't forget to save your changes
            </i>
          )}
          <CanvasStage
            zoom={zoom}
            setZoom={setZoom}
            ref={canvasRef}
            loading={loading}
          />
        </div>

        <aside
          id="controls-panel"
          className={`rounded-2xl bg-white p-4 ring-1 ring-black/5 ${
            showControls ? "block" : "hidden"
          } sm:block md:sticky md:top-4 md:h-fit`}
        >
          <Palette />
          <AppearanceControls />
          <ExportSizeControls
            mode={exportMode}
            setMode={setExportMode}
            baseW={baseW}
            baseH={baseH}
            scale={scale}
            setScale={setScale}
            outW={outW}
            setOutW={setOutW}
            outH={outH}
            setOutH={setOutH}
            unit={unit}
            setUnit={setUnit}
            dpi={dpi}
            setDpi={setDpi}
            printW={printW}
            setPrintW={setPrintW}
            printH={printH}
            setPrintH={setPrintH}
          />
          <div className="mt-4 flex items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                onChange={() => {
                  /* wire to saveToLibrary if desired */
                }}
              />
              Save exports to my Library
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}

// at top: import the type
// import type { StyleState } from "./types";

export default function EditableCanvas({ productId }: { productId: string }) {
  const [initialStyle, setInitialStyle] = React.useState<StyleState | null>(
    null
  );
  const [initialDefs, setInitialDefs] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}/saveUserDesign`, {
          cache: "no-store",
        });
        if (res.ok) {
          const j = await res.json();
          if (!cancelled && j?.found) {
            setInitialStyle((j.style || {}) as StyleState);
            setInitialDefs(j.defs || "");
            return;
          }
        }
      } catch {}
      // Fallback: empty style/defs (server/live-preview will still render)
      setInitialStyle({} as StyleState);
      setInitialDefs("");
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Show your nice skeleton until style arrives
  if (!initialStyle) return <BootLayoutSkeleton />;

  return (
    <DesignProvider initialStyle={initialStyle}>
      <EditableCanvasInner productId={productId} />
    </DesignProvider>
  );
}
