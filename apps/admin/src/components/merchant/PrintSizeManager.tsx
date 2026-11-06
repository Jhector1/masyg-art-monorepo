'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FRAME_CHOICES, GLAZING_CHOICES } from '@acme/core/lib/physical-options';
import { validatePrintSizeDrafts, type PrintDimensionUnit } from '@acme/core/lib/catalog-option-authoring';
import { existingPrintConfigurationKey, validatePrintBatch } from '@acme/core/lib/print-size-batch-policy';
import { callMerchant, field, primary, secondary, toMinor } from './shared';

type SizeRow = {
  id: number; width: string; height: string; unit: PrintDimensionUnit; price: string;
  regularPrice: string; sku: string; stock: string;
};
type Snapshot = {
  offerings: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  variants: { id: string; name: string; sku: string | null; priceMinor: number; active: boolean; attributes: unknown }[];
  variantsCappedAt: number;
};
const sample: SizeRow[] = [
  { id: 1, width: '8', height: '10', unit: 'in', price: '25.00', regularPrice: '', sku: '', stock: '0' },
  { id: 2, width: '11', height: '14', unit: 'in', price: '40.00', regularPrice: '', sku: '', stock: '0' },
  { id: 3, width: '16', height: '20', unit: 'in', price: '65.00', regularPrice: '', sku: '', stock: '0' },
];
const newRow = (id: number): SizeRow => ({ id, width: '', height: '', unit: 'in', price: '', regularPrice: '', sku: '', stock: '0' });
const stockValue = (value: string): number | null => /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const asError = (e: unknown) => e instanceof Error ? e.message : 'Unable to save print sizes';

