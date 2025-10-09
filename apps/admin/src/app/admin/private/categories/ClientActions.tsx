"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export default function ClientActions({ row }: { row: any }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const router = useRouter();

  async function update() {
    const res = await fetch(`/api/admin/categories/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return alert("Update failed");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    const res = await fetch(`/api/admin/categories/${row.id}`, { method: "DELETE" });
    if (!res.ok) return alert("Delete failed (FK in use?)");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <>
          <input
            className="rounded-xl border px-2 py-1 text-sm w-40"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="rounded-xl border px-2 py-1 text-sm" onClick={update}>Save</button>
          <button className="rounded-xl border px-2 py-1 text-sm" onClick={() => { setEditing(false); setName(row.name); }}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button className="rounded-xl border px-2 py-1 text-sm" onClick={() => setEditing(true)}>Edit</button>
          <ConfirmButton onConfirm={remove} className="text-red-600 border-red-600">Delete</ConfirmButton>
        </>
      )}
    </div>
  );
}
