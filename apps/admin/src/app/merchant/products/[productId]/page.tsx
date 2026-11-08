import { merchantWorkspace, merchantListing, type MerchantSearch } from "@/lib/merchant-workspace";
import { StoreSelect } from "@/components/merchant/shared";
import ProductEditor from "@/components/merchant/ProductEditor";
import { listMerchantCategories } from "@acme/core/lib/merchant-categories";
export const dynamic = "force-dynamic";
export default async function EditProduct({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  const { productId } = await params;
  const [listing, categories] = await Promise.all([merchantListing(userId, store, productId), listMerchantCategories(userId, store.organizationId)]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Edit {listing.product.title}</h1><p className="mt-1 text-sm text-zinc-500">{listing.product.variants.some(v => v.fulfillment === "DIGITAL") ? "Manage product details, artwork previews, private downloads, editions and publication." : "Manage product details, photos, physical editions, stock-related options and publication."}</p></div><StoreSelect stores={stores} selected={store.storeId} pathname={`/merchant/products/${productId}`}/><ProductEditor key={`${store.organizationId}:${store.storeId}:${listing.product.id}`} store={store} listing={listing} categories={categories}/></div>;
}
