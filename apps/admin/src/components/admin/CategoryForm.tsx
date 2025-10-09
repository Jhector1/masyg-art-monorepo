"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CategoryForm({
  initial,
}: {
  initial?: { id?: string; name?: string };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(initial?.id);
  const router = useRouter();

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/categories/${initial!.id}` : "/api/admin/categories",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      // ✅ trigger re-render of the server page
      router.refresh();
      if (!isEdit) setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        className="rounded-xl border px-3 py-2 text-sm w-64"
        placeholder="Category name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        className="rounded-xl border px-3 py-2 text-sm hover:bg-muted"
        disabled={busy || name.trim().length < 2}
        onClick={submit}
      >
        {busy ? "Saving..." : isEdit ? "Update" : "Create"}
      </button>
    </div>
  );
}
