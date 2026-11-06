import { notFound } from "next/navigation";
import { merchantWorkspace, type MerchantSearch } from "@/lib/merchant-workspace";
import { listMerchantStaff } from "@acme/core/lib/merchant-staff";
import { StoreSelect } from "@/components/merchant/shared";
import StaffManager from "@/components/merchant/StaffManager";
import StaffInviteManager from "@/components/merchant/StaffInviteManager";
import { listMerchantInvitations } from "@acme/core/lib/merchant-invitations";
export const dynamic = "force-dynamic";
export default async function Staff({ searchParams }: { searchParams: MerchantSearch }) {
  const { userId, stores, store } = await merchantWorkspace(searchParams);
  if (!store) return <p>No accessible storefronts.</p>;
  if (store.role === "MEMBER") notFound();
  const members = await listMerchantStaff(userId,store.organizationId);
  const invites = store.role === "OWNER" ? await listMerchantInvitations(userId,store.organizationId) : [];
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Staff & access</h1><p className="mt-1 text-sm text-zinc-500">Manage organization membership independently of customer accounts. Only owners can change roles.</p></div><StoreSelect stores={stores} selected={store.storeId} pathname="/merchant/staff"/><StaffManager currentUserId={userId} store={store} stores={stores} rows={members}/>
    {store.role === "OWNER" && <StaffInviteManager store={store} stores={stores} rows={invites}/>}</div>;
}
