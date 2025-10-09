"use client";

import Link from "next/link";
import * as React from "react";

export type AdminHeaderProps = {
  title?: string;
  subtitle?: string;
  brandHref?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
  user?: { name?: string; email?: string; avatarUrl?: string };
  envLabel?: string;
  newLinkHref?: string;
  newLinkLabel?: string;
  sidebarExpanded?: boolean;
};

function IconMenu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
function IconBell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
      <path strokeWidth="2" strokeLinecap="round" d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}
function IconChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}
function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconStore(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 10V7l2-3h12l2 3v3M6 10h12v9H6z" />
    </svg>
  );
}

function envName(explicit?: string) {
  if (explicit) return explicit;
  // These are statically inlined at build time → no hydration drift.
  const v = process.env.NEXT_PUBLIC_ENV_LABEL || process.env.NODE_ENV || "production";
  if (v === "development") return "Development";
  if (v === "test") return "Test";
  if (v === "production") return "Production";
  return v[0].toUpperCase() + v.slice(1);
}

function AuthButtons({
  signedIn,
  className = "",
  callbackUrl = "/admin",
}: {
  signedIn: boolean;
  className?: string;
  callbackUrl?: string;
}) {
  // We use a form POST for sign-out (NextAuth recommends POST).
  return signedIn ? (
    <form action="/api/auth/signout" method="POST" className={className}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white/80 px-3 text-xs font-medium text-zinc-700 shadow-sm hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 3h4v4M10 14l9-9M21 14v7H3V3h7" />
        </svg>
        Sign out
      </button>
    </form>
  ) : (
    <a
      href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      className={`inline-flex h-9 items-center gap-2 rounded-xl bg-zinc-900 px-3 text-xs font-medium text-white hover:opacity-90 dark:bg-white dark:text-zinc-900 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
      Sign in
    </a>
  );
}


export default function AdminHeader({
  title = "Dashboard",
  brandHref = "/admin",
  subtitle,
  breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Dashboard" },
  ],
  onToggleSidebar,
  onOpenSearch,
  user = { name: "Admin", email: "admin@ziledigital.com" },
  envLabel,
  newLinkHref = "/admin/private/uploader",
  newLinkLabel = "New",
  sidebarExpanded = false,
}: AdminHeaderProps) {
  const initials = React.useMemo(
    () =>
      (user?.name || "AA")
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [user?.name]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenSearch?.();
        window.dispatchEvent(new CustomEvent("open-command-palette"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenSearch]);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-zinc-950/60 dark:border-zinc-800">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800" />

      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-3 sm:px-4">
        {/* Left: mobile menu + brand */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="md:hidden grid size-9 place-items-center rounded-xl border border-zinc-200 bg-white/80 text-zinc-700 shadow-sm hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            onClick={() => onToggleSidebar?.()}
            aria-label="Toggle sidebar"
            aria-controls="admin-sidebar"
            aria-expanded={sidebarExpanded}
          >
            <IconMenu className="h-5 w-5" />
          </button>

          <Link href={brandHref} className="flex items-center gap-2" aria-label="ZileDigital Admin Home" prefetch={false}>
            <div className="grid size-9 place-items-center rounded-xl border bg-white/80 shadow-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              <IconStore className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold tracking-tight md:text-base">ZileDigital Admin</span>
              <span className="hidden select-none rounded-full border px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-300 sm:inline-block">
                {envName(envLabel)}
              </span>
            </div>
          </Link>

          {/* Breadcrumbs */}
          <div className="hidden md:block">
            <span className="mx-2 hidden h-6 w-px bg-zinc-200 align-middle dark:bg-zinc-800 md:inline-block" />
            <nav aria-label="Breadcrumb" className="inline-flex items-center text-xs">
              {breadcrumbs.map((bc, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <span key={`${bc.label}-${i}`} className="flex items-center">
                    {i > 0 && <IconChevronRight className="mx-1 h-3.5 w-3.5 text-zinc-400" />}
                    {!isLast && bc.href ? (
                      <Link href={bc.href} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" prefetch={false}>
                        {bc.label}
                      </Link>
                    ) : (
                      <span className="font-medium text-zinc-900 dark:text-zinc-100" aria-current="page">
                        {bc.label}
                      </span>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Center: search */}
        <div className="mx-auto hidden w-full max-w-lg flex-1 items-center md:flex">
          <div className="relative w-full">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="w-full rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 pl-10 text-sm shadow-sm outline-none transition focus:ring-1 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:focus:ring-zinc-700"
              placeholder="Search orders, customers, products…"
              aria-label="Search admin"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                  e.preventDefault();
                  onOpenSearch?.();
                }
              }}
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-white px-1.5 text-[10px] text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right: actions */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 md:inline-flex dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-label="Notifications"
          >
            <span className="relative inline-block">
              <IconBell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 inline-block h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
            </span>
          </button>

          <Link
            href={newLinkHref}
            className="hidden rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:opacity-90 sm:inline-flex dark:bg-white dark:text-zinc-900"
            prefetch={false}
          >
            {newLinkLabel}
          </Link>

  {/* Cleaner auth pill — matches 36px height and spacing */}
  <AuthButtons
    signedIn={!!user?.email}
    callbackUrl="/admin"
    className="hidden md:inline-flex"
  />
          <button type="button" className="rounded-xl pl-1 pr-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-haspopup="menu" aria-expanded="false">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user?.name || "User"} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="hidden min-w-0 text-left sm:block">
                <p className="truncate text-xs font-medium leading-4 text-zinc-900 dark:text-zinc-100">{user?.name || "Admin"}</p>
                <p className="truncate text-[10px] text-zinc-500">{user?.email || "admin@example.com"}</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Secondary row: page title */}
      <div className="mx-auto hidden w-full max-w-screen-2xl items-center gap-3 px-3 pb-3 sm:px-4 md:flex">
        <div className="flex flex-1 items-center justify-between">
          <div className="py-1">
            <h1 className="text-base font-semibold tracking-tight md:text-lg">{title}</h1>
            {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="mx-auto block w-full max-w-screen-2xl px-3 pb-3 md:hidden">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            className="w-full rounded-xl border border-zinc-200 bg-white/70 px-3 py-2 pl-10 text-sm shadow-sm outline-none transition focus:ring-1 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:focus:ring-zinc-700"
            placeholder="Search…"
            aria-label="Search admin"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                onOpenSearch?.();
              }
            }}
          />
        </div>
      </div>
{/* 
      <div className="px-3 pb-3 sm:px-4">
        <AuthButtons signedIn={!!user?.email} />
      </div> */}
    </header>
  );
}
