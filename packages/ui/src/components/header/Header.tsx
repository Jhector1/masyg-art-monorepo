"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HeartIcon,
  ShoppingCartIcon,
  Bars3Icon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

import { useUser } from "@acme/core/contexts/UserContext";
import { useCart } from "@acme/core/contexts/CartContext";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";
import UserMenu from "./UserMenu";
import UniversalModal from "../modal/UniversalModal";
import AuthenticationForm from "../authenticate/AuthenticationFom";
import { navLinks } from "@acme/core/data/helpers";
import MobileDrawer from "./MobileDrawer";

function Logo() {
  return (
    <Link
      href="/"
      aria-label="Zile Digital Home"
      className="inline-flex items-center gap-2 font-bold tracking-tight"
    >
      <span className="text-xl sm:text-2xl bg-gradient-to-r from-indigo-600 via-sky-600 to-rose-600 bg-clip-text text-transparent">
        Zile
      </span>
      <span className="text-xl sm:text-2xl text-gray-900">Digital</span>
    </Link>
  );
}

interface IconButtonProps {
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count?: number;
  badgeColor?: string;
  ariaLabel: string;
}

function IconButton({
  href,
  Icon,
  count = 0,
  badgeColor = "bg-blue-600",
  ariaLabel,
}: IconButtonProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="relative text-gray-700 hover:text-gray-900 transition-colors duration-200 active:scale-95"
    >
      <Icon className="h-6 w-6" />
      {count > 0 && (
        <span
          className={`absolute -top-2 -right-2 ${badgeColor} text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-sm`}
          aria-live="polite"
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function DesktopNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="hidden md:flex items-center gap-1"
      aria-label="Main navigation"
    >
      {navLinks.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
              active ? "text-gray-900" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {link.label}
            <span
              className={`pointer-events-none absolute left-3 right-3 -bottom-[2px] h-[2px] rounded-full transition-all duration-300 ${
                active
                  ? "bg-gray-900 opacity-100"
                  : "bg-gray-900/60 opacity-0 group-hover:opacity-100"
              }`}
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </nav>
  );
}

export default function Header() {
  // prevent context menu if you want
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const pathname = usePathname();
  const { user, loading, isLoggedIn, logout } = useUser();
  const { cart } = useCart();
  const { favorites } = useFavorites();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const likeCount = favorites.size;

  const cartCount = Array.isArray(cart) ? cart.length : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openAuth = useCallback(() => setModalOpen(true), []);
  const closeAuth = useCallback(() => setModalOpen(false), []);

  if (loading) return null;

  return (
    <header
      role="banner"
      className={`sticky top-0 z-50 transition-shadow duration-300 supports-[backdrop-filter]:bg-white/70 bg-white backdrop-blur-md border-b border-gray-200/60 ${
        scrolled ? "shadow-sm" : "shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.03)]"
      }`}
    >
      {/* Auth Modal */}
      <UniversalModal isOpen={isModalOpen} onClose={closeAuth}>
        <AuthenticationForm
        isGuest={true}
          onSuccess={() => setModalOpen(false)}
          callbackUrl={pathname || "/profile"}
          // handlerAction={location.reload()}
        />
      </UniversalModal>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + burger */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-50 active:scale-95"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-controls="mobile-menu"
              aria-expanded={mobileOpen}
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <Logo />
          </div>

          {/* Center: Desktop nav */}
          <DesktopNav pathname={pathname!} />

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <IconButton
              href="/favorites"
              Icon={HeartIcon}
              count={likeCount}
              badgeColor="bg-rose-600"
              ariaLabel="Favorites"
            />
            <IconButton
              href="/cart"
              Icon={ShoppingCartIcon}
              count={cartCount}
              badgeColor="bg-indigo-600"
              ariaLabel="Cart"
            />

            {isLoggedIn ? (
              <UserMenu
                userName={user?.name || user?.email || "User"}
                // userName={user?.name || "User"}
                userImage={user?.image?? "/placeholder.png"}
                userEmail={user?.email || ""}
                userRole="Pro User"
                menuItems={[
                  { label: "Dashboard", href: "/profile", disable: false },
                  { label: "Settings", href: "/settings", disable: true },
                  { label: "Earnings", href: "/earnings", disable: true },
                ]}
                onSignOut={() => logout()}
              />
            ) : (
              <button
                className="hidden md:inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:border-gray-300 active:scale-95 transition"
                onClick={openAuth}
              >
                <UserCircleIcon className="h-5 w-5" />
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        items={navLinks}
        isLoggedIn={isLoggedIn}
        userName={user?.name || "User"}
        onSignIn={openAuth}
        onSignOut={() => logout()}
      />
    </header>
  );
}
