"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bars3Icon, XMarkIcon, ShoppingBagIcon, HeartIcon, UserIcon } from "@heroicons/react/24/outline";
import { useUser } from "@acme/core/contexts/UserContext";

import { useSession, signOut } from "next-auth/react";
import UserMenu from "./UserMenu";

type NavItem = { href: string; label: string };
const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/store", label: "Shop" },
  // { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [elevated, setElevated] = useState(false);
const { isLoggedIn, user } = useUser();
  const { data: session, status } = useSession();
  // const user = session?.user as any;

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const menuItems = useMemo(
    () => [
      { label: "Profile", href: "/profile" },
      { label: "Orders", href: "/account/orders" },
      // { label: "Downloads", href: "/downloads" },
      // // example admin link
      // { label: "Admin", href: "https://admin.ziledigital.com", disabled: user?.isAdmin !== true },
    ],
    [user?.isAdmin]
  );

  const accountSlot = (() => {
    if (status === "loading") {
      // tiny placeholader to avoid layout jump
      return <div className="h-9 w-9 rounded-full bg-neutral-200 animate-pulse" aria-hidden />;
    }

    if (!session?.user) {
      return (
        <Link href="/authenticate" aria-label="Account" className="p-2 rounded-full hover:bg-neutral-100">
          <UserIcon className="h-5 w-5 text-neutral-700" />
        </Link>
      );
    }

    return (
      <UserMenu
        userName={user?.name || "Account"}
        userImage={user?.image || user?.avatarUrl || "/placeholder.png" || null}
        userEmail={user?.email || null}
        userRole={user?.isAdmin ? "Admin" : "Member"}
        menuItems={menuItems}
        onSignOut={() => signOut({ callbackUrl: "/" })}
      />
    );
  })();

  return (
    <header className={`sticky top-0 z-50 backdrop-blur bg-white/70 ${elevated ? "shadow-sm border-b border-neutral-200/60" : ""}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
            <img src="/logo.svg" alt="Jean Yves Logo" className="inline-block h-6 w-6  bg-white" aria-hidden="true" />
            <span className="text-[15px] uppercase">Jean Yves</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(({ href, label }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm transition-colors ${active ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
                >
                  <span className="relative inline-block">
                    {label}
                    {active && <span className="absolute inset-x-0 -bottom-1 h-[1px] bg-neutral-900" aria-hidden />}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/favorites" aria-label="Favorites" className="p-2 rounded-full hover:bg-neutral-100">
              <HeartIcon className="h-5 w-5 text-neutral-700" />
            </Link>

            {accountSlot}

            <Link href="/cart" aria-label="Cart" className="relative p-2 rounded-full hover:bg-neutral-100">
              <ShoppingBagIcon className="h-5 w-5 text-neutral-700" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-[5px] rounded-full bg-neutral-900 text-white text-[11px] leading-[18px] text-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <button className="md:hidden p-2 rounded-full hover:bg-neutral-100" aria-label="Menu" onClick={() => setOpen(v => !v)}>
              {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <div className={`md:hidden overflow-hidden border-t border-neutral-200/60 transition-[max-height] duration-200 ease-out ${open ? "max-h-80" : "max-h-0"}`}>
        <nav className="px-4 sm:px-6 lg:px-8 py-2">
          <ul className="flex flex-col">
            {NAV.map(({ href, label }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <li key={href}>
                  <Link href={href} className={`block py-3 text-sm ${active ? "text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
