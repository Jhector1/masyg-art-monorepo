import ProfilePageClient from "./ProfilePageClient";

type Tab = "Profile" | "Collections" | "Orders" | "Settings";

function fromSlug(slug?: string): Tab {
  switch ((slug || "").toLowerCase()) {
    case "collections":
      return "Collections";
    case "orders":
      return "Orders";
    case "settings":
      return "Settings";
    default:
      return "Profile";
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab: string }>;
}) {
    const { tab } = await searchParams;

  const initialTab = fromSlug(tab);
  return <ProfilePageClient initialTab={initialTab} />;
}
