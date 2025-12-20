// File: src/app/account/profile/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@acme/core/contexts/UserContext";

type Address = {
  id: string;
  label?: string | null;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: string;
};

const SITE = "JEANYVES";

function noStoreHeaders() {
  return { "x-storefront": SITE, "Cache-Control": "no-store" };
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, isLoggedIn } = useUser();

  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveOk, setSaveOk] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
  });

  // Addresses
  const [addr, setAddr] = React.useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = React.useState(false);
  const [addrErr, setAddrErr] = React.useState<string | null>(null);

  const [addrFormOpen, setAddrFormOpen] = React.useState(false);
  const [addrBusy, setAddrBusy] = React.useState(false);
  const [addrForm, setAddrForm] = React.useState({
    label: "Home",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  React.useEffect(() => {
    if (!user?.id) return;
    setForm((s) => ({
      ...s,
      name: user.name ?? "",
      email: user.email ?? "",
    }));
  }, [user?.id]);

  async function loadAddresses() {
    if (!user?.id) return;
    setAddrLoading(true);
    setAddrErr(null);
    try {
      const res = await fetch("/api/addresses", {
        method: "GET",
        headers: noStoreHeaders(),
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load addresses");
      setAddr(Array.isArray(json?.addresses) ? json.addresses : []);
    } catch (e: any) {
      setAddrErr(e?.message ?? "Failed to load addresses");
      setAddr([]);
    } finally {
      setAddrLoading(false);
    }
  }

  React.useEffect(() => {
    if (!isLoggedIn || !user?.id) return;
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.id]);

  async function saveProfile() {
    setSaveBusy(true);
    setSaveError(null);
    setSaveOk(null);

    try {
      const payload: any = {
        name: form.name?.trim(),
        email: form.email?.trim(),
      };

      // only send password fields if user typed them
      if (form.currentPassword || form.newPassword) {
        payload.password = form.currentPassword; // your backend expects password to authorize changes
        payload.newPassword = form.newPassword;  // if your route supports it
      }

      // NOTE: your existing route appears to be /auth/profile (not /api/auth/profile)
      const res = await fetch("/auth/profile", {
        method: "PATCH", // if your route uses POST, change to "POST"
        headers: { "Content-Type": "application/json", ...noStoreHeaders() },
        body: JSON.stringify(payload),
      });

      const out = await res.json().catch(() => null);
      if (!res.ok) throw new Error(out?.error || out?.message || "Failed to update profile");

      setSaveOk("Profile updated.");
      setForm((s) => ({ ...s, currentPassword: "", newPassword: "" }));

      // refresh any server components / navbar user menu etc.
      router.refresh();
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to update profile");
    } finally {
      setSaveBusy(false);
    }
  }

  async function createAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddrBusy(true);
    setAddrErr(null);

    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...noStoreHeaders() },
        body: JSON.stringify(addrForm),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to save address");

      setAddrFormOpen(false);
      setAddrForm({
        label: "Home",
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
      });
      await loadAddresses();
    } catch (e: any) {
      setAddrErr(e?.message ?? "Failed to save address");
    } finally {
      setAddrBusy(false);
    }
  }

  async function deleteAddress(id: string) {
    if (!id) return;
    setAddrBusy(true);
    setAddrErr(null);
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "DELETE",
        headers: noStoreHeaders(),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to delete address");
      setAddr((cur) => cur.filter((a) => a.id !== id));
    } catch (e: any) {
      setAddrErr(e?.message ?? "Failed to delete address");
    } finally {
      setAddrBusy(false);
    }
  }

  // ---------- UI ----------
  if (loading) {
    return <div className="mx-auto max-w-5xl p-6"><div className="h-56 animate-pulse rounded-2xl bg-neutral-100" /></div>;
  }

  if (!isLoggedIn || !user?.id) {
    return (
      <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">My profile</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Please sign in to view your profile, addresses, and orders.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/auth/login"
              className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">My profile</h1>
          <p className="mt-1 text-sm text-neutral-600">Manage your account, addresses, and orders.</p>
        </div>
        <Link
          href="/account/orders"
          className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          View orders
        </Link>
      </div>

      {/* Alerts */}
      {saveError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
      )}
      {saveOk && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{saveOk}</div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Profile */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-medium tracking-wide text-neutral-700">Account details</h2>

          <div className="mt-4 flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
              <Image
                src={user.image || user.avatarUrl || "/placeholder.png"}
                alt={user.name || "Avatar"}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-900">{user.name || "—"}</div>
              <div className="text-xs text-neutral-600">{user.email}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-neutral-600">Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-neutral-600">Email</span>
              <input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              />
            </label>

            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-xs font-medium text-neutral-700">Change password (optional)</div>
              <div className="mt-2 grid gap-2">
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setForm((s) => ({ ...s, currentPassword: e.target.value }))}
                  placeholder="Current password"
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm((s) => ({ ...s, newPassword: e.target.value }))}
                  placeholder="New password"
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
                <p className="text-[11px] text-neutral-500">
                  If your backend only requires password when changing email/name, keep these empty unless needed.
                </p>
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={saveBusy}
              className="mt-2 rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {saveBusy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Addresses */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium tracking-wide text-neutral-700">Saved addresses</h2>
            <button
              onClick={() => setAddrFormOpen((v) => !v)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
            >
              {addrFormOpen ? "Close" : "Add address"}
            </button>
          </div>

          {addrErr && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{addrErr}</div>
          )}

          {addrFormOpen && (
            <form onSubmit={createAddress} className="mt-4 grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={addrForm.label}
                  onChange={(e) => setAddrForm((s) => ({ ...s, label: e.target.value }))}
                  placeholder="Label (Home, Studio...)"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
                <input
                  value={addrForm.country}
                  onChange={(e) => setAddrForm((s) => ({ ...s, country: e.target.value }))}
                  placeholder="Country (US)"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>

              <input
                value={addrForm.street}
                onChange={(e) => setAddrForm((s) => ({ ...s, street: e.target.value }))}
                placeholder="Street"
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={addrForm.city}
                  onChange={(e) => setAddrForm((s) => ({ ...s, city: e.target.value }))}
                  placeholder="City"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
                <input
                  value={addrForm.state}
                  onChange={(e) => setAddrForm((s) => ({ ...s, state: e.target.value }))}
                  placeholder="State"
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>

              <input
                value={addrForm.postalCode}
                onChange={(e) => setAddrForm((s) => ({ ...s, postalCode: e.target.value }))}
                placeholder="Postal code"
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={addrBusy}
                  className="rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {addrBusy ? "Saving…" : "Save address"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddrFormOpen(false)}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-4">
            {addrLoading ? (
              <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />
            ) : addr.length === 0 ? (
              <p className="text-sm text-neutral-600">No saved addresses yet.</p>
            ) : (
              <div className="space-y-3">
                {addr.map((a) => (
                  <div key={a.id} className="rounded-xl border border-neutral-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-neutral-900">{a.label || "Address"}</div>
                        <div className="mt-1 text-sm text-neutral-700">
                          {a.street}
                          <br />
                          {a.city}, {a.state} {a.postalCode}
                          <br />
                          {a.country}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteAddress(a.id)}
                        disabled={addrBusy}
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-[11px] text-neutral-500">
            Tip: you can auto-save the shipping address after a successful checkout. This page is where users can manage it.
          </p>
        </div>
      </div>
    </section>
  );
}
