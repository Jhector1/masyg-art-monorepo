// apps/admin/src/components/ClientFrame.tsx
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AdminHeader, { AuthButtons } from "../components/Header";

export default function ClientFrame({
  user,
  children,
}: {
  user: { name?: string; email?: string };
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => setSidebarOpen(false), [pathname]);

  return (
    <div className="bg-[#0f0f1a] bg-dot-grid bg-[length:var(--tw-background-size-dot-grid)] min-h-screen bg-gradient-to-r from-amber-100 via-white to-slate-100 text-gray-900">
      <AdminHeader
        user={user}
        brandHref="/admin"
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Dashboard" },
        ]}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarExpanded={sidebarOpen}
        newLinkHref="/admin/private/uploader"
        newLinkLabel="New"
      />

      <div className="mx-auto grid max-w-screen-2xl grid-cols-1 md:grid-cols-[240px_1fr]">
     <aside
  id="admin-sidebar"
  className="border-r bg-white/60 dark:bg-zinc-950/60 dark:border-zinc-800 md:static"
  data-open={sidebarOpen ? "true" : "false"}
>
  {sidebarOpen && (
    <button
      className="fixed inset-0 z-40 block md:hidden bg-black/20 backdrop-blur-[1px]"
      onClick={() => setSidebarOpen(false)}
      aria-label="Close sidebar"
    />
  )}

  <div
    className={`z-50 md:z-auto ${
      sidebarOpen
        ? "fixed left-0 top-16 block h-[calc(100dvh-4rem)] w-64"
        : "hidden"
    } md:block`}
  >
    {/* Make the column fill height so we can pin the footer */}
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      {/* NAV (scrolls if needed) */}
      <nav
        className="flex-1 overflow-y-auto border-r dark:border-zinc-800 p-3 text-sm"
        onClick={(e) => {
          const el = e.target as HTMLElement;
          if (window.innerWidth < 768 && el.closest("a")) setSidebarOpen(false);
        }}
      >
        <ul className="space-y-1">
          <li>
            <Link className="block rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin">
              Overview
            </Link>
          </li>
          <li>
            <Link className="block rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin/private/users">
              Users
            </Link>
          </li>
          <li>
            <Link className="block rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin/private/categories">
              Categories
            </Link>
          </li>
          <li>
            <Link className="block rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin/private/orders">
              Orders
            </Link>
          </li>
          <li>
            <Link className="block rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin/private/products">
              Products
            </Link>
          </li>
          <li>
            <Link className="block rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin/private/uploader">
              New product
            </Link>
          </li>
        </ul>
      </nav>

      {/* FOOTER ACTION (pinned to bottom) */}
      <div className="border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:bg-zinc-950/70 dark:border-zinc-800 md:hidden">
        <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <AuthButtons
            signedIn={!!user?.email}
            callbackUrl="/admin"
            className="inline-flex w-full justify-center"
          />
        </div>
      </div>
    </div>
  </div>
</aside>

        <main className="p-4 md:p-6">{children}</main>
      </div>

      <footer className="text-center text-sm py-6">
        &copy; 2024 ZileDigital Market
      </footer>
    </div>
  );
}
