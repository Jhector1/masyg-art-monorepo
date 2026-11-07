"use client";

import SEO from "@acme/ui/components/SEO";
import ProfileHeader from "@acme/ui/components/profile/ProfileHeader";
import ProfileInfo from "@acme/ui/components/profile/ProfileInfo";
import CollectionGallery from "@acme/ui/components/profile/CollectionGallery";
import OrderHistory from "@acme/ui/components/profile/OrderHistory";
import AccountSettings from "@acme/ui/components/profile/AccountSettings";
import Achievements from "@acme/ui/components/profile/Achievements";
import StatCard from "@acme/ui/components/profile/StatCard";

import { ArrowDownTrayIcon, HeartIcon, StarIcon, ShoppingBagIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { VariantType } from "@acme/core/types";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";
import {
  useUserOrdersData,
  selectFlat,
  selectFiltered,
  type OrdersFilter,
} from "@acme/core/hooks/useUserOrders";
import { computeStats } from "@acme/core/lib/achievements";
import type { CollectionItem as BaseItem } from "@acme/core/types";
import type { CollectionItem as GalleryItem } from "@acme/core/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@acme/core/hooks/useProfile";
import type { UserProfile } from "@acme/ui/components/profile/types";

export type Tab = "Profile" | "Collections" | "Orders" | "Settings";
const TAB_SLUG: Record<Tab, string> = { Profile: "profile", Collections: "collections", Orders: "orders", Settings: "settings" } as const;
const fromSlug = (slug?: string): Tab =>
  slug === "collections" ? "Collections" : slug === "orders" ? "Orders" : slug === "settings" ? "Settings" : "Profile";

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
  const { rawData, orders, loading: ordersLoading, error: ordersError, refreshOrders } = useUserOrdersData();
  const allFlat = useMemo(() => selectFlat(rawData), [rawData]);
  const filteredFlat = useMemo(() => selectFiltered(allFlat, filter), [allFlat, filter]);

  const baseItems: BaseItem[] = filteredFlat;
  const galleryItems: GalleryItem[] = useMemo(() => baseItems.map(toGalleryItem), [baseItems]);

  const stats = useMemo(() => computeStats(allFlat), [allFlat]);
  const purchasedArtworks = allFlat.length;

  const recentOrders = orders.length;

  // URL ↔ tab sync
  useEffect(() => {
    const next = fromSlug((searchParams?.get("tab") || "").toLowerCase());
    setActiveTab(current => current === next ? current : next);
  }, [searchParams]);

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
          <nav aria-label="Account sections" className="flex flex-wrap items-center gap-1 rounded-2xl bg-gray-100/80 p-1.5">
            {([
              ["Profile", "Overview"],
              ["Collections", "My Art"],
              ["Orders", "Orders"],
              ["Settings", "Settings"],
            ] as const).map(([tab, label]) => (
              <button
                key={tab} type="button"
                aria-current={activeTab === tab ? "page" : undefined}
                onClick={() => onTabChange(tab)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition sm:px-4 ${activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900"}`}
              >{label}</button>
            ))}
          </nav>
        </div>

        {activeTab === "Profile" && (
        <div className="flex gap-3 overflow-x-auto snap-x md:overflow-visible md:grid md:grid-cols-4 md:gap-4 -mx-2 px-2 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StatCard icon={<HeartIcon className="h-6 w-6" />} value={favorites.size} label="Favorites" />
          <StatCard icon={<ArrowDownTrayIcon className="h-6 w-6" />} value={user.downloadCount ?? 0} label="Downloads" />
          <StatCard icon={<StarIcon className="h-6 w-6" />} value={purchasedArtworks} label="Purchased Artworks" />
          <StatCard icon={<ShoppingBagIcon className="h-6 w-6" />} value={recentOrders} label="Recent Orders" />
        </div>
        )}

        {/* Tabs */}
        <div className="space-y-8">
          {activeTab === "Profile" && (
            <>
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Account overview</h2>
                  <p className="mt-1 text-sm text-gray-600">Your account details and purchase activity in one place.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onTabChange("Collections")}
                    className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">My Art</button>
                  <button type="button" onClick={() => onTabChange("Orders")}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Order history</button>
                </div>
              </section>
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

          {activeTab === "Orders" && (
            <OrderHistory
              orders={orders}
              loading={ordersLoading}
              error={ordersError?.message ?? null}
              onRefresh={refreshOrders}
              onViewCollections={() => onTabChange("Collections")}
            />
          )}

          {activeTab === "Settings" && <AccountSettings />}
        </div>
      </div>
    </>
  );
}
