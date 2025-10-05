// ============================================================
// File: src/components/profile/ProfileTabs.tsx
// Segmented control tabs with accessible state
// ============================================================
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Tab = "Profile" | "Collections" | "Settings";

export default function ProfileTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
}) {
  const tabs: Tab[] = ["Profile", "Collections", "Settings"];
  const slug = (t: Tab) => ({ Profile: "profile", Collections: "collections", Settings: "settings" }[t]);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const baseQP = new URLSearchParams(searchParams?.toString());
  baseQP.delete("tab");
  const base = baseQP.toString();
  const withTab = (t: Tab) => `${pathname}?tab=${slug(t)}${base ? `&${base}` : ""}`;

  return (
    <nav className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1" aria-label="Profile sections">
      {tabs.map((tab) => {
        const selected = tab === activeTab;
        return (
          <Link
            key={tab}
            href={withTab(tab)}
            replace
            scroll={false}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition data-[active=true]:bg-white data-[active=true]:shadow data-[active=true]:text-gray-900 hover:bg-black/5`}
            aria-current={selected ? "page" : undefined}
            data-active={selected}
          >
            {tab}
          </Link>
        );
      })}
    </nav>
  );
}

