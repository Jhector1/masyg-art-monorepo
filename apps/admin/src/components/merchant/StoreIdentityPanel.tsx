"use client";

import { useState } from "react";
import type { StoreChoice } from "@/lib/merchant-workspace";
import { secondary, Status } from "./shared";

/** Store IDs come only from the server-authorized merchant workspace.
 * These are identifiers, not authentication secrets. Copying never mutates tenant data.
 */
export default function StoreIdentityPanel({ store }: { store: StoreChoice }) {
  const [message, setMessage] = useState("");
  const env = [
    `ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID=${store.organizationId}`,
    `ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID=${store.storeId}`,
  ].join("\n");

  async function copy(value: string, label: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Automatic copying is unavailable. Select the text and copy it manually.");
    }
  }

  return <section aria-labelledby="store-identity-heading" className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center gap-3">
      <h2 id="store-identity-heading" className="text-xl font-semibold">Store identity</h2>
      <Status value={store.published ? "PUBLISHED" : "DRAFT"}/>
    </div>
    <p className="text-sm leading-6 text-zinc-600">
      These are the IDs for <strong>{store.organizationName} / {store.storeName}</strong>.
      They are read-only identifiers from your authorized merchant workspace, not API credentials.
    </p>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Organization ID</span>
        <div className="flex min-w-0 gap-2">
          <input aria-label="Organization ID" readOnly value={store.organizationId} onFocus={event => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-sm text-zinc-800"/>
          <button type="button" className={secondary} onClick={() => void copy(store.organizationId, "Organization ID")}>Copy</button>
        </div>
      </label>
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Store ID</span>
        <div className="flex min-w-0 gap-2">
          <input aria-label="Store ID" readOnly value={store.storeId} onFocus={event => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-sm text-zinc-800"/>
          <button type="button" className={secondary} onClick={() => void copy(store.storeId, "Store ID")}>Copy</button>
        </div>
      </label>
    </div>
    <div className="space-y-3 border-t border-zinc-100 pt-5">
      <div>
        <h3 className="font-semibold">Local storefront preview</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          For the ZileDigital development storefront, copy these lines into <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">apps/ziledigital/.env.local</code>,
          then restart its development server. If you are configuring JeanYvesArt instead, put the same keys with that storefront's IDs in its own <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">apps/jeanyvesart/.env.local</code>.
        </p>
      </div>
      <pre aria-label="Local storefront environment variables" className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{env}</pre>
      <button type="button" className={secondary} onClick={() => void copy(env, "Local preview configuration")}>Copy preview configuration</button>
      <p className="text-xs leading-5 text-zinc-500">This local-only configuration is not public domain routing. The storefront must be published; production traffic continues to use verified domains.</p>
    </div>
    <p role="status" aria-live="polite" className="min-h-5 text-sm text-zinc-600">{message}</p>
  </section>;
}