/** Print sizes are created together in a serializable transaction: variants, SKUs, offering, and on-hand stock. */
export default function PrintSizeManager({ organizationId, storeId, productId, canEdit }: {
  organizationId: string; storeId: string; productId: string; canEdit: boolean;
}) {
  const router = useRouter();
  const base = `/api/merchant/organizations/${organizationId}/products/${productId}/print-sizes`;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SizeRow[]>(sample);
  const [nextId, setNextId] = useState(4);
  const [saved, setSaved] = useState<number[]>([]);
  const [offeringId, setOfferingId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [material, setMaterial] = useState('Fine art paper');
  const [finish, setFinish] = useState('Matte');
  const [frame, setFrame] = useState('Unframed');
  const [glazing, setGlazing] = useState('None');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`${base}?storeId=${encodeURIComponent(storeId)}`, { credentials: 'same-origin', cache: 'no-store' });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : `Unable to load print choices (${response.status})`);
        const data = body as Snapshot;
        if (!Array.isArray(data.offerings) || !Array.isArray(data.locations) || !Array.isArray(data.variants)) throw new Error('Invalid print options response');
        if (active) { setSnapshot(data); setOfferingId(prev => data.offerings.some(item => item.id === prev) ? prev : data.offerings[0]?.id ?? ''); setLocationId(prev => data.locations.some(item => item.id === prev) ? prev : data.locations[0]?.id ?? ''); }
      } catch (e) { if (active) setError(asError(e)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [base, storeId]);

  const pending = rows.filter(row => !saved.includes(row.id));
  const drafts = pending.map(row => ({
    width: Number(row.width), height: Number(row.height), unit: row.unit,
    priceMinor: toMinor(row.price) ?? -1, sku: row.sku, stock: stockValue(row.stock) ?? -1,
  }));
  const check = validatePrintSizeDrafts(drafts);
  const existing = new Set((snapshot?.variants ?? []).map(v => existingPrintConfigurationKey(v.attributes)).filter((key): key is string => key !== null));
  const options = { material, finish, frame, glazing };
  const errors = [
    ...(check.ok ? validatePrintBatch(drafts, existing, options) : check.errors.map(e => e.message)),
    ...pending.flatMap((row, i) => row.regularPrice.trim() && (toMinor(row.regularPrice) ?? 0) <= (drafts[i]?.priceMinor ?? 0) ? [`Size ${i + 1}: regular price must exceed selling price`] : []),
    ...(pending.some(row => (stockValue(row.stock) ?? 0) > 0) && !locationId ? ['Select an inventory location for positive stock'] : []),
  ];
  const valid = !!snapshot && !!offeringId && pending.length > 0 && !errors.length && !uncertain;

  function update(id: number, key: keyof SizeRow, value: string) {
    setRows(previous => previous.map(row => row.id === id ? { ...row, [key]: value } : row));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy || !valid) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = {
        storeId, offeringId, ...(locationId ? { locationId } : {}), currency: 'USD',
        ...options,
        sizes: pending.map((row, index) => ({
          ...drafts[index], sku: row.sku.trim(),
          ...(row.regularPrice.trim() ? { compareAtMinor: toMinor(row.regularPrice) } : {}),
        })),
      };
      await callMerchant(base, 'POST', payload);
      setSaved(previous => [...previous, ...pending.map(row => row.id)]);
      setMessage(`${pending.length} print size${pending.length === 1 ? '' : 's'} created as inactive editions with their SKUs and initial stock. Review and activate under Editions when ready.`);
      // A successful commit must remain successful even if this optional refresh fails.
      try {
        const response = await fetch(`${base}?storeId=${encodeURIComponent(storeId)}`, { credentials: 'same-origin', cache: 'no-store' });
        if (response.ok) {
          const body: unknown = await response.json();
          const updated = body as Snapshot;
          if (Array.isArray(updated.variants)) setSnapshot(updated);
        }
      } catch { /* The committed variants remain authoritative; the page refresh is best-effort. */ }
      router.refresh();
    } catch (e) {
      setUncertain(true);
      setError(`${asError(e)}. If the network timed out after saving, check Editions and refresh this page before attempting another batch. No automatic retry was made.`);
    } finally { setBusy(false); }
  }

  return <section className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Multiple print sizes">
    <div><h3 className="text-lg font-semibold">Multiple print sizes</h3>
      <p className="mt-1 text-sm text-zinc-600">Save several sizes for the same artwork in <strong>one atomic operation</strong>. Each size gets its own price, SKU, tracked stock and Print offering association.</p>
      <p className="mt-2 text-xs text-amber-800">Sizes are saved inactive. The existing Editions tab controls activation and pricing changes; Inventory controls subsequent stock adjustments. Checkout is unchanged.</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {loading && <p className="text-sm text-zinc-500">Loading print offerings and stock locations…</p>}
    {snapshot && <form className="space-y-4" onSubmit={e => void submit(e)}>
      {!snapshot.offerings.length && <p role="alert" className="text-sm text-amber-800">No Print offering exists. Open “Ways to sell” and create an Art print / reproduction offering first.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Print offering<select className={field} value={offeringId} disabled={!canEdit || busy} onChange={e => setOfferingId(e.target.value)}><option value="">Choose print offering</option>{snapshot.offerings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-medium">Stock location (for quantities greater than zero)<select className={field} value={locationId} disabled={!canEdit || busy} onChange={e => setLocationId(e.target.value)}><option value="">No location selected</option>{snapshot.locations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      {!snapshot.locations.length && <p className="text-xs text-amber-800">To set initial stock above zero, create an inventory location on the Inventory page first.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Paper / material<input className={field} maxLength={100} value={material} disabled={!canEdit || busy} onChange={e => setMaterial(e.target.value)}/></label>
        <label className="text-sm font-medium">Finish<input className={field} maxLength={100} value={finish} disabled={!canEdit || busy} onChange={e => setFinish(e.target.value)}/></label>
        <label className="text-sm font-medium">Frame<select className={field} value={frame} disabled={!canEdit || busy} onChange={e => setFrame(e.target.value)}>{FRAME_CHOICES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-medium">Glazing<select className={field} value={glazing} disabled={!canEdit || busy} onChange={e => setGlazing(e.target.value)}>{GLAZING_CHOICES.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="space-y-3">{rows.map((row, index) => {
        const complete = saved.includes(row.id);
        const locked = !canEdit || busy || complete;
        return <div key={row.id} className="rounded-xl border border-zinc-200 p-3">
          <div className="mb-2 flex justify-between"><strong className="text-sm">Print size {index + 1}</strong>{complete && <span className="text-xs font-semibold text-emerald-700">Created</span>}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium">Width<input className={field} type="number" inputMode="decimal" min="0.001" max="10000" step="0.001" value={row.width} disabled={locked} onChange={e => update(row.id, 'width', e.target.value)}/></label>
            <label className="text-xs font-medium">Height<input className={field} type="number" inputMode="decimal" min="0.001" max="10000" step="0.001" value={row.height} disabled={locked} onChange={e => update(row.id, 'height', e.target.value)}/></label>
            <label className="text-xs font-medium">Unit<select className={field} value={row.unit} disabled={locked} onChange={e => update(row.id, 'unit', e.target.value)}><option value="in">inches</option><option value="cm">centimeters</option></select></label>
            <label className="text-xs font-medium">Selling price (USD)<input className={field} inputMode="decimal" value={row.price} disabled={locked} onChange={e => update(row.id, 'price', e.target.value)}/></label>
            <label className="text-xs font-medium">SKU (unique in organization)<input className={field} maxLength={100} placeholder="PRINT-8X10" value={row.sku} disabled={locked} onChange={e => update(row.id, 'sku', e.target.value)}/></label>
            <label className="text-xs font-medium">Initial stock (on hand)<input className={field} inputMode="numeric" value={row.stock} disabled={locked} onChange={e => update(row.id, 'stock', e.target.value)}/></label>
            <label className="text-xs font-medium">Regular price (optional)<input className={field} inputMode="decimal" value={row.regularPrice} disabled={locked} onChange={e => update(row.id, 'regularPrice', e.target.value)}/></label>
            {canEdit && <div className="self-end"><button type="button" className={secondary} disabled={busy} onClick={() => setRows(previous => previous.filter(value => value.id !== row.id))}>Remove row</button></div>}
          </div>
        </div>;
      })}</div>
      {pending.length > 0 && !!errors.length && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{errors.slice(0, 5).join('. ')}</p>}
      <div className="flex flex-wrap gap-2">
        {canEdit && <button type="button" className={secondary} disabled={busy || uncertain || pending.length >= 40} onClick={() => { setRows(previous => [...previous, newRow(nextId)]); setNextId(current => current + 1); }}>+ Add size</button>}
        {canEdit && <button className={primary} type="submit" disabled={!valid || busy}>{busy ? 'Saving all sizes…' : `Create ${pending.length} print size${pending.length === 1 ? '' : 's'}`}</button>}
      </div>
      <p className="text-xs text-zinc-500">Maximum 40 sizes per transaction, with no limit on total sizes across future batches. Existing configurations and SKU collisions are rejected on the server.</p>
    </form>}
  </section>;
}
