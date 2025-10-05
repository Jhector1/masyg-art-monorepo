"use client";

import SEO from "@acme/ui/components/SEO";
import ProfileHeader from "@acme/ui/components/profile/ProfileHeader";
import ProfileTabs from "@acme/ui/components/profile/ProfileTabs";
import ProfileInfo from "@acme/ui/components/profile/ProfileInfo";
import CollectionGallery from "@acme/ui/components/profile/CollectionGallery";
import AccountSettings from "@acme/ui/components/profile/AccountSettings";
import Achievements from "@acme/ui/components/profile/Achievements";
import StatCard from "@acme/ui/components/profile/StatCard";

import { ArrowDownTrayIcon, HeartIcon, StarIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { VariantType } from "@acme/core/types";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";
import { useDashboard } from "@acme/core/hooks/useDashboard";
import {
  useUserOrdersData,
  selectFlat,
  selectFiltered,
  groupByDate,
  type OrdersFilter,
} from "@acme/core/hooks/useUserOrders";
import { computeStats } from "@acme/core/lib/achievements";
import type { CollectionItem as BaseItem } from "@acme/core/types";
import type { CollectionItem as GalleryItem } from "@acme/core/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@acme/core/hooks/useProfile";
import type { UserProfile } from "@acme/ui/components/profile/types";

export type Tab = "Profile" | "Collections" | "Settings";
const TAB_SLUG: Record<Tab, string> = { Profile: "profile", Collections: "collections", Settings: "settings" } as const;
const fromSlug = (slug?: string): Tab =>
  slug === "collections" ? "Collections" : slug === "settings" ? "Settings" : "Profile";

function toGalleryItem(i: BaseItem): GalleryItem {
  const price = (i as any).price ?? (i as any).unitPrice ?? ((i as any).unitAmountCents ?? 0) / 100;
  const quantity = (i as any).quantity ?? (i as any).qty ?? 1;
  const previewUrl =
    (i as any).previewUrl ??
    (i as any).thumbnailUrl ??
    (i as any).imageUrl ??
    (i as any).product?.thumbnails?.[0] ??
    null;
  return { ...(i as any), price, quantity, previewUrl };
}

export default function ProfilePageClient({ initialTab }: { initialTab: Tab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<OrdersFilter>("DIGITAL");

  const { favorites } = useFavorites();
  const { data: dashboard } = useDashboard();

  // Profile
  const { user, loading, unauthorized, refresh, mutate } = useProfile({
    onUnauthorized: () => router.push("/authenticate"),
    // refreshIntervalMs: 60000, // optional: keep profile fresh every minute
  });

  // Optimistic + refetch helper used by children after PATCH success
  const applyUserPatch = useCallback(
    async (partial?: Partial<UserProfile> | UserProfile) => {
      if (partial) {
        mutate(prev => (prev ? { ...prev, ...partial } : (partial as UserProfile)));
      }
      await refresh(); // reconcile with DB and ensure we have latest updatedAt/avatarUrl/etc
    },
    [mutate, refresh]
  );

  // Orders
  const { rawData } = useUserOrdersData();
  const allFlat = useMemo(() => selectFlat(rawData), [rawData]);
  const filteredFlat = useMemo(() => selectFiltered(allFlat, filter), [allFlat, filter]);
  const grouped = useMemo(() => groupByDate(filteredFlat), [filteredFlat]);

  const baseItems: BaseItem[] = filteredFlat;
  const galleryItems: GalleryItem[] = useMemo(() => baseItems.map(toGalleryItem), [baseItems]);

  const stats = useMemo(() => computeStats(allFlat), [allFlat]);
  const purchasedArtworks = filteredFlat.length;

  const ordersPlaced = useMemo(() => {
    const fromItems = new Set(allFlat.map((i: any) => i?.order?.id).filter(Boolean)).size;
    const fromGroups = Object.keys(rawData).length;
    return fromItems || fromGroups;
  }, [allFlat, rawData]);

  // URL ↔ tab sync
  useEffect(() => {
    const next = fromSlug((searchParams?.get("tab") || "").toLowerCase());
    if (next !== activeTab) setActiveTab(next);
  }, [searchParams, activeTab]);

  const onTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", TAB_SLUG[tab]);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (loading) return <span>Loading…</span>;
  if (unauthorized) return <a href="/login">Sign in</a>;
  if (!user) return <span>Could not load profile</span>;

  // Map to header’s expected shape (note updatedAt for avatar cache-busting)
  const headerUser = {
    name: user.name ?? null,
    email: user.email ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    location: "Port-au-Prince, Haiti",
    memberSince: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return (
    <>
      <SEO title="Your Profile" description="Manage your account and collection." />

      <div className="max-w-6xl mx-auto py-10 space-y-10">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <ProfileHeader user={headerUser} onAvatarUpdated={applyUserPatch} />
          <ProfileTabs activeTab={activeTab} setActiveTab={onTabChange} />
        </div>

        {/* Stats */}
        <div className="flex gap-3 overflow-x-auto snap-x md:overflow-visible md:grid md:grid-cols-4 md:gap-4 -mx-2 px-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StatCard icon={<HeartIcon className="h-6 w-6" />} value={favorites.size} label="Favorites" />
          <StatCard icon={<ArrowDownTrayIcon className="h-6 w-6" />} value={dashboard?.downloadCount ?? 0} label="Downloads" />
          <StatCard icon={<StarIcon className="h-6 w-6" />} value={purchasedArtworks} label="Purchased Artworks" />
          <StatCard icon={<ShoppingBagIcon className="h-6 w-6" />} value={ordersPlaced} label="Orders Placed" />
        </div>

        {/* Tabs */}
        <div className="space-y-8">
          {activeTab === "Profile" && (
            <>
              <Achievements metric="artworks" uniqueArtworks={stats.uniqueArtworks} ordersPlaced={stats.ordersPlaced} />
              <ProfileInfo user={headerUser} onUpdated={applyUserPatch} />
            </>
          )}

          {activeTab === "Collections" && (
            <CollectionGallery
              filter={filter as VariantType}
              setFilter={(val: VariantType) => setFilter(val as any)}
              items={galleryItems}
            />
          )}

          {activeTab === "Settings" && <AccountSettings />}
        </div>
      </div>
    </>
  );
}
