"use client";

import { useState, useMemo } from "react";
import { PencilIcon, CheckIcon, XMarkIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import type { UserProfile } from "./types";

export default function ProfileInfo({
  user,
  onUpdated,
}: {
  user: Partial<UserProfile> & { location?: string };
  onUpdated?: (partial?: Partial<UserProfile> | UserProfile) => Promise<void> | void;
}) {
  const { update } = useSession(); // refresh client session after profile changes
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: user.name || "", email: user.email || "" });
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => formData.name !== (user.name || "") || formData.email !== (user.email || ""),
    [formData, user.name, user.email]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submitUpdate = async () => {
    if (!password) return;
    try {
      setSaving(true);
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      toast.success("Profile updated");
      setEditMode(false);
      setPassword("");

      // Update next-auth session (so name/email in session reflect new values)
      await update();

      // Optimistic UI + refetch through parent
      await onUpdated?.(data.user ?? { ...formData });
    } catch (err: any) {
      toast.error(err.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: user.name || "", email: user.email || "" });
    setPassword("");
    setEditMode(false);
  };

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Profile Info</h3>

      <div className="relative bg-white/80 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-6" aria-busy={saving}>
        <div className="grid grid-cols-1 gap-5 max-w-2xl">
          {/* Username */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-gray-700 shrink-0 w-36">Username</label>
            {editMode ? (
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={saving}
                className="w-full rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-sm text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              />
            ) : (
              <span className="text-gray-700">{user.name}</span>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-gray-700 shrink-0 w-36">Email</label>
            {editMode ? (
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={saving}
                className="w-full rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-sm text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              />
            ) : (
              <span className="text-gray-700">{user.email}</span>
            )}
          </div>

          {/* Current password (only in edit mode) */}
          {editMode && (
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-gray-700 shrink-0 w-36">Current password</label>
              <div className="relative w-full">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Required to save changes"
                  className="w-full rounded-xl border border-gray-200 bg-white/90 px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute inset-y-0 right-2.5 my-auto p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  disabled={saving}
                >
                  {showPw ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            {editMode ? (
              <>
                <button
                  onClick={submitUpdate}
                  disabled={saving || !dirty || !password}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <XMarkIcon className="h-4 w-4" /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <PencilIcon className="h-4 w-4" /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
