// components/KindInfoPanel.tsx
"use client";

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sticker as StickerIcon,
  BookOpen as BookIcon,
  Ruler as RulerIcon,
  Info as InfoIcon,
  Layers as LayersIcon,
  Scissors as CutIcon,
  Package as PackIcon,
  Palette as PaletteIcon,
  BadgeCheck as CheckIcon,
  Frame as FrameIcon,
  Coffee as CoffeeIcon,
} from "lucide-react";

import ArtInfoModel from "./ArtInfoModel";
import ProductConfigurator from "@acme/ui/components/product/detail/ProductConfigurator";
import CartActions from "@acme/ui/components/product/CartActions";

import type {
  MaterialOption,
  FrameOption,
  LicenseOption,
} from "@acme/core/types";
import {
  allFrames,
  allLicenses,
  allMaterials,
  allSizes,
} from "@acme/core/data/helpers";

import { useProductData } from "@acme/ui/components/studio/hooks/useProductData";

// ——— UI atoms ————————————————————————————————————————————————
function Section({
  title,
  icon,
  children,
  tone = "indigo",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "indigo" | "emerald" | "rose" | "amber" | "cyan" | "violet";
}) {
  const tones: Record<string, string> = {
    indigo:
      "from-indigo-50 via-white to-white ring-indigo-100/70 shadow-indigo-100/50",
    emerald:
      "from-emerald-50 via-white to-white ring-emerald-100/70 shadow-emerald-100/50",
    rose: "from-rose-50 via-white to-white ring-rose-100/70 shadow-rose-100/50",
    amber:
      "from-amber-50 via-white to-white ring-amber-100/70 shadow-amber-100/50",
    cyan: "from-cyan-50 via-white to-white ring-cyan-100/70 shadow-cyan-100/50",
    violet:
      "from-violet-50 via-white to-white ring-violet-100/70 shadow-violet-100/50",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl bg-gradient-to-b ${tones[tone]} ring-1 p-4 sm:p-5 shadow-sm`}
      role="region"
      aria-label={title}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-xl bg-black/5 flex items-center justify-center">
          {icon ?? <InfoIcon className="h-4 w-4 text-black/60" />}
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  );
}

function SpecRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 items-start gap-2 py-1.5">
      <span className="col-span-1 sm:col-span-2 text-xs text-gray-500">
        {label}
      </span>
      <span className="col-span-2 sm:col-span-3 text-sm font-medium text-gray-900">
        {children}
      </span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      {children}
    </span>
  );
}

function ChipList({
  items,
  emptyLabel = "—",
}: {
  items?: (string | null | undefined)[] | null;
  emptyLabel?: string;
}) {
  if (!items || items.length === 0)
    return <span className="text-gray-500">{emptyLabel}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (it ? <Chip key={`${it}-${i}`}>{it}</Chip> : null))}
    </div>
  );
}

function KV({ v }: { v?: string | number | boolean | null }) {
  if (v === undefined || v === null || v === "") return <span className="text-gray-500">—</span>;
  if (typeof v === "boolean") return <span>{v ? "Yes" : "No"}</span>;
  return <span>{String(v)}</span>;
}

const DimRow = ({ o }: { o?: any }) => (
  <SpecRow label="Dimensions">
    {o?.widthIn && o?.heightIn ? (
      <div className="flex items-center gap-2">
        <RulerIcon className="h-4 w-4 text-gray-500" />
        <span>
          {o.widthIn}" × {o.heightIn}"
          {o.depthIn ? ` × ${o.depthIn}"` : ""}
        </span>
      </div>
    ) : (
      <span className="text-gray-500">—</span>
    )}
  </SpecRow>
);

// ——— logic helpers ————————————————————————————————————————————————
function shouldUseArtInfoModel(product: any): boolean {
  const kind = product?.kind as string | undefined;
  if (kind === "ART") return true;
  if (kind === "OTHER") {
    const hint = product?.kindInfo?.typeHint as string | null | undefined;
    if (hint === "PRINT" || hint === "DIGITAL") return true;
  }
  return false;
}

function upperExts(formats?: string[] | null) {
  return (formats ?? [])
    .map((u) => (u?.split(".").pop() ?? "").toUpperCase())
    .filter(Boolean);
}

