"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  downloadStoreGrant,
  getCurrentStorefront,
  saveStoreGrantDownload,
} from "@acme/core/lib/client/storefront-commerce";

/** Current commerce contracts: no old private checkout or caller-supplied download URLs. */
type OrderStatus = {
  id: string;
  status: string;
  currency: string;
  totalMinor: number;
  placedAt: string;
  processing: boolean;
  items: Array<{
    id: string;
    title: string;
    type: "PHYSICAL" | "DIGITAL";
    quantity: number;
    priceMinor: number;
  }>;
};
type BuyerGrant = { grantId: string; fileId: string; label: string };
type DownloadFile = BuyerGrant & { artworkTitle: string };
type Entitlements = {
  orders: Array<{
    orderId: string;
    items: Array<{
      orderItemId: string;
      title: string;
      files: BuyerGrant[];
    }>;
  }>;
};
type DownloadStatus = "idle" | "loading" | "ready" | "failed";

const settledStatuses = new Set(["PAID", "FULFILLING", "FULFILLED"]);

function money(minor: number, currency: string) {
  const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency });
  const decimals = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(minor / 10 ** decimals);
}
function extensionFromLabel(label: string) {
  const match = /\.([a-z\d]{2,8})$/i.exec(label.trim());
  return match?.[1]?.toUpperCase() ?? "FILE";
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700">{children}</span>;
}
function Dot() {
  return <span aria-hidden="true" className="hidden sm:inline text-gray-300">•</span>;
}
function Badge({ label, tone = "gray" }: { label: string; tone?: "gray" | "indigo" | "emerald" }) {
  const toneClasses = {
    gray: "border-gray-200 bg-gray-50 text-gray-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return <span className={`inline-flex items-center text-[11px] sm:text-xs px-2 py-[2px] rounded-full border ${toneClasses[tone]}`}>{label}</span>;
}
function Spinner() {
  return <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" /><path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
}
function DetailRow({ k, v }: { k: string; v: string }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2"><span className="text-gray-500">{k}</span><span className="sm:col-span-2 font-medium text-gray-800 break-words">{v}</span></div>;
}

/** Mirrors the original ZileDigital checkout-success header layout and copy.
 * The old SaveOrderCta is intentionally absent: it references retired private APIs. */
function OriginalOrderHeader({ hasPrint, hasDigital, paid, refunded }: { hasPrint: boolean; hasDigital: boolean; paid: boolean; refunded: boolean }) {
  const title = refunded
    ? "Your order has been refunded"
    : !paid
    ? "We’re confirming your order"
    : hasPrint && hasDigital
      ? "Downloads ready — your print is in production"
      : hasPrint
        ? "Your print is in production"
        : hasDigital
          ? "Your downloads are ready"
          : "Thank you for your order";
  const tone = refunded ? "text-gray-700" : hasPrint && hasDigital ? "text-teal-700" : hasDigital ? "text-green-700" : "text-indigo-700";
  return (
    <header className="mb-6 sm:mb-8">
      <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${tone}`}>{title}</h1>
      {paid && hasPrint && hasDigital ? (
        <>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">Save your digital files below. We’re also preparing your physical item and will email tracking as soon as it ships.</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1"><span className="font-medium">Kreyòl:</span> Telechaje fichye w yo anba a. N ap prepare atik fizik ou a tou, epi n ap voye nimewo pou swiv la lè li voye.</p>
        </>
      ) : paid && hasPrint ? (
        <>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">We’re preparing your item. We’ll email you tracking as soon as it ships. You can view order details anytime from your account.</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1"><span className="font-medium">Kreyòl:</span> Y ap prepare kòmann ou a. N ap voye yon imel ba ou ak nimewo pou swiv la lè li voye.</p>
        </>
      ) : paid && hasDigital ? (
        <>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">Save your files below. Your downloads are protected by the account used at checkout.</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1"><span className="font-medium">Kreyòl:</span> Telechaje epi konsève fichye ou yo anba a.</p>
        </>
      ) : (
        <p role="status" className="text-gray-600 mt-2 text-sm sm:text-base">{refunded ? "This order was fully refunded. Digital download access has ended." : "Your payment is being verified. Please keep this page open."}</p>
      )}
    </header>
  );
}

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") || "";
  const [storeId, setStoreId] = React.useState<string | null>(null);
  const [order, setOrder] = React.useState<OrderStatus | null>(null);
  const [downloads, setDownloads] = React.useState<DownloadFile[]>([]);
  const [downloadsStatus, setDownloadsStatus] = React.useState<DownloadStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const [busyGrant, setBusyGrant] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function read() {
      try {
        if (!sessionId) throw new Error("Missing checkout session ID");
        const context = await getCurrentStorefront();
        const id = context.store.id;
        const res = await fetch(`/api/public/stores/${encodeURIComponent(id)}/orders/by-session?session_id=${encodeURIComponent(sessionId)}`, {
          credentials: "same-origin", cache: "no-store",
        });
        const body: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(res.status === 401 ? "Sign in to view your order" : "Order status unavailable");
        const verified = body as OrderStatus;
        if (!active) return;
        setStoreId(id);
        setOrder(verified);
        setError(null);
        if (settledStatuses.has(verified.status)) {
          setDownloadsStatus("loading");
          const filesRes = await fetch(`/api/public/stores/${encodeURIComponent(id)}/my-digital-purchases`, {
            credentials: "same-origin", cache: "no-store",
          });
          if (!active) return;
          if (!filesRes.ok) {
            setDownloads([]);
            setDownloadsStatus("failed");
          } else {
            try {
              const docs = (await filesRes.json()) as Entitlements;
              if (!active) return;
              const files = (docs.orders ?? [])
                .filter((entry) => entry.orderId === verified.id)
                .flatMap((entry) => entry.items.flatMap((item) => item.files.map((file) => ({ ...file, artworkTitle: item.title }))));
              setDownloads(files);
              setDownloadsStatus("ready");
            } catch {
              if (active) { setDownloads([]); setDownloadsStatus("failed"); }
            }
          }
        } else {
          setDownloads([]);
          setDownloadsStatus("idle");
        }
        if (verified.processing && active) timer = setTimeout(() => setTick((n) => n + 1), 3000);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Order status unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }
    void read();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [sessionId, tick]);

  async function downloadGrant(file: BuyerGrant) {
    if (!storeId || busyGrant) return;
    setBusyGrant(file.grantId);
    setDownloadError(null);
    try {
      const { blob, filename } = await downloadStoreGrant(storeId, file.grantId);
      saveStoreGrantDownload(blob, filename);
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : "Download unavailable");
    } finally {
      setBusyGrant(null);
    }
  }

  const paid = Boolean(order && settledStatuses.has(order.status));
  const digitalItems = order?.items.filter((item) => item.type === "DIGITAL") ?? [];
  const printItems = order?.items.filter((item) => item.type === "PHYSICAL") ?? [];
  const anyVector = downloads.some((file) => /\.(svg|pdf)$/i.test(file.label));

  if (loading && !order) {
    return <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"><div className="animate-pulse space-y-6"><div className="h-8 w-2/3 bg-gray-200 rounded" /><div className="h-5 w-1/2 bg-gray-200 rounded" /><div className="h-40 w-full bg-gray-200 rounded-2xl" /><div className="h-24 w-full bg-gray-200 rounded-2xl" /></div></div>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <OriginalOrderHeader hasPrint={printItems.length > 0} hasDigital={digitalItems.length > 0} paid={paid}  refunded={order?.status === "REFUNDED"} />
      {error && <p role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {order && (
        <>
          {/* Original card structure and compact, inline item rows. */}
          <section className="rounded-2xl border bg-white/70 backdrop-blur p-4 sm:p-5 mb-6 sm:mb-8 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Order items</h2>
            <ul className="space-y-3">
              {digitalItems.map((item) => (
                <li key={`d-${item.id}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <Chip>Digital</Chip><span className="font-medium">{item.title}</span><Dot />
                  <span>Qty: {item.quantity}</span><Dot /><span>{money(item.priceMinor, order.currency)}</span>
                </li>
              ))}
              {printItems.map((item) => (
                <li key={`p-${item.id}`} className="flex flex-wrap items-center gap-2 text-sm">
                  <Chip>Print</Chip><span className="font-medium">{item.title}</span><Dot />
                  <span>Qty: {item.quantity}</span><Dot /><span>{money(item.priceMinor, order.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-xs text-gray-600">
              <span>Order {order.id} · Status: {order.status}</span>
              <span className="text-sm font-semibold text-gray-900">Total: {money(order.totalMinor, order.currency)}</span>
            </div>
            {printItems.length > 0 && <p className="mt-3 text-xs text-gray-600">Prints, mugs or other physical pieces are produced and shipped separately. We’ll email you tracking once they ship.</p>}
          </section>

          {digitalItems.length > 0 && (
            <section className="rounded-2xl border bg-white/70 backdrop-blur p-4 sm:p-5 mb-6 sm:mb-8 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge label={`${downloads.length} file${downloads.length === 1 ? "" : "s"}`} />
                {anyVector && <Badge label="Includes vector formats" tone="indigo" />}
                {order?.status === "REFUNDED" ? <Badge label="Downloads revoked" /> : <Badge label="Secure account downloads" tone="emerald" />}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-3">{order?.status === "REFUNDED" ? "Download access has ended because this order was fully refunded." : "Tip: Keep your original downloads safe. You can access active downloads from the signed-in account used at checkout."}</p>
            </section>
          )}

          {digitalItems.length > 0 && order?.status === "REFUNDED" && <div role="status" className="rounded-2xl border bg-white/70 p-6 sm:p-8 text-sm text-gray-600">No active downloads are available for this refunded order.</div>}
          {digitalItems.length > 0 && !paid && order?.status !== "REFUNDED" && <div role="status" className="rounded-2xl border bg-white/70 p-6 sm:p-8 text-sm text-gray-600">Files become available after payment is confirmed.</div>}
          {digitalItems.length > 0 && paid && (downloadsStatus === "loading" || downloadsStatus === "idle") && <p role="status" className="rounded-2xl border bg-white/70 p-6 sm:p-8 text-sm text-gray-600">Loading your downloads…</p>}
          {digitalItems.length > 0 && paid && downloadsStatus === "failed" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8 text-sm text-amber-900"><p>We couldn't load your downloads. Your paid order remains confirmed.</p><button type="button" className="mt-2 underline underline-offset-4" onClick={() => setTick((n) => n + 1)}>Try again</button></div>}
          {digitalItems.length > 0 && paid && downloadsStatus === "ready" && downloads.length === 0 && <div className="rounded-2xl border bg-white/70 p-6 sm:p-8 text-sm text-gray-600"><p>No downloadable files are showing for this order yet.</p><button type="button" className="mt-2 underline underline-offset-4" onClick={() => setTick((n) => n + 1)}>Refresh downloads</button></div>}
          {digitalItems.length > 0 && paid && downloadsStatus === "ready" && downloads.length > 0 && (
            <>
              <ul className="space-y-4 sm:space-y-6">
                {downloads.map((file) => {
                  const format = extensionFromLabel(file.label);
                  const busy = busyGrant === file.grantId;
                  const vector = format === "SVG" || format === "PDF";
                  return (
                    <li key={file.grantId} className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch border rounded-2xl p-3 sm:p-4 shadow-sm bg-white/80">
                      <div className="shrink-0">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl border grid place-items-center text-[10px] sm:text-xs text-gray-500">{format}</div>
                      </div>
                      <div className="flex-1 min-w-0 order-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-base sm:text-lg truncate">{file.artworkTitle}</p>
                          <span className="text-[10px] sm:text-xs px-2 py-[2px] rounded-full border border-gray-200 bg-gray-50 text-gray-700">{format}</span>
                        </div>
                        <div className="mt-1.5 sm:mt-2 text-[13px] sm:text-sm text-gray-700">
                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-2 gap-y-1 sm:gap-x-4">
                            <span>{vector ? "Vector (resolution-independent)" : "Digital file"}</span><Dot /><span>Secure buyer access</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [file.grantId]: !prev[file.grantId] }))} aria-expanded={Boolean(expanded[file.grantId])} className="mt-2 sm:mt-3 text-xs text-gray-600 hover:text-gray-900 underline underline-offset-4">{expanded[file.grantId] ? "Hide details" : "Show details"}</button>
                        {expanded[file.grantId] && (
                          <div className="mt-3 rounded-xl border bg-gray-50 p-3 text-[12px] sm:text-xs text-gray-700 space-y-2">
                            <DetailRow k="File name" v={file.label} />
                            <DetailRow k="Format" v={format} />
                            <DetailRow k="Access" v="Verified account and paid order" />
                            {vector && <DetailRow k="Resolution" v="Vector" />}
                          </div>
                        )}
                      </div>
                      <div className="order-3 md:order-3 md:ml-auto md:pl-2 flex items-end md:items-center">
                        <button type="button" disabled={busyGrant !== null} onClick={() => void downloadGrant(file)} className={`w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2 rounded-full transition ${busyGrant !== null ? "bg-gray-300 cursor-wait text-gray-700" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                          {busy ? <><Spinner /> Downloading…</> : "Download"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {downloadError && <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{downloadError}</p>}
              <p className="mt-5 sm:mt-6 text-[10.5px] sm:text-[11px] leading-5 text-gray-500">Colors vary across displays and printers. Vector formats (SVG/PDF) scale without quality loss. Keep a copy of your purchased files.</p>
            </>
          )}
          {digitalItems.length === 0 && paid && printItems.length > 0 && <div className="rounded-2xl border p-6 sm:p-8 bg-white/70"><h2 className="text-base sm:text-lg font-semibold mb-3">Print items</h2><p className="text-gray-600 mt-2 text-sm">Your physical items are in production. We’ll email tracking when they ship.</p></div>}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Link href="/store" className="text-xs text-gray-600 underline underline-offset-4 hover:text-gray-900">Return to store</Link>
          </div>
        </>
      )}
    </main>
  );
}
