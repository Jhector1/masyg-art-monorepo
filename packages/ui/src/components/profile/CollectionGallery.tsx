// File: src/components/profile/CollectionGallery.tsx
"use client";

import Image from "next/image";
// import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionItem, VariantType } from "@acme/core/types";
import { safeFilename, useDownloader } from "@acme/core/lib/client/downloads";



interface CollectionGalleryProps {
  items: CollectionItem[];
  filter: VariantType;
  setFilter: (f: VariantType) => void;
}

const TABS: VariantType[] = ["ALL", "DIGITAL", "PRINT"];

function prettyBytes(n?: number | null) {
  if (!n || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(n) / Math.log(1024)),
    units.length - 1
  );
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function resString(w?: number | null, h?: number | null, dpi?: number | null) {
  if (!w || !h) return "";
  return `${w}×${h}${dpi ? ` @ ${dpi}dpi` : ""}`;
}

export default function CollectionGallery({
  items,
  filter,
  setFilter,
}: CollectionGalleryProps) {
  const router = useRouter();
  const filtered = useMemo(
    () => items.filter((it) => (filter === "ALL" ? true : it.type === filter)),
    [items, filter]
  );

  // group by YYYY-MM-DD from order.placedAt
  const grouped = useMemo(() => {
    const g: Record<string, CollectionItem[]> = {};
    for (const it of filtered) {
      const k = (it.order.placedAt ?? "").slice(0, 10);
      (g[k] ||= []).push(it);
    }
    return g;
  }, [filtered]);

  const entries = Object.entries(grouped);
  return (
    <div className="p-4">
      {/* ...header & tabs unchanged */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">
          Your Purchased Art
        </h3>

        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={[
                "px-4 py-2 rounded-full font-medium transition",
                filter === tab
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300",
              ].join(" ")}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-gray-500">No items to display.</p>
      ) : (
        entries.map(([date, group]) => (
          <section key={date} className="mb-10">
            <h4 className="text-sm font-semibold text-gray-600 tracking-wide mb-3">
              {new Date(date).toLocaleDateString()}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.map((item) => {
                const img =
                  item.previewUrl ||
                  item.product.thumbnails?.[0] ||
                  "/images/placeholder.png";

                const topMeta =
                  item.type === "DIGITAL" && item.digital?.tokens?.length
                    ? (() => {
                        const a = item.digital!.tokens[0];
                        return [
                          a.ext?.toUpperCase(),
                          resString(a.width, a.height, a.dpi),
                          prettyBytes(a.sizeBytes),
                        ]
                          .filter(Boolean)
                          .join(" • ");
                      })()
                    : item.type === "PRINT"
                    ? [
                        item.print?.size,
                        item.print?.material,
                        item.print?.frame,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    : "";

                return (
                  <div
                    key={item.id}
                    // ⬇️ removed overflow-hidden here; keep rounded/shadow only
                    className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition border border-gray-100"
                  >
                    {/* ⬇️ image wrapper now handles clipping */}
                    <div className="relative h-56 w-full rounded-t-xl overflow-hidden">
                      <Image
                        src={img}
                        alt={item.product.title}
                        fill
                        className="object-cover"
                        sizes="(min-width:1024px) 33vw, 50vw"
                      />
                      <div className="absolute left-3 top-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-800 shadow">
                          {item.type}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <h5 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition line-clamp-1">
                        {item.product.title}
                      </h5>

                      {topMeta && (
                        <p
                          className="text-xs text-gray-600 line-clamp-1"
                          title={topMeta}
                        >
                          {topMeta}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-gray-700">
                          <span className="font-semibold">
                            ${item.price.toFixed(2)}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-gray-500">
                              {" "}
                              × {item.quantity}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.type === "DIGITAL" ? (
                            <DownloadMenu
                              tokens={item.digital?.tokens || []}
                              title={item.product.title}
                              itemId={item.id}
                            />
                          ) : (
                            <StatusPill
                              status={item.order.status || "PENDING"}
                            />
                          )}

                          {item.order.stripeSessionId && (
                            <button
                              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800"
                              onClick={() =>
                                window.location.assign(
                                  (item.order.isUserDesign && filter.toUpperCase()==='DIGITAL')
                                    ? `/store/${item.product.id}/studio`
                                    : `/cart/checkout/success?session_id=${item.order.stripeSessionId}`
                                )
                              }
                            >
                              Details
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const styles =
    s === "COMPLETED" || s === "PAID"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : s === "SHIPPED"
      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
      : s === "CANCELLED"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${styles}`}>{s}</span>
  );
}

// type CollectionDigitalAsset = {
//   tokenId: string;
//   url: string;
//   ext: string | null;
//   width?: number | null;
//   height?: number | null;
//   dpi?: number | null;
//   sizeBytes?: number | null;
// };

function DownloadMenu({
  tokens,
  title,
  itemId,
}: {
  tokens: Array<{
    tokenId: string;
    url: string;
    ext: string | null;
    width?: number | null;
    height?: number | null;
    dpi?: number | null;
    sizeBytes?: number | null;
  }>;
  title: string;
  itemId: string;
}) {
  const [open, setOpen] = useState(false);
  const { downloadingId, pct, download, isDownloading } = useDownloader();

  if (!tokens.length)
    return (
      <span
        className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-400"
        title="No active downloads"
      >
        Unavailable
      </span>
    );

  const anyBusy = isDownloading();

  return (
    <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
      <button
        className={`text-xs px-3 py-1.5 rounded-full shadow ${
          anyBusy
            ? "bg-gray-300 text-gray-700 cursor-wait"
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={anyBusy}
      >
        {anyBusy ? "Downloading…" : "Download"}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-lg ring-1 ring-black/5 z-30 overflow-hidden"
          // keep open while downloading so spinner remains visible
          onMouseLeave={() => {
            if (!anyBusy) setOpen(false);
          }}
        >
          <ul className="divide-y divide-gray-100">
            {tokens.map((a) => {
              const labelParts = [
                a.ext?.toUpperCase(),
                resString(a.width, a.height, a.dpi),
                prettyBytes(a.sizeBytes),
              ]
                .filter(Boolean)
                .join(" • ");

              const id = `${itemId}:${a.tokenId}`;
              const busy = downloadingId === id;
              const percent = pct(id);

              return (
                <li key={a.tokenId} className="p-2">
                  <button
                    type="button"
                    className={`w-full text-left flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-gray-50 ${
                      busy ? "cursor-wait" : ""
                    }`}
                    disabled={busy}
                    onClick={async () => {
                      // keep menu open during download
                      const ext = (a.ext || "file").toLowerCase();
                      await download(id, a.url, safeFilename(title, ext));
                      // close after completion
                      setOpen(false);
                    }}
                  >
                    {/* Spinner + % */}
                    {busy ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-700">
                        <SpinnerMini />
                        {percent > 0 && percent < 100 ? `${percent}%` : "…"}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-900">
                        Download {a.ext?.toUpperCase() || "File"}
                      </span>
                    )}

                    {/* right-aligned meta */}
                    <span className="ml-auto text-[11px] text-gray-600">
                      {labelParts}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SpinnerMini() {
  return (
    <svg
      className="size-3 animate-spin"
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