// ——— compact purchase block used by non-ART kinds ————————————————
function KindPurchaseBlock({
  product,
  allow, // { digital: boolean, print: boolean }
  hideFields = {}, // e.g. { size: true, material: true, frame: true, license: false }
}: {
  product: any;
  allow: { digital: boolean; print: boolean };
  hideFields?: Partial<Record<"size" | "material" | "frame" | "license", boolean>>;
}) {
  const {
    inCart,
    options,
    setOptions,
    size,
    setSize,
    customSize,
    setCustomSize,
    isCustom,
    setIsCustom,
    material,
    setMaterial,
    frame,
    setFrame,
    license,
    setLicense,
    wantDigital,
    setWantDigital,
    wantPrint,
    setWantPrint,
    addToCart,
    removeFromCart,
    handleCheckoutAction,
    loadingAdd,
  } = useProductData({ productId: product.id });

  // Enforce allowed branches
  useEffect(() => {
    if (!allow.digital && wantDigital) setWantDigital(false);
    if (!allow.print && wantPrint) setWantPrint(false);
    // If neither is allowed (shouldn't happen), force print=false/digital=false
  }, [allow.digital, allow.print]); // eslint-disable-line

  // For print-only kinds, default to print true for convenience
  useEffect(() => {
    if (!allow.digital && allow.print && !wantPrint) setWantPrint(true);
  }, [allow.digital, allow.print]); // eslint-disable-line

  return (
    <div className="mt-4 space-y-4">
      <ProductConfigurator
        showFormat={true}
        product={product}
        inCart={inCart || null}
        optionSizes={allSizes}
        materials={allMaterials as MaterialOption[]}
        frames={allFrames as FrameOption[]}
        licenses={allLicenses as LicenseOption[]}
        formatData={{ options, setOptions }}
        licenseData={{ license, setLicense }}
        sizeData={{
          size,
          setSize,
          customSize,
          setCustomSize,
          isCustom,
          setIsCustom,
        }}
        materialData={{ material, setMaterial }}
        frameData={{ frame, setFrame }}
        selection={{
          wantDigital,
          setWantDigital: allow.digital ? setWantDigital : () => {},
          wantPrint,
          setWantPrint: allow.print ? setWantPrint : () => {},
        }}
        // Optional per-kind visibility toggles
        hidden={{
          size: !!hideFields.size,
          material: !!hideFields.material,
          frame: !!hideFields.frame,
          license: !!hideFields.license,
          // If your Configurator supports hiding format/license etc.
        }}
        disabledOptions={{
          digital: !allow.digital,
          print: !allow.print,
        }}
      />

      <CartActions
        inCart={Boolean(inCart || null)}
        loading={loadingAdd}
        disabled={
          // must have at least one of the allowed branches selected
          (!allow.digital || !wantDigital) && (!allow.print || !wantPrint)
        }
        onToggleCart={async () => {
          if (!product) return;

          if (!inCart) {
            await addToCart(
              product.id,
              allow.digital && wantDigital ? "Digital" : null,
              allow.print && wantPrint ? "Print" : null,
              // format
              product.formats?.[0]?.split(".").pop() || "",
              // size/material/frame
              size?.label ?? null,
              // For STICKER/CARD default material names are already coming from selections
              // (your server will normalize anyway)
              (material as any)?.label ?? (material as any) ?? null,
              (frame as any)?.label ?? (frame as any) ?? null,
              // license
              license?.type ?? "personal",
              1
            );
          } else {
            await removeFromCart(product.id, options.digitalVariantId!, options.printVariantId!);
          }
        }}
        onCheckout={async () => {
          const result = await handleCheckoutAction({
            openUI: false,
            exportHref: "/account/orders",
          });
          if (!result || result.status !== "ok") return;
          await new Promise((r) => requestAnimationFrame(r));
          if (result.flow === "embedded") {
            window.dispatchEvent(new CustomEvent("open-checkout", {
              detail: {
                clientSecret: result.clientSecret,
                exportHref: "/account/orders",
              },
            }));
          } else if (result.flow === "redirect") {
            window.location.href = result.url;
          } else if (result.flow === "sessionId") {
            const stripe = await import("@stripe/stripe-js").then((m) =>
              m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
            );
            await stripe?.redirectToCheckout({ sessionId: result.sessionId });
          }
        }}
      />
    </div>
  );
}

