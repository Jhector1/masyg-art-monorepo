"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bars3Icon,
  XMarkIcon,
  ShoppingBagIcon,
  HeartIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

import { useUser } from "@acme/core/contexts/UserContext";
import { useSession, signOut } from "next-auth/react";
import UserMenu from "./UserMenu";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/store", label: "Shop" },
  { href: "/contact", label: "Contact" },
];

export default function Header({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [elevated, setElevated] = useState(false);

  const { user } = useUser();
  const { data: session, status } = useSession();

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const menuItems = useMemo(
    () => [
      { label: "Profile", href: "/profile" },
      { label: "Orders", href: "/account/orders" },
    ],
    [user?.isAdmin]
  );

  // Desktop account slot (UserMenu stays only on md+)
  const desktopAccountSlot = (() => {
    if (status === "loading") {
      return (
        <div
          className="hidden md:block h-9 w-9 rounded-full bg-neutral-200 animate-pulse"
          aria-hidden
        />
      );
    }

    if (!session?.user) {
      return (
        <Link
          href="/authenticate"
          aria-label="Account"
          className="hidden md:inline-flex p-2 rounded-full hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
        >
          <UserIcon className="h-5 w-5 text-neutral-700" />
        </Link>
      );
    }

    return (
      <div className="hidden md:block">
        <UserMenu
          userName={user?.name || "Account"}
          userImage={user?.image || user?.avatarUrl || "/placeholder.png" || null}
          userEmail={user?.email || null}
          userRole={user?.isAdmin ? "Admin" : "Member"}
          menuItems={menuItems}
          onSignOut={() => signOut({ callbackUrl: "/" })}
        />
      </div>
    );
  })();

  return (
    <header
      className={[
        "sticky top-0 z-50 backdrop-blur bg-white/70",
        elevated ? "shadow-sm border-b border-neutral-200/60" : "",
      ].join(" ")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 font-medium tracking-tight"
          >
            <img src="/logo.svg" alt="Jean Yves Logo" className="h-6 w-6" />
            <span className="text-[15px] uppercase">Jean Yves</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(({ href, label }) => {
              const active =
                pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "text-sm transition-colors",
                    active
                      ? "text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900",
                  ].join(" ")}
                >
                  <span className="relative inline-block">
                    {label}
                    {active && (
                      <span
                        className="absolute inset-x-0 -bottom-1 h-[1px] bg-neutral-900"
                        aria-hidden
                      />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/favorites"
              aria-label="Favorites"
              className="p-2 rounded-full hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              <HeartIcon className="h-5 w-5 text-neutral-700" />
            </Link>

            {/* ✅ Desktop-only account */}
            {desktopAccountSlot}

            <Link
              href="/cart"
              aria-label="Cart"
              className="relative p-2 rounded-full hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            >
              <ShoppingBagIcon className="h-5 w-5 text-neutral-700" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-[5px] rounded-full bg-neutral-900 text-white text-[11px] leading-[18px] text-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            {/* Hamburger */}
            <button
              type="button"
              className="md:hidden p-2 rounded-full hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={open ? "md:hidden" : "hidden"}>
        {/* overlay */}
        <button
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
        />

        {/* panel */}
        <div className="fixed left-0 right-0 top-14 z-50 border-t border-neutral-200 bg-white shadow-lg">
          <div className="px-4 sm:px-6 py-4">
            {/* ✅ Account section INSIDE hamburger */}
            <div className="mb-4">
              {status === "loading" ? (
                <div className="h-12 rounded-2xl bg-neutral-200 animate-pulse" />
              ) : !session?.user ? (
                <Link
                  href="/authenticate"
                  className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50"
                  onClick={() => setOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-neutral-700" />
                    Sign in
                  </span>
                  <span className="text-neutral-500">→</span>
                </Link>
              ) : (
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        user?.image ||
                        user?.avatarUrl ||
                        "/placeholder.png"
                      }
                      alt="Profile"
                      className="h-10 w-10 rounded-full object-cover border border-neutral-200"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-900 truncate">
                        {user?.name || "Account"}
                      </div>
                      <div className="text-xs text-neutral-500 truncate">
                        {user?.email || session?.user?.email || ""}
                      </div>
                    </div>
                    <span className="ml-auto text-[11px] px-2 py-1 rounded-full bg-neutral-100 text-neutral-700">
                      {user?.isAdmin ? "Admin" : "Member"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {menuItems.map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        className="rounded-xl border border-neutral-200 px-3 py-2 text-sm text-center hover:bg-neutral-50"
                        onClick={() => setOpen(false)}
                      >
                        {it.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      className="col-span-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm text-white hover:opacity-90"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Nav links */}
            <nav>
              <ul className="flex flex-col">
                {NAV.map(({ href, label }) => {
                  const active =
                    pathname === href ||
                    (href !== "/" && pathname.startsWith(href));
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={[
                          "flex items-center justify-between rounded-xl px-3 py-3 text-sm",
                          active
                            ? "bg-neutral-100 text-neutral-900"
                            : "text-neutral-700 hover:bg-neutral-50",
                        ].join(" ")}
                        onClick={() => setOpen(false)}
                      >
                        <span>{label}</span>
                        {active && (
                          <span className="text-[11px] px-2 py-1 rounded-full bg-neutral-900 text-white">
                            Active
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* quick actions */}
              <div className="mt-3 flex gap-2">
                <Link
                  href="/favorites"
                  className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 text-center"
                  onClick={() => setOpen(false)}
                >
                  Favorites
                </Link>
                <Link
                  href="/cart"
                  className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 text-center"
                  onClick={() => setOpen(false)}
                >
                  Cart{cartCount ? ` (${cartCount})` : ""}
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
