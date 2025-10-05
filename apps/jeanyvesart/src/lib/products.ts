// File: src/lib/products.ts
export type InventoryStatus = "ACTIVE" | "RESERVED" | "SOLD";

export type OriginalVariant = {
  id: string;
  type: "ORIGINAL";
  status?: InventoryStatus | null;
  inventory?: number | null;
  listPrice?: number | null;

  widthIn?: number | null;
  heightIn?: number | null;
  depthIn?: number | null;
  year?: number | null;
  medium?: string | null;
  surface?: string | null;
};

export type Product = {
  id: string;
  title: string;
  description?: string | null;
  price: number;        // fallback price
  thumbnails: string[]; // first image is primary
  variants?: OriginalVariant[];
};

export function money(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function dims(v?: OriginalVariant) {
  if (!v) return "";
  const w = v.widthIn ?? null;
  const h = v.heightIn ?? null;
  const d = v.depthIn ?? null;
  if (w && h && d) return `${w} × ${h} × ${d}"`;
  if (w && h) return `${w} × ${h}"`;
  if (w) return `${w}"`;
  return "";
}

export function availability(v?: OriginalVariant): { label: string; tone: string } {
  const status = v?.status ?? "ACTIVE";
  const inv = v?.inventory ?? 1;
  if (status === "SOLD" || inv <= 0) return { label: "Sold",     tone: "text-neutral-400" };
  if (status === "RESERVED")          return { label: "Reserved", tone: "text-neutral-600" };
  return { label: "Available", tone: "text-neutral-900" };
}

export function originalVariant(p?: Product) {
  return (p?.variants ?? []).find(v => v.type === "ORIGINAL");
}

export function productPrice(p: Product) {
  return originalVariant(p)?.listPrice ?? p.price;
}
