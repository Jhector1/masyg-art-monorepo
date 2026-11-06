/** Physical customizations are merchant-provided, server-priced VARIANTS, never browser surcharges. */
export const FRAME_CHOICES = ["Unframed", "Black wood", "White wood", "Natural oak", "Walnut", "Black metal"] as const;
export const GLAZING_CHOICES = ["None", "Clear acrylic", "UV acrylic", "Non-glare glass"] as const;

export function optionValue(attributes: unknown, key: "frame"|"glazing"): string {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return "";
  const value = (attributes as Record<string,unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}
export function normalizedOption(attributes: unknown, key: "frame"|"glazing"): string {
  const value=optionValue(attributes,key).toLowerCase();
  return !value || value === "unframed" || value === "none" ? "none" : value;
}
export function physicalOptionsAllowed(
  _offers: {offersFraming?:boolean; offersGlazing?:boolean},
  fulfillment: string, attributes: unknown,
): boolean {
  const frame=normalizedOption(attributes,"frame");
  const glazing=normalizedOption(attributes,"glazing");
  if (fulfillment !== "PHYSICAL") return frame === "none" && glazing === "none";
  // A complete physical SKU may include a fixed frame or glass without
  // offering a choice. Opt-in only controls whether BUYERS see selectors.
  // The variant's own inventory and server price still govern checkout.
  return true;
}
export function physicalOptionsReady(
  variants: readonly {active:boolean;fulfillment:string;attributes:unknown}[],
  key:"frame"|"glazing",
): boolean {
  const choices=new Set(variants.filter(v=>v.active && v.fulfillment==="PHYSICAL")
    .map(v=>normalizedOption(v.attributes,key)));
  return choices.size >= 2 && [...choices].some(value=>value!=="none");
}
