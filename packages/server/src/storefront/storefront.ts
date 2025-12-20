export type Storefront = "ZILEDIGITAL" | "JEANYVES";

// ../storefront/storefront.ts
export function cartOwnerOr(userId?: string | null, guestId?: string | null) {
  const OR: any[] = [];
  if (userId) OR.push({ userId });
  if (guestId) OR.push({ guestId });
  if (!OR.length) throw new Error("Missing userId/guestId");
  return OR;
}


export function assertStorefrontAllows(
  site: Storefront,
  flags: { digital?: boolean; print?: boolean; original?: boolean }
) {
  const d = !!flags.digital;
  const p = !!flags.print;
  const o = !!flags.original;

  if (site === "JEANYVES" && (d || p)) {
    throw new Error("JEANYVES storefront only supports ORIGINAL cart items.");
  }
  if (site === "ZILEDIGITAL" && o) {
    throw new Error("ZILEDIGITAL storefront does not support ORIGINAL cart items.");
  }
}
