import Link from "next/link";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { StoreSelect } from "@/components/merchant/shared";
import StoreIdentityPanel from "@/components/merchant/StoreIdentityPanel";
import StoreShippingSettings from "@/components/merchant/StoreShippingSettings";
import { storeQuery } from "@/lib/merchant-navigation";

export const dynamic = "force-dynamic";

/** Selection is checked against the signed-in merchant's accessible stores. */
export default async function StorefrontSettings({ searchParams }: { searchParams: MerchantSearch }) {
  const { stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts. Create one in Merchant onboarding first.</p>;
  return <div className="space-y-6">
    <div className="space-y-1">
      <Link href={`/merchant/storefronts${storeQuery(store.storeId)}`} className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline">Back to storefronts</Link>
      <h1 className="text-2xl font-bold">Store settings</h1>
      <p className="text-sm text-zinc-500">Copy the selected storefront's identity for local preview configuration.</p>
    </div>
    <StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/storefronts/settings"/>
    <StoreIdentityPanel store={store}/>
    <StoreShippingSettings organizationId={store.organizationId} storeId={store.storeId}/>
  </div>;
}
