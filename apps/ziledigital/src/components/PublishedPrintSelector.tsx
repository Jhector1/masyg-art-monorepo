"use client";

import {useMemo} from "react";
import type {PublicVariant} from "@acme/core/lib/public-catalog-view";
import {publicPrintChoices} from "@acme/core/lib/public-print-choices";

/** Every card maps to one server-published price and one inventory-bearing SKU. */
export default function PublishedPrintSelector({variants,selectedVariantId,onSelect}:{
  variants:readonly PublicVariant[];
  selectedVariantId:string;
  onSelect:(variantId:string)=>void;
}) {
  const choices=useMemo(()=>publicPrintChoices(variants),[variants]);
  if(choices.length===0)return null;
  return <fieldset className="rounded-xl border border-purple-100 bg-white p-4 sm:p-5">
    <legend className="px-1 text-sm font-semibold text-gray-900">Print size and edition</legend>
    <p className="mb-3 text-xs text-gray-600">
      Select a published print. Each option includes its actual size, material, frame and price, where provided.
    </p>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Available print editions">
      {choices.map(choice=><button key={choice.variantId} type="button"
        onClick={()=>{if(choice.available)onSelect(choice.variantId);}}
        disabled={!choice.available}
        aria-pressed={selectedVariantId===choice.variantId}
        className={`flex min-w-0 flex-col gap-1 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
          selectedVariantId===choice.variantId
            ? "border-purple-700 bg-purple-50 ring-1 ring-purple-600"
            : "border-gray-300 bg-white hover:border-purple-400"
        } ${!choice.available?"cursor-not-allowed opacity-55":""}`}>
        <span className="break-words text-sm font-medium text-gray-900">{choice.label}</span>
        <span className="text-sm font-semibold text-gray-900">{choice.priceLabel}</span>
        {!choice.available&&<span className="text-xs font-semibold text-red-700">Unavailable</span>}
      </button>)}
    </div>
    <p className="mt-3 text-xs text-gray-600">Price and availability are checked again when you add this edition to the cart.</p>
  </fieldset>;
}
