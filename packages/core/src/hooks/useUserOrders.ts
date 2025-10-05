// src/hooks/useUserOrders.ts
'use client';

import { useUser } from '../contexts/UserContext';
import type { CollectionItem, VariantType } from '../types';
import { useEffect, useMemo, useState } from 'react';

export type OrdersByGroup = Record<string, CollectionItem[]>;
export type OrdersFilter = VariantType | 'ALL';

type FetchShape = OrdersByGroup; // API returns { <groupKey>: CollectionItem[] }

export function useUserOrdersData() {
  const { user } = useUser();
  const [rawData, setRawData] = useState<OrdersByGroup>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setRawData({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/orders?userId=${user.id}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText || 'Failed to load orders');
        return res.json();
      })
      .then((json: FetchShape) => {
        if (!cancelled) setRawData(json || {});
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { rawData, loading, error };
}

/** Derived views (pure helpers) */
export function selectFlat(raw: OrdersByGroup): CollectionItem[] {
  return Object.values(raw).flat();
}

export function selectFiltered(items: CollectionItem[], filter: OrdersFilter): CollectionItem[] {
  if (filter === 'ALL') return items;
  return items.filter((i) => i.type === filter);
}

export function groupByDate(items: CollectionItem[]): OrdersByGroup {
  return items.reduce<OrdersByGroup>((acc, item) => {
    const dateKey = item.order.placedAt.split('T')[0]; // ISO to YYYY-MM-DD
    (acc[dateKey] ||= []).push(item);
    return acc;
  }, {});
}
