// src/lib/achievements.ts
import type { CollectionItem } from '../types';

export type UserStats = {
  ordersPlaced: number;
  uniqueArtworks: number;   // main track
  customs: number;          // customized items
  lifetimeSpend: number;    // USD
};

function getUnitPrice(item: any): number {
  // normalize common shapes
  if (typeof item.price === 'number') return item.price;
  if (typeof item.unitPrice === 'number') return item.unitPrice;
  if (typeof item.unitAmountCents === 'number') return item.unitAmountCents / 100;
  return 0;
}

function getQty(item: any): number {
  if (typeof item.quantity === 'number') return item.quantity;
  if (typeof item.qty === 'number') return item.qty;
  return 1;
}

export function computeStats(items: CollectionItem[]): UserStats {
  const orderIds = new Set<string>();
  const uniqueKeys = new Set<string>();
  let customs = 0;
  let lifetimeSpend = 0;

  for (const i of items as any[]) {
    // orders
    if (i?.order?.id) orderIds.add(i.order.id);

    // unique artworks: prefer purchasedDesignId (captures custom snapshot), fallback to product.id
    const key =
      i?.purchasedDesignId ? `pd:${i.purchasedDesignId}` :
      i?.product?.id       ? `p:${i.product.id}` : null;
    if (key) uniqueKeys.add(key);

    // customized count
    if (i?.isCustom || i?.purchasedDesignId) customs++;

    // spend = unit price * quantity
    lifetimeSpend += getUnitPrice(i) * getQty(i);
  }

  return {
    ordersPlaced: orderIds.size,
    uniqueArtworks: uniqueKeys.size,
    customs,
    lifetimeSpend: Math.round(lifetimeSpend * 100) / 100,
  };
}

// Tracks & tiers
export const TIERS = {
  collector: [1, 3, 5, 10, 25, 50, 100],      // unique artworks
  loyalist:  [1, 3, 5, 10, 20],               // orders placed
  creator:   [1, 5, 10],                      // customized items
  roller:    [100, 250, 500, 1000],           // lifetime spend ($)
} as const;

export function progressToNext(value: number, tiers: number[]) {
  const sorted = [...tiers].sort((a, b) => a - b);
  const current = [...sorted].reverse().find((t) => value >= t) ?? 0;
  const next = sorted.find((t) => t > value) ?? null;

  const min = current;
  const max = (next ?? current) || 1; // avoid division by zero
  const span = Math.max(1, max - min);
  const pct = next ? Math.min(100, Math.round(((value - min) / span) * 100)) : 100;

  return { current, next, pct };
}

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
