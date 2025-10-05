"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
// import SaveOrderCta from "@/components/orders/SaveOrderCta";
import { useUser } from "@acme/core/contexts/UserContext";
import { OrderSuccessHeader } from "../../orders/OrderSuccessHeader";
import { downloadFile } from "@acme/core/lib/client/downloads";

/* ------------ Types from /api/checkout/success ------------- */
interface PurchasedArtwork {
  id: string;
  title: string;
  format: string;
  downloadUrl: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  dpi?: number;
  colorProfile?: string;
  sizeBytes?: number;
  license?: string;
  isVector?: boolean;
  checksum?: string;
  expiresAt?: string;
  remainingUses?: number | null;
}

type OrderItemKind = "DIGITAL" | "PRINT";
type SuccessResponse = {
  hasDigital?: boolean;
  hasPrint?: boolean;
  order?: {
    id: string;
    placedAt: string;
    total: number;
    items: Array<{
      id: string;
      type: OrderItemKind;
      price: number;
      quantity: number;
      myProduct: {
        id: string;
        title: string;
        imageUrl?: string | null;
        digital?: { id: string; format: string; license?: string };
        print?: {
          id: string;
          format: string;
          size: string;
          material: string;
          frame?: string;
        };
      };
    }>;
  } | null;
  digitalDownloads?: PurchasedArtwork[];
};

