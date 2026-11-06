'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { callMerchant, field, primary, secondary } from './shared';
import { validateOptionGroupDrafts } from '@acme/core/lib/catalog-option-authoring';

type OptionGroup = {
  id: string; name: string; key: string;
  values: { id: string; key: string; label: string }[];
  offerings: { offeringId: string; required: boolean }[];
};
type Offering = { id: string; name: string; kind: string };
type Response = { groups: OptionGroup[]; offerings: Offering[] };
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Could not save option choices';
const splitChoices = (value: string): string[] => value.split(/\r?\n|,/gu).map(item => item.trim()).filter(Boolean);

export default function CatalogOptionGroups({ organizationId, storeId, productId, canEdit }: {
  organizationId: string; storeId: string; productId: string; canEdit: boolean;
}) {
  const url = `/api/merchant/organizations/${organizationId}/products/${productId}/option-groups`;
  const [data, setData] = useState<Response | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('Size');
  const [values, setValues] = useState('8 × 10 in\n11 × 14 in\n16 × 20 in');
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [selectedOffering, setSelectedOffering] = useState('');
  const [required, setRequired] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch(`${url}?storeId=${encodeURIComponent(storeId)}`, { credentials: 'same-origin', cache: 'no-store' });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : `Options request failed (${response.status})`);
        const next = body as Response;
        if (!Array.isArray(next.groups) || !Array.isArray(next.offerings)) throw new Error('Unexpected option groups response');
        if (alive) setData(next);
      } catch (err) { if (alive) setError(errorMessage(err)); }
    }
    void load();
    return () => { alive = false; };
  }, [storeId, url]);

  async function save(payload: object, success: string) {
    if (!canEdit || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await callMerchant(url, 'POST', payload);
      const response = await fetch(`${url}?storeId=${encodeURIComponent(storeId)}`, { credentials: 'same-origin', cache: 'no-store' });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Could not reload options');
      const next = body as Response;
      if (!Array.isArray(next.groups) || !Array.isArray(next.offerings)) throw new Error('Unexpected option groups response');
      setData(next); setMessage(success);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const choices = splitChoices(values);
    const valid = validateOptionGroupDrafts([{ name, values: choices }]);
    if (!valid.ok) { setError(valid.errors.map(item => item.message).join(' ')); return; }
    void save({ action: 'create', name: valid.value[0].name, values: valid.value[0].values.map(value => value.label) }, 'Reusable option group created');
  }

  const target = selectedOffering || data?.offerings[0]?.id || '';
  return <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Reusable option groups">
    <div>
      <h3 className="text-lg font-semibold">Reusable product options</h3>
      <p className="mt-1 text-sm text-zinc-600">Create a shared vocabulary for print sizes, paper, frames, colors, clothing sizes, or coffee grind. Groups belong to this organization and can be attached to its offerings.</p>
      <p className="mt-2 text-xs text-amber-800">Authoring metadata only: attaching an option here does not create buyer-selectable combinations or set stock. Purchasable choices still come from existing priced editions.</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {!data && !error && <p role="status" className="text-sm text-zinc-500">Loading reusable option groups…</p>}
    {data && <>
      {data.offerings.length > 0 && <div className="flex flex-wrap items-end gap-3 rounded-xl bg-zinc-50 p-3">
        <label className="min-w-48 flex-1 text-sm font-medium">Attach a group to
          <select className={field} value={target} onChange={event => setSelectedOffering(event.target.value)} disabled={busy}>
            {data.offerings.map(offering => <option key={offering.id} value={offering.id}>{offering.name} ({offering.kind.toLowerCase()})</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} disabled={busy || !canEdit}/> Required (metadata)</label>
      </div>}
      {!data.offerings.length && <p className="text-sm text-amber-800">Create a way to sell first, then attach option groups to it.</p>}
      <div className="grid gap-3">
        {data.groups.map(group => {
          const attached = group.offerings.find(link => link.offeringId === target);
          return <article key={group.id} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h4 className="font-semibold">{group.name}</h4><p className="mt-1 text-sm text-zinc-600">{group.values.map(value => value.label).join(' · ')}</p></div>
              {canEdit && target && <button type="button" className={secondary} disabled={busy}
                onClick={() => void save(attached ? { action: 'unlink', groupId: group.id, offeringId: target } : { action: 'link', groupId: group.id, offeringId: target, required }, attached ? 'Option group detached' : 'Option group attached')}>
                {attached ? 'Detach from selected offering' : 'Attach to selected offering'}
              </button>}
            </div>
            {group.offerings.length > 0 && <p className="mt-2 text-xs text-zinc-500">Used by: {group.offerings.map(link => data.offerings.find(o => o.id === link.offeringId)?.name ?? 'Unknown offering').join(', ')}</p>}
            {canEdit && <form className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3" onSubmit={event => {
              event.preventDefault();
              const additions = splitChoices(extraValues[group.id] ?? '');
              const valid = validateOptionGroupDrafts([{ name: group.name, values: additions }]);
              if (!valid.ok) { setError(valid.errors.map(item => item.message).join(' ')); return; }
              void save({ action: 'addValues', groupId: group.id, values: valid.value[0].values.map(value => value.label) }, 'Choices added');
            }}>
              <label className="min-w-48 flex-1 text-sm font-medium">Add choices (comma or line separated)
                <input className={field} value={extraValues[group.id] ?? ''} onChange={event => setExtraValues(previous => ({ ...previous, [group.id]: event.target.value }))} placeholder="e.g. 24 × 36 in" disabled={busy} />
              </label>
              <button type="submit" className={secondary} disabled={busy || !extraValues[group.id]?.trim()}>Add choices</button>
            </form>}
          </article>;
        })}
        {!data.groups.length && <p className="text-sm text-zinc-500">No option groups yet for this organization.</p>}
      </div>
      {canEdit && <form className="space-y-3 rounded-xl border border-dashed border-zinc-300 p-4" onSubmit={createGroup}>
        <h4 className="font-semibold">Create an option group</h4>
        <label className="block text-sm font-medium">Name
          <input className={field} value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={busy}/>
        </label>
        <label className="block text-sm font-medium">Choices (one per line, or comma separated)
          <textarea className={field} rows={4} value={values} onChange={event => setValues(event.target.value)} disabled={busy}/>
        </label>
        <button type="submit" className={primary} disabled={busy || !name.trim() || !values.trim()}>Save reusable group</button>
      </form>}
    </>}
  </section>;
}
