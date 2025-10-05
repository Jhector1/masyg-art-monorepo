// src/components/shared/purchase/persistence.ts
export type PersistedPurchaseState = {
  v: 1;
  ts: number;
  wantDigital: boolean;
  wantPrint: boolean;
  qty: number;
  licenseType: string;
  sizeLabel: string;
  isCustom: boolean;
  customSize: { width: string; height: string };
  materialLabel: string;
  frameLabel: string | null;
};

const VERSION = 1;
const isBrowser = typeof window !== "undefined";

function keyOf(productId: string, designId?: string) {
  const d = designId || "none";
  return `purchase:${productId}:${d}`;
}

export function loadPurchaseState(productId: string, designId?: string): PersistedPurchaseState | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(keyOf(productId, designId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v !== VERSION) return null;
    return parsed as PersistedPurchaseState;
  } catch { return null; }
}

export function savePurchaseState(
  productId: string,
  designId: string | undefined,
  state: Omit<PersistedPurchaseState, "v" | "ts">
) {
  if (!isBrowser) return;
  try {
    const payload: PersistedPurchaseState = { v: VERSION, ts: Date.now(), ...state };
    localStorage.setItem(keyOf(productId, designId), JSON.stringify(payload));
  } catch {}
}

export function clearPurchaseState(productId: string, designId?: string) {
  if (!isBrowser) return;
  try { localStorage.removeItem(keyOf(productId, designId)); } catch {}
}
