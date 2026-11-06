"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import AdminHeader, { AuthButtons } from "./Header";

const links = [
  { href: "/merchant", title: "Overview", detail: "Store performance" },
  { href: "/merchant/storefronts", title: "Storefronts", detail: "Visibility & publishing" },
  { href: "/merchant/products", title: "Products", detail: "Catalog and editing" },
  { href: "/merchant/products/new", title: "Create product", detail: "Artwork & variants" },
  { href: "/merchant/media", title: "Media library", detail: "Thumbnails & gallery" },
  { href: "/merchant/categories", title: "Categories", detail: "Organize artwork" },
  { href: "/merchant/inventory", title: "Inventory", detail: "Stock & locations" },
  { href: "/merchant/orders", title: "Orders", detail: "Payments & fulfillment records" },
  { href: "/merchant/customers", title: "Customers", detail: "Store purchase history" },
  { href: "/merchant/staff", title: "Staff", detail: "Organization access" },
];
function MerchantNav({ pathname, close }: { pathname: string; close: () => void }) {
  const params = useSearchParams();
  const currentStore = params.get("store");
  const query = currentStore ? `?store=${encodeURIComponent(currentStore)}` : "";
  return <div className="space-y-1">{links.map(link => {
    const selected = link.href === pathname || (link.href === "/merchant/storefronts" && pathname.startsWith("/merchant/storefronts/")) || (link.href === "/merchant/products" && pathname.startsWith("/merchant/products/") && !pathname.endsWith("/new"));
    return <Link key={link.href} href={`${link.href}${query}`} onClick={close} aria-current={selected ? "page" : undefined}
      className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition ${selected ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-amber-50 hover:text-zinc-900"}`}>
      {link.title}<span className={`mt-0.5 block text-[11px] font-normal ${selected ? "text-zinc-300" : "text-zinc-400"}`}>{link.detail}</span>
    </Link>;
  })}</div>;
}
export default function ClientFrame({ user, children }: { user: { name?: string; email?: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const merchantMode = pathname === "/merchant" || pathname.startsWith("/merchant/");
  React.useEffect(() => setSidebarOpen(false), [pathname]);
  const page = pathname === "/merchant/invitations/accept" ? "Accept invitation" : pathname.includes("/products/new") ? "Create product" : pathname.startsWith("/merchant/products/") ? "Edit product" : pathname === "/merchant/products" ? "Products" : pathname === "/merchant/categories" ? "Categories" : pathname === "/merchant/inventory" ? "Inventory" : pathname.startsWith("/merchant/orders") ? "Orders" : pathname.startsWith("/merchant/customers") ? "Customers" : pathname === "/merchant/staff" ? "Staff" : pathname === "/merchant/media" ? "Media library" : pathname === "/merchant/storefronts/settings" ? "Store settings" : pathname === "/merchant/storefronts" ? "Storefronts" : "Overview";
  const home = merchantMode ? "/merchant" : "/admin";
  return <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-zinc-50 to-slate-100 text-zinc-900">
    <AdminHeader user={user} title={merchantMode ? page : "Platform administration"}
      subtitle={merchantMode ? "Canonical commerce management" : undefined} brandHref={home}
      breadcrumbs={merchantMode ? [{ label: "Merchant", href: "/merchant" }, { label: page }] : [{ label: "Admin", href: "/admin" }, { label: "Platform" }]}
      onToggleSidebar={() => setSidebarOpen(open => !open)} sidebarExpanded={sidebarOpen}
      newLinkHref={merchantMode ? "/merchant/products/new" : "/admin"} newLinkLabel={merchantMode ? "Add product" : "Overview"}
      showSearch={false} showNotifications={!merchantMode} />
    <div className="mx-auto flex w-full max-w-[1600px] gap-0 lg:gap-6 lg:px-5">
      {sidebarOpen && <button aria-label="Close navigation" type="button" className="fixed inset-0 z-40 bg-zinc-950/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside id="admin-sidebar" className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 w-64 bg-white pt-20 shadow-2xl" : "hidden"} shrink-0 border-r border-zinc-200/80 lg:sticky lg:top-28 lg:mt-5 lg:block lg:h-[calc(100dvh-9rem)] lg:w-56 lg:rounded-2xl lg:border lg:bg-white/90 lg:pt-0 lg:shadow-sm`}>
        <nav aria-label="Administration navigation" className="flex h-full flex-col p-4">
          <div className="px-2 pb-3 text-[11px] font-bold uppercase tracking-[.2em] text-zinc-400">{merchantMode ? "Merchant workspace" : "Platform"}</div>
          {merchantMode ? <Suspense fallback={<p className="text-xs text-zinc-500">Loading navigation…</p>}><MerchantNav pathname={pathname} close={() => setSidebarOpen(false)}/></Suspense> : <Link href="/admin" className="rounded-xl bg-zinc-100 p-3 text-sm font-semibold">Platform overview</Link>}
          <div className="mt-auto border-t border-zinc-100 pt-4"><p className="mb-3 px-2 text-xs leading-5 text-zinc-500">{merchantMode ? "All merchant operations are scoped to authorized organizations and storefronts." : "Platform privileges are separate from merchant access."}</p><div className="lg:hidden"><AuthButtons signedIn={!!user.email} callbackUrl={home} className="flex w-full"/></div></div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
    <footer className="mx-auto max-w-[1600px] px-5 pb-8 pt-4 text-center text-xs text-zinc-500">© {new Date().getFullYear()} ZileDigital · Commerce administration</footer>
  </div>;
}
