"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CameraIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import type { UserProfile } from "./types";

type HeaderUser = {
  name?: string | null;
  email?: string | null;
  location?: string;
  memberSince?: string | Date;
  updatedAt?: string | Date;
  avatarUrl?: string | null;
};

type Props = {
  user?: HeaderUser;                 
  onAvatarUpdated?: (partial?: Partial<UserProfile> | UserProfile) => Promise<void> | void;
};

const MAX_BYTES = 5 * 1024 * 1024;

export default function ProfileHeader({ user, onAvatarUpdated }: Props) {
  const u: HeaderUser = user ?? {};
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localBust, setLocalBust] = useState<number>(0); // local cache-buster for instant flip

  const handlePick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      e.currentTarget.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large. Max 5MB.");
      e.currentTarget.value = "";
      return;
    }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/auth/profile", { method: "PATCH", body: fd });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        if (res.status === 413) throw new Error("Image too large. Max 5MB.");
        throw new Error(data?.error || "Upload failed");
      }
      toast.success("Avatar updated");

      // Instant local flip even if server forgets to bump updatedAt
      setLocalBust(Date.now());

      // Optimistic update if server returned updated user; then refetch in parent
      await onAvatarUpdated?.(data?.user);
    } catch (err: any) {
      toast.error(err?.message || "Error uploading avatar");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Avatar URL with transformation + cache-buster (local > updatedAt > none)
// Pick the best raw src first
const raw =
  u?.avatarUrl ??
  (u as any)?.image ?? // NextAuth session image if you pass it down
  null;

// Compute a stable cache-bust from updatedAt or local bust
const bust =
  localBust || (u?.updatedAt ? Date.parse(String(u.updatedAt)) : 0);

// Transform per host
function transformAvatar(url: string): string {
  // Cloudinary: inject/replace the transform segment after /upload/
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    // Replace existing transform segment if present
    return url.replace(
      /\/upload\/(?:[^/]+\/)?/,
      "/upload/f_auto,q_auto,w_160,h_160,c_thumb,g_face/"
    );
  }

  // Google profile photos: normalize size to 160 square
  if (/^https?:\/\/lh\d\.googleusercontent\.com\//.test(url)) {
    // Replace any '=sXX-c' with '=s160-c' (keeps crop square)
    return url.replace(/=s\d+-c/, "=s160-c");
  }

  // Unknown host: leave as-is
  return url;
}

const baseSrc = raw ? transformAvatar(raw) : "/images/default_avatar.png";

// Append cache bust only if we have one
const avatarSrc =
  bust && baseSrc
    ? `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}t=${bust}`
    : baseSrc;

  return (
    <header className="w-full">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 sm:p-8" aria-busy={uploading}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`relative h-20 w-20 shrink-0 ${uploading ? "animate-pulse" : ""}`}>
              <Image
                src={avatarSrc}
                alt={u?.name ?? u?.email ?? "User"}
                fill
                className={`rounded-full object-cover ring-4 ring-white shadow-sm ${uploading ? "opacity-60" : ""}`}
              />
              <button
                type="button"
                onClick={handlePick}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 bg-white/90 hover:bg-white rounded-full p-1.5 shadow border border-gray-200 disabled:opacity-50"
                aria-label="Change avatar"
                title="Change avatar"
              >
                <CameraIcon className="h-5 w-5" />
              </button>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">{u?.name ?? "Your Profile"}</h2>
              {u?.email && <p className="text-gray-600 text-sm">{u.email}</p>}
              {/* {u?.location && <p className="text-gray-500 text-sm">{u.location}</p>} */}
            </div>
          </div>

          {u?.memberSince && (
            <div className="text-sm text-gray-600">
              <p>
                <span className="font-semibold text-gray-900">Member since</span>{" "}
                {new Date(u.memberSince).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
