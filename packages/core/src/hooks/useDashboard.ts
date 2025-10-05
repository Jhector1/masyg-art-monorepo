"use client";

import { useState, useEffect } from "react";

export interface DashboardData {
  favoriteCount: number;
  downloadCount: number;
  purchasedArtworks: number;
  ordersPlaced: number;
  avgOrderValue: number;
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchDashboard() {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (!res.ok)
          throw new Error(json.error || "Failed to fetch dashboard data");
        if (isMounted) setData(json as DashboardData);
      } catch (err) {
        if (err instanceof Error) if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  return { data, loading, error };
}
