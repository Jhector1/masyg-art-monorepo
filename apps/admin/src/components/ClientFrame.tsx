"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import AdminHeader, { AuthButtons } from "./Header";

type NavItem = { href: string; title: string; detail: string };
const coreLinks: NavItem[] = [
  { href: "/merchant", title: "All storefronts", detail: "Choose a store" },
  { href: "/merchant/products", title: "Products", detail: "Catalog and editions" },
  { href: "/merchant/inventory", title: "Inventory", detail: "Physical stock" },
  { href: "/merchant/orders", title: "Orders", detail: "Purchases and fulfillment" },
];
const moreLinks: NavItem[] = [
  { href: "/merchant/customers", title: "Customers", detail: "Buyer history" },
  { href: "/merchant/media", title: "Media library", detail: "Artwork previews" },
  { href: "/merchant/categories", title: "Categories", detail: "Catalog organization" },
  { href: "/merchant/storefronts", title: "Store settings", detail: "Publication and shipping" },
  { href: "/merchant/staff", title: "Team", detail: "People and permissions" },
  { href: "/merchant/security", title: "Account security", detail: "Protect your account" },
];

function MerchantNav({ pathname, close }: { pathname: string; close: () => void }) {
  const params = useSearchParams();
  const currentStore = params.get("store");
  const query = currentStore ? `?store=${encodeURIComponent(currentStore)}` : "";
  const render = (link: NavItem) => {
    const active = link.href === pathname || (link.href !== "/merchant" && pathname.startsWith(`${link.href}/`));
    return <Link key={link.href} href={`${link.href}${query && link.href !== "/merchant" ? query : ""}`} onClick={close} aria-current={active ? "page" : undefined}
      className={`block rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-amber-50"}`}>
      {link.title}<span className={`block text-[11px] font-normal ${active ? "text-zinc-300" : "text-zinc-400"}`}>{link.detail}</span>
    </Link>;
  };
  return <div className="space-y-2">
    <div className="space-y-1">{coreLinks.map(render)}</div>
    <details className="rounded-xl border border-zinc-100 p-1" open={moreLinks.some(link => pathname === link.href || pathname.startsWith(`${link.href}/`))}>
      <summary className="cursor-pointer list-none rounded-lg px-2 py-2 text-xs font-semibold text-zinc-600">More rooms +</summary>
      <div className="space-y-1">{moreLinks.map(render)}</div>
    </details>
  </div>;
}

export default function ClientFrame({ user, children }: { user: { name?: string; email?: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const merchantMode = pathname === "/merchant" || pathname.startsWith("/merchant/");
  const isEntry = pathname === "/" || pathname === "/merchant" || ["/merchant/signin", "/merchant/register", "/merchant/onboarding", "/merchant/invitations/accept"].includes(pathname);
  const showSidebar = !isEntry;
  React.useEffect(() => setSidebarOpen(false), [pathname]);
  const page = pathname === "/merchant" ? "Storefronts" : pathname === "/merchant/invitations/accept" ? "Accept invitation" : pathname.includes("/products/new") ? "Add product" : pathname.startsWith("/merchant/products/") ? "Edit product" : pathname === "/merchant/products" ? "Products" : pathname === "/merchant/categories" ? "Categories" : pathname === "/merchant/inventory" ? "Inventory" : pathname.startsWith("/merchant/orders") ? "Orders" : pathname.startsWith("/merchant/customers") ? "Customers" : pathname === "/merchant/staff" ? "Team" : pathname === "/merchant/media" ? "Media library" : pathname.startsWith("/merchant/storefronts") ? "Store settings" : "Workspace";
  const home = merchantMode ? "/merchant" : "/admin";
  return <div className="min-h-screen bg-gradient-to-br from-amber-50/60 via-zinc-50 to-slate-100 text-zinc-900">
    <AdminHeader user={user} title={merchantMode ? page : "Platform administration"}
      subtitle={merchantMode ? "Your storefront workspace" : undefined} brandHref={merchantMode ? "/merchant" : "/admin"}
      breadcrumbs={merchantMode ? [{ label: "Storefronts", href: "/merchant" }, { label: page }] : [{ label: "Admin", href: "/admin" }, { label: "Platform" }]}
      onToggleSidebar={showSidebar ? () => setSidebarOpen(open => !open) : undefined} sidebarExpanded={sidebarOpen}
      newLinkHref={merchantMode ? "/merchant" : "/admin"} newLinkLabel={merchantMode ? "My storefronts" : "Overview"}
      showSearch={false} showNotifications={!merchantMode} />
    <div className={`mx-auto flex w-full gap-0 lg:gap-6 lg:px-5 ${showSidebar ? "max-w-[1600px]" : "max-w-7xl"}`}>
      {showSidebar && sidebarOpen && <button aria-label="Close navigation" type="button" className="fixed inset-0 z-40 bg-zinc-950/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      {showSidebar && <aside id="admin-sidebar" className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 w-64 bg-white pt-20 shadow-2xl" : "hidden"} shrink-0 border-r border-zinc-200/80 lg:sticky lg:top-28 lg:mt-5 lg:block lg:h-[calc(100dvh-9rem)] lg:w-56 lg:rounded-2xl lg:border lg:bg-white/90 lg:pt-0 lg:shadow-sm`}>
        <nav aria-label="Administration navigation" className="flex h-full flex-col p-4">
          <div className="px-2 pb-3 text-[11px] font-bold uppercase tracking-[.2em] text-zinc-400">{merchantMode ? "Store workspace" : "Platform"}</div>
          {merchantMode ? <Suspense fallback={<p className="text-xs text-zinc-500">Loading navigation…</p>}><MerchantNav pathname={pathname} close={() => setSidebarOpen(false)}/></Suspense> : <Link href="/admin" className="rounded-xl bg-zinc-100 p-3 text-sm font-semibold">Platform overview</Link>}
          <div className="mt-auto border-t border-zinc-100 pt-4"><p className="mb-3 px-2 text-xs leading-5 text-zinc-500">{merchantMode ? "Every action is limited to your authorized storefront." : "Platform access is separate from merchant access."}</p><div className="lg:hidden"><AuthButtons signedIn={!!user.email} callbackUrl={home} className="flex w-full"/></div></div>
        </nav>
      </aside>}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
    <footer className="mx-auto max-w-[1600px] px-5 pb-8 pt-4 text-center text-xs text-zinc-500">© {new Date().getFullYear()} ZileDigital · Commerce administration</footer>
  </div>;
}
