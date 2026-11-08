import Link from "next/link";
import { merchantWorkspace, type MerchantSearch, type StoreChoice } from "@/lib/merchant-workspace";
import { listMerchantProducts } from "@acme/core/lib/tenancy";
import { Status } from "@/components/merchant/shared";
import { storeQuery } from "@/lib/merchant-navigation";

export const dynamic = "force-dynamic";

type Room = { title: string; description: string; href: string; icon: string };

function HouseIcon({ published }: { published: boolean }) {
  return (
    <div className={`grid h-24 w-24 place-items-center rounded-[1.75rem] ${published ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="h-16 w-16">
        <path d="M8 28 32 9l24 19" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 27v27h34V27" fill="currentColor" fillOpacity=".09" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M27 54V37h10v17" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M20 34h5m14 0h5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function StoreCard({ store }: { store: StoreChoice }) {
  return <Link href={`/merchant${storeQuery(store.storeId)}`}
    className="group flex min-h-64 flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-zinc-200 bg-white p-7 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
    <HouseIcon published={store.published} />
    <span className="text-xl font-bold tracking-tight">{store.storeName}</span>
    <span className="text-xs text-zinc-500">{store.organizationName}</span>
    <Status value={store.published ? "PUBLISHED" : "DRAFT"} />
    <span className="mt-1 text-sm font-semibold text-zinc-800 group-hover:underline">Enter storefront →</span>
  </Link>;
}

function RoomCard({ room }: { room: Room }) {
  return <Link href={room.href} className="group flex min-h-40 flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
    <div className="flex items-start justify-between gap-3">
      <span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-2xl" aria-hidden="true">{room.icon}</span>
      <span className="text-zinc-400 transition group-hover:translate-x-1">→</span>
    </div>
    <div><h3 className="mt-4 font-semibold text-zinc-900">{room.title}</h3><p className="mt-1 text-sm text-zinc-500">{room.description}</p></div>
  </Link>;
}

/** /merchant is the authorized storefront gallery; ?store=... enters one store room. */
export default async function MerchantOverview({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  const entered = Boolean((await searchParams)?.store);

  if (!entered) return <div className="mx-auto max-w-6xl space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-700">Merchant workspace</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your storefronts</h1>
        <p className="mt-2 text-sm text-zinc-600">Choose a store to enter its workspace. Each storefront is managed separately.</p>
      </div>
      <Link href="/merchant/onboarding" className="inline-flex rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700">+ Create storefront</Link>
    </div>
    {stores.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{stores.map(item => <StoreCard key={item.storeId} store={item} />)}</div>
      : <section className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white p-10 text-center"><h2 className="text-xl font-semibold">Your first storefront starts here</h2><p className="mt-2 text-sm text-zinc-500">Create a store to start adding physical or digital products.</p><Link href="/merchant/onboarding" className="mt-5 inline-flex rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white">Create a storefront</Link></section>}
    <p className="text-xs text-zinc-500">Only storefronts assigned to your verified merchant account appear here.</p>
  </div>;

  if (!store) return <div className="rounded-2xl border bg-white p-8"><p>No accessible storefronts.</p><Link href="/merchant" className="text-sm underline">Back to storefronts</Link></div>;

  const products = await listMerchantProducts({ userId, organizationId: store.organizationId, storeId: store.storeId });
  const live = products.filter(p => p.status === "PUBLISHED" && p.product.status === "PUBLISHED").length;
  const q = storeQuery(store.storeId);
  const canManageBuyers = store.role !== "MEMBER";
  const rooms: Room[] = [
    { title: "Products", icon: "📦", href: `/merchant/products${q}`, description: "Create, edit and publish products" },
    { title: "Inventory", icon: "🗂️", href: `/merchant/inventory${q}`, description: "Stock and physical availability" },
    ...(canManageBuyers ? [
      { title: "Orders", icon: "🧾", href: `/merchant/orders${q}`, description: "Payments and fulfillment" },
      { title: "Customers", icon: "👥", href: `/merchant/customers${q}`, description: "Buyer history for this store" },
    ] : []),
    { title: "Media", icon: "🖼️", href: `/merchant/media${q}`, description: "Product images and files" },
    { title: "Categories", icon: "🏷️", href: `/merchant/categories${q}`, description: "Organize your catalog" },
    { title: "Store settings", icon: "⚙️", href: `/merchant/storefronts${q}`, description: "Publishing and store details" },
    ...(canManageBuyers ? [{ title: "Team", icon: "🔐", href: `/merchant/staff${q}`, description: "Staff and permissions" }] : []),
  ];

  return <div className="mx-auto max-w-6xl space-y-7">
    <Link href="/merchant" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900">← All storefronts</Link>
    <section className="flex flex-wrap items-center gap-5 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <HouseIcon published={store.published} />
      <div className="min-w-0 flex-1 space-y-2"><p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Store home</p><h1 className="text-3xl font-bold tracking-tight">{store.storeName}</h1>
        <div className="flex flex-wrap items-center gap-3"><Status value={store.published ? "PUBLISHED" : "DRAFT"}/><span className="text-xs text-zinc-500">{store.organizationName} · {store.role.toLowerCase()}</span></div>
      </div>
      {canManageBuyers && <Link href={`/merchant/products/new${q}`} className="inline-flex rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700">+ Add product</Link>}
    </section>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-zinc-500">Recent listings</p><p className="mt-1 text-2xl font-bold">{products.length}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-zinc-500">Published listings</p><p className="mt-1 text-2xl font-bold">{live}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-zinc-500">Product previews</p><p className="mt-1 text-2xl font-bold">{products.reduce((n, p) => n + p.product.media.length, 0)}</p></div>
    </div>
    <div><h2 className="text-xl font-bold">Choose a room</h2><p className="mt-1 text-sm text-zinc-500">Everything in this workspace belongs to {store.storeName}.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rooms.map(room => <RoomCard key={room.title} room={room}/>)}</div>
    <div className="text-right"><Link href="/merchant/security" className="text-sm text-zinc-500 underline underline-offset-4">Account security</Link></div>
  </div>;
}
