"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  Transition,
} from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

type Item = { label: string; href: string };

export default function MobileDrawer({
  open,
  onClose,
  items,
  title = "Menu",
  isLoggedIn,
  userName,
  onSignIn,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  items: Item[];
  title?: string;
  isLoggedIn: boolean;
  userName?: string;
  onSignIn?: () => void;
  onSignOut?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();
  useEffect(() => setMounted(true), []);

  // Lock scroll + Esc to close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Close after navigation
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!mounted) return null;

  const drawerTransition: Transition = prefersReduced
    ? { type: "tween", duration: 0.25 }
    : { type: "spring", stiffness: 260, damping: 24, mass: 1 };

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <div className="fixed inset-0 z-[9999] pointer-events-auto">
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
            className="absolute left-0 top-0 h-[100dvh] w-72 bg-white border-r border-gray-200 shadow-2xl flex flex-col"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={drawerTransition}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-900">{title}</span>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-50 active:scale-95"
                aria-label="Close menu"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Links */}
            <nav className="px-2 py-3 space-y-1 overflow-y-auto">
              {items.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ x: -12, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.02 * i, duration: 0.18 }}
                >
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="block rounded-xl px-3 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-base"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Account */}
            <div className="mt-auto border-t border-gray-100 p-3">
              {isLoggedIn ? (
                <div className="space-y-2">
                  <div className="px-3 py-2 text-sm text-gray-600">
                    Signed in as{" "}
                    <span className="font-medium text-gray-900">
                      {userName || "User"}
                    </span>
                  </div>
                  <Link
                    href="/profile"
                    onClick={onClose}
                    className="block rounded-xl px-3 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-base"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      onClose();
                      onSignOut?.();
                    }}
                    className="w-full rounded-xl px-3 py-3 text-left text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-base"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    setTimeout(() => onSignIn?.(), 250);
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:border-gray-300 active:scale-95 transition"
                >
                  Sign in
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