// ——— main panel ————————————————————————————————————————————————
export function KindInfoPanel({ product }: { product: any }) {
  if (!product) return null;

  // Route full configurator for digital/print art
  if (shouldUseArtInfoModel(product)) {
    return <ArtInfoModel productId={product.id} />;
  }

  // Otherwise: kind-specific spec + compact purchase block
  const kind = product.kind as
    | "STICKER"
    | "MUG"
    | "CARD"
    | "BOOK_DIGITAL"
    | "OTHER";

  const info = product.kindInfo ?? {};
  const sizes: string[] =
    (Array.isArray(info?.sizes) && info.sizes.length
      ? info.sizes
      : Array.isArray(product?.sizes)
      ? product.sizes
      : []) || [];
  const fmts = upperExts(product.formats);

  switch (kind) {
    case "STICKER":
      return (
        <Section title="Sticker" icon={<StickerIcon className="h-4 w-4 text-black/60" />} tone="emerald">
          <div className="space-y-2">
            <SpecRow label="Material"><KV v={info.material ?? "Matte Vinyl"} /></SpecRow>
            <SpecRow label="Finish"><KV v={info.finish ?? "Matte"} /></SpecRow>
            <SpecRow label="Cut Type">
              <div className="inline-flex items-center gap-1.5">
                <CutIcon className="h-4 w-4 text-gray-500" />
                <KV v={info.cutType ?? "Die-cut"} />
              </div>
            </SpecRow>
            <SpecRow label="Pack Quantity">
              <div className="inline-flex items-center gap-1.5">
                <PackIcon className="h-4 w-4 text-gray-500" />
                <KV v={info.packQuantity ?? 1} />
              </div>
            </SpecRow>
            <SpecRow label="Sizes"><ChipList items={sizes} /></SpecRow>
            {fmts.length > 0 && (
              <SpecRow label="Download Formats"><ChipList items={fmts} /></SpecRow>
            )}

            {/* Purchase controls (PRINT only) */}
            <KindPurchaseBlock
              product={product}
              allow={{ digital: false, print: true }}
              hideFields={{ license: true /* stickers don't need license picker */ }}
            />
          </div>
        </Section>
      );

    case "MUG":
      return (
        <Section title="Mug" icon={<CoffeeIcon className="h-4 w-4 text-black/60" />} tone="amber">
          <div className="space-y-2">
            <SpecRow label="Material"><KV v={info.material ?? "Ceramic"} /></SpecRow>
            <SpecRow label="Capacity / Sizes"><ChipList items={sizes} /></SpecRow>
            <SpecRow label="Color">
              <div className="inline-flex items-center gap-1.5">
                <PaletteIcon className="h-4 w-4 text-gray-500" />
                <KV v={info.mugColor ?? "White"} />
              </div>
            </SpecRow>
            <SpecRow label="Dishwasher Safe">
              <div className="inline-flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-gray-500" />
                <KV v={!!info.dishwasherSafe} />
              </div>
            </SpecRow>

            {/* Purchase controls (PRINT only) */}
            <KindPurchaseBlock
              product={product}
              allow={{ digital: false, print: true }}
              hideFields={{ license: true /* no digital license */ }}
            />
          </div>
        </Section>
      );

    case "CARD":
      return (
        <Section title="Card" icon={<LayersIcon className="h-4 w-4 text-black/60" />} tone="violet">
          <div className="space-y-2">
            <SpecRow label="Stock"><KV v={info.stock ?? "310gsm"} /></SpecRow>
            <SpecRow label="Finish"><KV v={info.finish ?? "Smooth"} /></SpecRow>
            <SpecRow label="Pack Quantity"><KV v={info.packQuantity ?? 54} /></SpecRow>
            <SpecRow label="Size"><ChipList items={sizes} /></SpecRow>

            {/* Purchase controls (PRINT only) */}
            <KindPurchaseBlock
              product={product}
              allow={{ digital: false, print: true }}
              hideFields={{ license: true }}
            />
          </div>
        </Section>
      );

    case "BOOK_DIGITAL":
      return (
        <Section title="Digital Book" icon={<BookIcon className="h-4 w-4 text-black/60" />} tone="cyan">
          <div className="space-y-2">
            {info.isbn && <SpecRow label="ISBN"><KV v={info.isbn} /></SpecRow>}
            {info.pageCount && <SpecRow label="Pages"><KV v={info.pageCount} /></SpecRow>}
            <SpecRow label="Language"><KV v={info.language ?? "English"} /></SpecRow>
            {fmts.length > 0 && (
              <SpecRow label="Available Files"><ChipList items={fmts} /></SpecRow>
            )}

            {/* Purchase controls (DIGITAL only) */}
            <KindPurchaseBlock
              product={product}
              allow={{ digital: true, print: false }}
              hideFields={{ size: true, material: true, frame: true /* license visible */ }}
            />
          </div>
        </Section>
      );

    case "OTHER": {
      const o = info?.original;
      if (info?.typeHint === "ORIGINAL" && o) {
        // ORIGINAL = spec + (optionally) simple add-to-cart if you sell originals as PRINT (usually NO)
        return (
          <Section title="Original Artwork" icon={<FrameIcon className="h-4 w-4 text-black/60" />} tone="rose">
            <div className="space-y-2">
              <DimRow o={o} />
              {o?.weightLb && <SpecRow label="Weight"><KV v={`${o.weightLb} lb`} /></SpecRow>}
              {o?.year && <SpecRow label="Year"><KV v={o.year} /></SpecRow>}
              {o?.medium && <SpecRow label="Medium"><KV v={o.medium} /></SpecRow>}
              {o?.surface && <SpecRow label="Surface"><KV v={o.surface} /></SpecRow>}
              <SpecRow label="Framed"><KV v={!!o?.framed} /></SpecRow>
              {o?.sku && <SpecRow label="SKU"><KV v={o.sku} /></SpecRow>}
            </div>
          </Section>
        );
      }

      // OTHER (non-original) falls back to details + purchase controls (treat like ART light)
      return (
        <Section title="Product Details" icon={<InfoIcon className="h-4 w-4 text-black/60" />} tone="indigo">
          <div className="space-y-2">
            {sizes.length > 0 && <SpecRow label="Sizes"><ChipList items={sizes} /></SpecRow>}
            {fmts.length > 0 && <SpecRow label="Download Formats"><ChipList items={fmts} /></SpecRow>}
            <KindPurchaseBlock
              product={product}
              allow={{ digital: true, print: true }}
              hideFields={{ /* show everything */ }}
            />
          </div>
        </Section>
      );
    }
  }
}
