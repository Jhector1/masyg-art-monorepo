'use client';

import { useState } from 'react';

export default function SyncPrintfulButton() {
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isSyncingOne, setIsSyncingOne] = useState(false);
  const [productId, setProductId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/printful/sync', {
        method: 'POST',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Sync failed with status ${res.status}`);
      }

      const data = await res.json();
      setMessage(`✅ Synced ${data.synced ?? 0} products from Printful.`);
    } catch (err: any) {
      console.error(err);
      setMessage('❌ Error syncing ALL Printful products. Check server logs.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncOne = async () => {
    const id = productId.trim();
    if (!id) {
      setMessage('⚠️ Enter a Printful product ID first.');
      return;
    }

    setIsSyncingOne(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/printful/sync-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncProductId: id }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Sync failed with status ${res.status}`);
      }

      await res.json(); // we don’t really need the body, just success
      setMessage(`✅ Synced Printful product #${id}.`);
    } catch (err: any) {
      console.error(err);
      setMessage(
        `❌ Error syncing Printful product #${id}. Check server logs.`
      );
    } finally {
      setIsSyncingOne(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 items-start">
      {/* Single-product sync */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="Printful product ID (e.g. 403960004)"
          className="w-64 rounded border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleSyncOne}
          disabled={isSyncingOne}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow
            ${
              isSyncingOne
                ? 'bg-gray-300 text-gray-700'
                : 'bg-black text-white hover:bg-gray-800'
            }
            disabled:cursor-not-allowed`}
        >
          {isSyncingOne ? 'Syncing product…' : 'Sync this Printful product'}
        </button>
      </div>

      {/* Bulk sync */}
      <button
        type="button"
        onClick={handleSyncAll}
        disabled={isSyncingAll}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow
          ${
            isSyncingAll
              ? 'bg-gray-300 text-gray-700'
              : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50'
          }
          disabled:cursor-not-allowed`}
      >
        {isSyncingAll ? 'Syncing all…' : 'Sync ALL Printful products'}
      </button>

      {message && <p className="text-xs text-gray-600">{message}</p>}
    </div>
  );
}
