/** Select only a real, published physical SKU with the same OTHER options. */
import type { PublicVariant } from "./public-catalog-view";
import { normalizedOption } from "./physical-options";

const PHYSICAL_KEYS = ["size","material","finish","frame","glazing","edition"] as const;
type Key=typeof PHYSICAL_KEYS[number];
function dimension(variant: PublicVariant, key: Key):string {
  if (key === "frame" || key === "glazing") return normalizedOption(variant.attributes,key);
  const raw=variant.attributes;
  if(!raw || typeof raw!=="object" || Array.isArray(raw))return "";
  const value=(raw as Record<string,unknown>)[key];
  return typeof value === "string"?value.trim().toLowerCase():"";
}
export function selectPhysicalVariant(
  variants:readonly PublicVariant[], current:PublicVariant, change:{key:Key;value:string},
):PublicVariant|null {
  if(current.fulfillment!=="PHYSICAL")return null;
  const target=change.key==="frame"||change.key==="glazing"
    ?normalizedOption({[change.key]:change.value},change.key):change.value.trim().toLowerCase();
  return variants.find(v=>v.fulfillment==="PHYSICAL"&&v.available&&
    PHYSICAL_KEYS.every(key=>key===change.key?dimension(v,key)===target:dimension(v,key)===dimension(current,key))) ?? null;
}
export function physicalDimensionChoices(
  variants:readonly PublicVariant[], current:PublicVariant, key: Key,
):string[] {
  const values=new Map<string,string>();
  for(const variant of variants){
    if(variant.fulfillment!=="PHYSICAL")continue;
    const d=dimension(variant,key);
    const value=(key==="frame"||key==="glazing") && d==="none"?key==="frame"?"Unframed":"None":display(variant,key);
    if(value && selectPhysicalVariant(variants,current,{key,value}))values.set(d,value);
  }
  return [...values.values()];
}
function display(variant:PublicVariant,key:Key):string {
  const a=variant.attributes;
  if(!a||typeof a!=="object"||Array.isArray(a))return "";
  const v=(a as Record<string,unknown>)[key];return typeof v==="string"?v.trim():"";
}