/* ----------- Helper utils ---------- */
function toTitle(s?: string) {
  return (s || "").toUpperCase();
}
function humanBytes(b?: number) {
  if (!b || b <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0,
    n = b;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function aspect(width?: number, height?: number) {
  if (!width || !height) return "—";
  const g = gcd(width, height);
  return `${Math.round(width / g)}:${Math.round(height / g)}`;
}
function pxToInches(px?: number, dpi = 300) {
  if (!px || !dpi) return 0;
  return +(px / dpi).toFixed(2);
}
function maxPrintAt300(width?: number, height?: number, dpi = 300) {
  if (!width || !height) return "—";
  const wIn = pxToInches(width, dpi);
  const hIn = pxToInches(height, dpi);
  if (!wIn || !hIn) return "—";
  return `${wIn}" × ${hIn}" @ ${dpi} DPI`;
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (String(d) === "Invalid Date") return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function isExpiringSoon(iso?: string) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t - Date.now() < 72 * 3600 * 1000; // < 72h
}
function safeFilename(title: string, ext: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "artwork"}.${ext.toLowerCase()}`;
}
function titleCase(s?: string | null) {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/* --------------------- Component ---------------------------- */
export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session_id");

  const [artworks, setArtworks] = useState<PurchasedArtwork[]>([]);
  const [orderInfo, setOrderInfo] = useState<SuccessResponse["order"] | null>(
    null
  );
  const [loadingPage, setLoadingPage] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [hasPrint, setHasPrint] = useState(false);
  const [hasDigitalUI, setHasDigitalUI] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  // Which button is currently downloading
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { isLoggedIn } = useUser();

  // expanded details
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  const anyVector = useMemo(
    () => artworks.some((a) => a.isVector || /^(svg|pdf)$/i.test(a.format)),
    [artworks]
  );

  // helper to download any URL as a file
  // const downloadFile = async (url: string, filename: string, buttonId: string) => {
  //   try {
  //     setDownloadingId(buttonId);
  //     const res = await fetch(url);
  //     if (!res.ok) throw new Error("Network response was not ok");
  //     const blob = await res.blob();
  //     const blobUrl = URL.createObjectURL(blob);
  //     const link = document.createElement("a");
  //     link.href = blobUrl;
  //     link.download = filename;
  //     document.body.appendChild(link);
  //     link.click();
  //     link.remove();
  //     URL.revokeObjectURL(blobUrl);
  //     fetch("/api/downloads", { method: "POST", credentials: "include" }).catch(() => {});
  //   } catch (err) {
  //     console.error(err);
  //     toast.error("Download failed");
  //   } finally {
  //     setDownloadingId(null);
  //   }
  // };

  /* Fetch purchased artworks + order summary once we have a session_id */
  useEffect(() => {
    if (!sessionId) return;

    let dead = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/checkout/success?session_id=${sessionId}`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        const data: SuccessResponse = await res.json();

        if (dead) return;

        if (res.status === 401) {
          setNotAuthorized(true);
          setArtworks([]);
          setHasPrint(false);
          setHasDigitalUI(false);
          setOrderInfo(null);
          return;
        }
        if (!res.ok)
          throw new Error((data as any)?.error || "Could not fetch downloads.");

        setNotAuthorized(false);
        setArtworks(data.digitalDownloads ?? []);
        setOrderInfo(data.order ?? null);

        // ✅ Robust flags (prefer API booleans; fall back to items)
        const items = data.order?.items ?? [];
        const itemsHasPrint =
          items.some((it) => it.type === "PRINT" || !!it.myProduct?.print) ??
          false;
        const itemsHasDigital =
          items.some(
            (it) => it.type === "DIGITAL" || !!it.myProduct?.digital
          ) ?? false;

        const apiHasPrint = Boolean(data.hasPrint);
        const apiHasDigital = Boolean(data.hasDigital);

        setHasPrint(apiHasPrint || itemsHasPrint);
        setHasDigitalUI(
          apiHasDigital ||
            itemsHasDigital ||
            (data.digitalDownloads?.length ?? 0) > 0
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        console.error(msg);
        toast.error(msg);
      } finally {
        if (!dead) setLoadingPage(false);
      }
    })();

    return () => {
      dead = true;
    };
  }, [sessionId]);

  const printItems = useMemo(
    () =>
      (orderInfo?.items ?? []).filter(
        (it) => it.type === "PRINT" || it.myProduct?.print
      ),
    [orderInfo]
  );

  const digitalLines = useMemo(
    () =>
      (orderInfo?.items ?? []).filter(
        (it) => it.type === "DIGITAL" || it.myProduct?.digital
      ),
    [orderInfo]
  );

  if (loadingPage) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-2/3 bg-gray-200 rounded"></div>
          <div className="h-5 w-1/2 bg-gray-200 rounded"></div>
          <div className="h-40 w-full bg-gray-200 rounded-2xl"></div>
          <div className="h-24 w-full bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (notAuthorized) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold">
          We couldn’t verify this purchase
        </h1>
        <p className="mt-2 text-gray-600">
          Make sure you’re signed in with the account used at checkout, or open
          the download link from your receipt email.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      {/* Header / intro */}
      <OrderSuccessHeader
        hasDigital={hasDigitalUI}
        hasPrint={hasPrint}
        sessionId={sessionId ?? undefined}
      />

      {/* 🧾 Order items — shows BOTH Digital and Print line details */}
      {orderInfo && (digitalLines.length > 0 || printItems.length > 0) && (
        <section className="rounded-2xl border bg-white/70 backdrop-blur p-4 sm:p-5 mb-6 sm:mb-8 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Order items
          </h2>

          <ul className="space-y-3">
            {digitalLines.map((it) => (
              <li
                key={`d-${it.id}`}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <Chip>Digital</Chip>
                <span className="font-medium">{it.myProduct.title}</span>
                {it.myProduct.digital?.format && <Dot />}
                {it.myProduct.digital?.format && (
                  <span>Format: {toTitle(it.myProduct.digital.format)}</span>
                )}
                {it.myProduct.digital?.license && <Dot />}
                {it.myProduct.digital?.license && (
                  <span>
                    License: {titleCase(it.myProduct.digital.license)}
                  </span>
                )}
                <Dot />
                <span>Qty: {it.quantity}</span>
                <Dot />
                <span>{money(it.price)}</span>
              </li>
            ))}

            {printItems.map((it) => (
              <li
                key={`p-${it.id}`}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <Chip>Print</Chip>
                <span className="font-medium">{it.myProduct.title}</span>
                {it.myProduct.print?.size && <Dot />}
                {it.myProduct.print?.size && (
                  <span>Size: {it.myProduct.print.size}</span>
                )}
                {it.myProduct.print?.material && <Dot />}
                {it.myProduct.print?.material && (
                  <span>
                    Material: {titleCase(it.myProduct.print.material)}
                  </span>
                )}
                {it.myProduct.print?.frame && <Dot />}
                {it.myProduct.print?.frame && (
                  <span>Frame: {titleCase(it.myProduct.print.frame)}</span>
                )}
                {it.myProduct.print?.format && <Dot />}
                {it.myProduct.print?.format && (
                  <span>Format: {toTitle(it.myProduct.print.format)}</span>
                )}
                <Dot />
                <span>Qty: {it.quantity}</span>
                <Dot />
                <span>{money(it.price)}</span>
              </li>
            ))}
          </ul>

          {printItems.length > 0 && (
            <p className="mt-3 text-xs text-gray-600">
              Prints are produced and shipped separately. We’ll email you
              tracking once they ship.
            </p>
          )}
        </section>
      )}

      {/* Summary card for DIGITAL files (only if there are downloads) */}
      {hasDigitalUI && (
        <section className="rounded-2xl border bg-white/70 backdrop-blur p-4 sm:p-5 mb-6 sm:mb-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge
              label={`${artworks.length} file${
                artworks.length === 1 ? "" : "s"
              }`}
            />
            {anyVector && (
              <Badge label="Includes vector formats" tone="indigo" />
            )}
            <Badge label="Watermarks removed in downloads" tone="emerald" />
          </div>
          {!isLoggedIn && (
            <p className="text-xs sm:text-sm text-gray-600 mt-3">
              Tip: Keep the original downloads safe. You can re-download from
              your <span className="font-medium">Order Library</span> if you
              created an account.
            </p>
          )}
        </section>
      )}

      {/* Content area */}
      {artworks.length === 0 ? (
        hasPrint ? (
          <PrintItemsOnly printItems={printItems} />
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          {/* LIST of digital downloads */}
          <ul className="space-y-4 sm:space-y-6">
            {artworks.map((art, i) => {
              const busy = downloadingId === art.id;
              const isPdf = /pdf/i.test(art.format);
              const isSvg = /svg/i.test(art.format);
              const isRaster = !isPdf && !isSvg;

              const labelFmt = toTitle(art.format);
              const ratio = aspect(art.width, art.height);
              const size = humanBytes(art.sizeBytes);
              const dpi = art.dpi || (isRaster ? 300 : undefined);
              const maxPrint =
                art.isVector || isPdf || isSvg
                  ? "Unlimited scale (vector)"
                  : maxPrintAt300(art.width, art.height, dpi || 300);

              const isExpired = art.expiresAt
                ? new Date(art.expiresAt).getTime() < Date.now()
                : false;
              const noRemaining =
                typeof art.remainingUses === "number" && art.remainingUses <= 0;

              const expiresBadge = art.expiresAt ? (
                <span
                  className={`ml-0 sm:ml-2 inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-[2px] rounded-full border
                  ${
                    isExpired || isExpiringSoon(art.expiresAt)
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  {isExpired
                    ? "Expired"
                    : isExpiringSoon(art.expiresAt)
                    ? "Expires soon"
                    : "Expires"}
                  <span className="font-medium">{fmtDate(art.expiresAt)}</span>
                </span>
              ) : null;

              return (
                <li
                  key={`${art.id}-${i}`}
                  className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch border rounded-2xl p-3 sm:p-4 shadow-sm bg-white/80"
                >
                  {/* Preview */}
                  <div className="shrink-0">
                    {art.previewUrl ? (
                      <img
                        src={art.previewUrl}
                        alt={art.title}
                        className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 object-cover rounded-xl border"
                      />
                    ) : isPdf ? (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl border grid place-items-center text-[10px] sm:text-xs text-gray-500">
                        PDF
                      </div>
                    ) : isSvg ? (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl border grid place-items-center text-[10px] sm:text-xs text-gray-500">
                        SVG
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl border grid place-items-center text-[10px] sm:text-xs text-gray-500">
                        No preview
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 order-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-base sm:text-lg truncate">
                        {art.title}
                      </p>
                      <span className="text-[10px] sm:text-xs px-2 py-[2px] rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                        {labelFmt}
                      </span>
                      {expiresBadge}
                    </div>

                    <div className="mt-1.5 sm:mt-2 text-[13px] sm:text-sm text-gray-700">
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-2 gap-y-1 sm:gap-x-4">
                        <span>
                          {isRaster
                            ? `${art.width || "—"}×${art.height || "—"} px`
                            : "Vector (resolution-independent)"}
                        </span>
                        <Dot />
                        <span>{size}</span>
                        {isRaster && (
                          <>
                            <Dot />
                            <span>{dpi ? `${dpi} DPI` : "DPI —"}</span>
                            <Dot />
                            <span>Aspect {ratio}</span>
                          </>
                        )}
                        {art.colorProfile && (
                          <>
                            <Dot />
                            <span>{art.colorProfile}</span>
                          </>
                        )}
                        {art.license && (
                          <>
                            <Dot />
                            <span>License: {art.license}</span>
                          </>
                        )}
                        {typeof art.remainingUses === "number" && (
                          <>
                            <Dot />
                            <span>{art.remainingUses} downloads left</span>
                          </>
                        )}
                      </div>

                      <p className="mt-1 text-[11px] sm:text-xs text-gray-500">
                        Max recommended print size:{" "}
                        <span className="font-medium">{maxPrint}</span>
                      </p>
                    </div>

                    {/* Details toggle */}
                    <button
                      onClick={() => toggle(art.id)}
                      className="mt-2 sm:mt-3 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-4"
                    >
                      {expanded[art.id] ? "Hide details" : "Show details"}
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded[art.id] && (
                        <motion.div
                          key="print-settings"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.24, ease: "easeInOut" }}
                          style={{ overflow: "hidden" }}
                        >
                          <div className="mt-3 rounded-xl border bg-gray-50 p-3 text-[12px] sm:text-xs text-gray-700 space-y-2">
                            <DetailRow
                              k="File name"
                              v={safeFilename(art.title, art.format)}
                            />
                            <DetailRow k="Format" v={labelFmt} />
                            <DetailRow
                              k="Resolution"
                              v={
                                isRaster
                                  ? `${art.width || "—"} × ${
                                      art.height || "—"
                                    } px`
                                  : "Vector"
                              }
                            />
                            {isRaster && (
                              <DetailRow k="DPI" v={String(dpi ?? "—")} />
                            )}
                            <DetailRow
                              k="Color profile"
                              v={art.colorProfile || "—"}
                            />
                            <DetailRow k="File size" v={size} />
                            <DetailRow
                              k="Aspect ratio"
                              v={isRaster ? aspect(art.width, art.height) : "—"}
                            />
                            <DetailRow k="Checksum" v={art.checksum || "—"} />
                            <DetailRow k="License" v={art.license || "—"} />
                            <DetailRow
                              k="Link expires"
                              v={fmtDate(art.expiresAt)}
                            />
                            {isRaster && (
                              <DetailRow
                                k="Max print (300DPI)"
                                v={maxPrintAt300(
                                  art.width,
                                  art.height,
                                  dpi || 300
                                )}
                              />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Actions */}
                  <div className="order-3 md:order-3 md:ml-auto md:pl-2 flex items-end md:items-center">
                    <button
                      type="button"
                      disabled={busy || isExpired || noRemaining}
                      onClick={async () => {
                        try {
                          setDownloadingId(art.id);
                          await downloadFile(
                            art.downloadUrl,
                            safeFilename(art.title, art.format),
                            {
                              onProgress: (p: number) => {
                                // normalize: some libs send 0..1; others 0..100
                                const pct =
                                  p <= 1 ? Math.round(p * 100) : Math.round(p);
                                setProgress((prev) => ({
                                  ...prev,
                                  [art.id]: pct,
                                }));
                              },
                              // forceProxy: true, // (optional) if you want to route via your server
                            }
                          );
                        } catch (e) {
                          toast.error("Download failed");
                          console.error(e);
                        } finally {
                          setDownloadingId(null);
                          // remove this item's progress entry
                          setProgress((prev) => {
                            const { [art.id]: _, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      // onClick={() =>
                      //   downloadFile(art.downloadUrl, safeFilename(art.title, art.format), art.id)
                      // }
                      className={`w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 rounded-full transition
                        ${
                          busy || isExpired || noRemaining
                            ? "bg-gray-300 cursor-not-allowed text-gray-700"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                    >
                      {isExpired ? (
                        "Link expired"
                      ) : noRemaining ? (
                        "No downloads left"
                      ) : busy ? (
                        <>
                          <Spinner />{" "}
                          {typeof progress[art.id] === "number"
                            ? `Downloading ${progress[art.id]}%`
                            : "Downloading…"}
                        </>
                      ) : (
                        "Download"
                      )}
                    </button>
                    {busy && typeof progress[art.id] === "number" && (
                      <div className="mt-2 w-full">
                        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full bg-green-600 transition-[width] duration-150"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, progress[art.id])
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ZIP download */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            {/* <button
              type="button"
              disabled={downloadingId === "zip" || artworks.length === 0}
              onClick={() => {
                setDownloadingId("zip");
                const url = `/api/downloads/archive?session_id=${sessionId}`;
                const a = document.createElement("a");
                a.href = url;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => setDownloadingId(null), 2000);
              }}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full transition ${
                downloadingId === "zip"
                  ? "bg-gray-300 cursor-not-allowed text-gray-700"
                  : "bg-blue-700 hover:bg-blue-800 text-white"
              }`}
            >
              {downloadingId === "zip" ? (
                <>
                  <Spinner /> Preparing ZIP…
                </>
              ) : (
                "Download All (ZIP)"
              )}
            </button> */}
            <button
              type="button"
              disabled={downloadingId === "zip" || artworks.length === 0}
              onClick={async () => {
                try {
                  setDownloadingId("zip");
                  setProgress((p) => ({ ...p, zip: 0 }));

                  const url = `/api/downloads/archive?session_id=${sessionId}`;
                  await downloadFile(url, safeFilename("artworks", "zip"), {
                    onProgress: (p: number) => {
                      const pct = p <= 1 ? Math.round(p * 100) : Math.round(p);
                      setProgress((prev) => ({ ...prev, zip: pct }));
                    },
                    // forceProxy: true, // optional if your helper supports/needs it
                  });
                } catch (e) {
                  toast.error("Failed to prepare ZIP");
                  console.error(e);
                } finally {
                  setDownloadingId(null);
                  setProgress(({ zip, ...rest }) => rest); // remove zip entry
                }
              }}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full transition ${
                downloadingId === "zip"
                  ? "bg-gray-300 cursor-not-allowed text-gray-700"
                  : "bg-blue-700 hover:bg-blue-800 text-white"
              }`}
            >
              {downloadingId === "zip" ? (
                <>
                  <Spinner />
                  {typeof progress.zip === "number"
                    ? `Preparing ${progress.zip}%`
                    : "Preparing ZIP…"}
                </>
              ) : (
                "Download All (ZIP)"
              )}
            </button>
            {downloadingId === "zip" && typeof progress.zip === "number" && (
              <div className="mt-2 w-full sm:w-64">
                <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-blue-700 transition-[width] duration-150"
                    style={{
                      width: `${Math.min(100, Math.max(0, progress.zip))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-gray-600">
              Having trouble?{" "}
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `/api/orders/resend-email?session_id=${sessionId}`,
                      {
                        method: "POST",
                      }
                    );
                    if (!res.ok) throw new Error();
                    toast.success("Email sent.");
                  } catch {
                    toast.error("Could not resend email right now.");
                  }
                }}
                className="underline underline-offset-4 hover:text-gray-900"
              >
                Email me the links
              </button>
              .
            </p>
          </div>

          {/* Tiny disclosures */}
          <p className="mt-5 sm:mt-6 text-[10.5px] sm:text-[11px] leading-5 text-gray-500">
            Colors vary across displays and printers. Vector formats (SVG/PDF)
            scale without quality loss. Rasters are best printed at their max
            recommended size.
          </p>
        </>
      )}
    </div>
  );
}

/* --------------------- Small UI bits ------------------------ */
function Dot() {
  return (
    <span aria-hidden="true" className="hidden sm:inline text-gray-300">
      •
    </span>
  );
}

function Badge({
  label,
  tone = "gray",
}: {
  label: string;
  tone?: "gray" | "indigo" | "emerald";
}) {
  const tones: Record<string, string> = {
    gray: "border-gray-200 bg-gray-50 text-gray-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`inline-flex items-center text-[11px] sm:text-xs px-2 py-[2px] rounded-full border ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DetailRow({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2">
      <span className="text-gray-500">{k}</span>
      <span className="sm:col-span-2 font-medium text-gray-800 break-words">
        {v}
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700">
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border p-6 sm:p-8 text-center bg-white/70">
      <h2 className="text-base sm:text-lg font-semibold">
        No digital items this time
      </h2>
      <p className="text-gray-600 mt-2 text-sm">
        If you purchased a print, you’ll get separate shipping emails with
        tracking.
      </p>
    </div>
  );
}

function PrintItemsOnly({
  printItems,
}: {
  printItems: NonNullable<SuccessResponse["order"]>["items"];
}) {
  if (!printItems || printItems.length === 0) return <PrintOnlyState />;

  return (
    <div className="rounded-2xl border p-6 sm:p-8 bg-white/70">
      <h2 className="text-base sm:text-lg font-semibold mb-3">Print items</h2>
      <ul className="space-y-3">
        {printItems.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-2 text-sm">
            <Chip>Print</Chip>
            <span className="font-medium">{it.myProduct.title}</span>
            {it.myProduct.print?.size && <Dot />}
            {it.myProduct.print?.size && (
              <span>Size: {it.myProduct.print.size}</span>
            )}
            {it.myProduct.print?.material && <Dot />}
            {it.myProduct.print?.material && (
              <span>Material: {titleCase(it.myProduct.print.material)}</span>
            )}
            {it.myProduct.print?.frame && <Dot />}
            {it.myProduct.print?.frame && (
              <span>Frame: {titleCase(it.myProduct.print.frame)}</span>
            )}
            <Dot />
            <span>Qty: {it.quantity}</span>
            <Dot />
            <span>{money(it.price)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-gray-600">
        These prints are in production. We’ll email tracking as soon as they
        ship.
      </p>
    </div>
  );
}

function PrintOnlyState() {
  return (
    <div className="rounded-2xl border p-6 sm:p-8 text-center bg-white/70">
      <h2 className="text-base sm:text-lg font-semibold">
        Your print is in production
      </h2>
      <p className="text-gray-600 mt-2 text-sm">
        We’ll email tracking as soon as it ships. Digital downloads will also
        show here if included.
      </p>
    </div>
  );
}
