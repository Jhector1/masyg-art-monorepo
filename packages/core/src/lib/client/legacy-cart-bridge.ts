import type { CartQuote, PublicStoreProduct, PublicVariant } from "./storefront-commerce";
import type { CartSelectedItem } from "../../types";

/** Read-only compatibility for older header/studio components. The canonical quote
 * is authoritative. These projected fields are never submitted as payment/pricing evidence.
 */
export function projectLegacyCart(quote: CartQuote): CartSelectedItem[] {
  return quote.items.map(line => {
    const formatter = new Intl.NumberFormat("en-US", {style:"currency", currency:line.currency});
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const unitPrice = line.unitPriceMinor / (10 ** fractionDigits);
    const variantReference = {id:line.variantId, name:line.variantName, attributes:{}};
    const partial = {
      id:line.productId,
      productId:line.productId,
      title:line.title,
      cartItemId:line.variantId,
      cartPrice:unitPrice,
      originalPrice:unitPrice,
      cartQuantity:line.quantity,
      digital:line.fulfillment === "DIGITAL" ? variantReference : null,
      print:line.fulfillment === "PHYSICAL" ? variantReference : null,
    };
    // Legacy Prisma ProductListItem included unrelated fields. No fake values
    // are used for authorization, catalog selections, shipping, or checkout.
    return partial as unknown as CartSelectedItem;
  });
}

export function uniquePublishedVariant(
  item: PublicStoreProduct, fulfillment: "DIGITAL" | "PHYSICAL",
): PublicVariant {
  const eligible = item.product.variants.filter(v => v.fulfillment === fulfillment && v.available);
  if (eligible.length !== 1) throw new Error("Select an exact available variant on the product page before adding to cart");
  return eligible[0];
}

/** Legacy option labels do not determine price. Reject them unless the published
 * variant explicitly represents the requested selection in its attributes.
 */
export function assertRepresentedSelection(variant: PublicVariant, args: {
  format:string; size:string|null; material:string|null; frame:string|null; license:string;
}) {
  const raw = variant.attributes;
  const attributes = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string,unknown> : {};
  for (const [key, chosen] of Object.entries(args)) {
    if (!chosen || !chosen.trim()) continue;
    const known = attributes[key];
    if (typeof known !== "string" || known.trim().toLowerCase() !== chosen.trim().toLowerCase())
      throw new Error(`Selected ${key} does not match a verified published variant`);
  }
}

export function assertOrdinaryCartSelection(args: {
  digitalType:string|null; printType:string|null; design?:unknown;
}) {
  if (args.design !== undefined) throw new Error("Customized artwork must use a verified design-snapshot checkout, which is not yet connected");
  if (Boolean(args.digitalType) === Boolean(args.printType))
    throw new Error("Choose one physical or digital variant before adding to cart");
}
