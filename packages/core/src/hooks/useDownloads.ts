// File: src/hooks/useDownloads.ts
import useSWR from "swr";

export function useDownloads() {
  const { data, error } = useSWR<{ count: number }>("/api/user/download/count", fetcher);
  return {
    count:     data?.count ?? 0,
    loading:   !error && !data,
    error,
  };
}

// simple fetcher
async function fetcher(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load downloads");
  return res.json();
}
