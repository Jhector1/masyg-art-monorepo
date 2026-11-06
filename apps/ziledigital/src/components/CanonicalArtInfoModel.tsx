"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {AnimatePresence,motion} from "framer-motion";
import {useRouter} from "next/navigation";
import {DescriptionCard} from "@acme/ui/components/product/shared/core/DescriptionCard";
import {SaleAndCountdown} from "@acme/ui/components/product/shared/core/SalePriceAndCountDown";
import PurchaseOptionsCore from "@acme/ui/components/product/shared/core/PurchaseOptionsCore";
import SizeSelectorCore from "@acme/ui/components/product/shared/core/SizeSelectorCore";
import LicenseSelectorCore from "@acme/ui/components/product/shared/core/LicenseSelectorCore";
import PrintCustomizerCore from "@acme/ui/components/product/shared/core/PrintCustomizerCore";
import FormatSelector from "@acme/ui/components/product/FormatSelector";
import CartActions from "@acme/ui/components/product/CartActions";
import PublishedPrintSelector from "./PublishedPrintSelector";
import {physicalDimensionChoices,selectPhysicalVariant} from "@acme/core/lib/physical-variant-selection";
import {isPublicPrintVariant} from "@acme/core/lib/public-print-variants";
import {availablePublicPrintChoice} from "@acme/core/lib/public-print-choices";
import {normalizedOption} from "@acme/core/lib/physical-options";
import {allFrames,allLicenses,allMaterials} from "@acme/core/data/helpers";
import type {FrameOption,LicenseOption,MaterialOption} from "@acme/core/types";
import {
  catalogMediaPath,isPublicOriginal,visibleVariants,type PublicCatalogDetail,type PublicVariant,
} from "@acme/core/lib/public-catalog-view";
import {
  addStoreVariant,getStoreCart,setStoreVariantQuantity,STORE_CART_UPDATED_EVENT,
} from "@acme/core/lib/client/storefront-commerce";

/**
 * Historical ArtInfoModel visual composition; canonical published variants are the ONLY
 * saleable selections. No legacy client-only pricing or checkout calls.
 */
function attr(variant:PublicVariant,key:string):string {
  const raw=variant.attributes;
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return "";
  const value=(raw as Record<string,unknown>)[key];
  return typeof value==="string"?value.trim():"";
}
function majorUnits(minor:number,currency:string):number {
  const options=new Intl.NumberFormat("en-US",{style:"currency",currency}).resolvedOptions();
  return minor/(10**(options.maximumFractionDigits??2));
}
type PhysicalKind = "PRINT" | "ORIGINAL" | "MERCHANDISE";
function physicalKind(variant:PublicVariant):PhysicalKind {
  if(isPublicPrintVariant(variant))return "PRINT";
  if(isPublicOriginal(variant))return "ORIGINAL";
  return "MERCHANDISE";
}
function physicalKindLabel(kind:PhysicalKind):string {
  return kind==="PRINT"?"Art print":kind==="ORIGINAL"?"Original artwork":"Physical item";
}
function chooseVariant(variants:PublicVariant[],current:PublicVariant,change:{key:string;value:string}):PublicVariant|null {
  if (current.fulfillment === "PHYSICAL") {
    // A switch narrows the key to the actual physical-variant dimensions.
    // Keep the original value: it identifies a real, server-priced variant.
    switch (change.key) {
      case "size":
      case "material":
      case "frame":
      case "finish":
      case "glazing":
      case "edition":
        return selectPhysicalVariant(variants.filter(v=>v.fulfillment==="PHYSICAL" && physicalKind(v)===physicalKind(current)),current,{key:change.key,value:change.value});
      default:
        return null;
    }
  }
  // Digital choices preserve matching formats and license editions.
  // The selected SKU is always a real, published variant with its own quoted price.
  const keys=["format","license","edition"];
  const normalized=(v:PublicVariant,key:string)=>attr(v,key).toLowerCase();
  const wanted=change.value.toLowerCase();
  const candidates=variants.filter(v=>v.fulfillment===current.fulfillment && normalized(v,change.key)===wanted &&
    (change.key!=="license" || !attr(current,"format") || normalized(v,"format")===normalized(current,"format")) &&
    (change.key!=="format" || !attr(current,"license") || normalized(v,"license")===normalized(current,"license")));
  candidates.sort((a,b)=>{
    const score=(v:PublicVariant)=>keys.filter(k=>k!==change.key && normalized(v,k)===normalized(current,k)).length;
    return score(b)-score(a) || Number(b.available)-Number(a.available);
  });
  return candidates[0]??null;
}
function publishedMaterial(label:string):MaterialOption {
  const known=(allMaterials as MaterialOption[]).find(m=>m.label.toLowerCase()===label.toLowerCase());
  if(known)return known;
  const material=label.toLowerCase();
  const texture=material.includes("canvas")?"canvas.png"
    :material.includes("vinyl")||material.includes("gloss")?"glossy.png"
    :material.includes("paper")?"paper-grain.png":"matte.png";
  // Thumbnail is display-only. Pricing always comes from the selected variant.
  return {label,multiplier:1,thumbnail:`/images/textures/${texture}`};
}
function publishedFrame(label:string):FrameOption {
  const known=(allFrames as FrameOption[]).find(f=>f.label.toLowerCase()===label.toLowerCase());
  return known??{label,border:"8px solid #444",multiplier:1};
}
export default function CanonicalArtInfoModel({product}:{product:PublicCatalogDetail}) {
  const router=useRouter();
  const variants=useMemo(()=>visibleVariants(product),[product]);
  const physical=variants.filter(v=>v.fulfillment==="PHYSICAL");
  const digital=variants.filter(v=>v.fulfillment==="DIGITAL");
  const prints=physical.filter(isPublicPrintVariant);
  const physicalKinds=Array.from(new Set(physical.map(physicalKind)));
  const physicalLabel=physicalKinds.length===1 ? physicalKindLabel(physicalKinds[0]??"MERCHANDISE") : "Physical edition";
  const [variantId,setVariantId]=useState(()=>((variants.find(v=>v.available)??variants[0])?.id??""));
  const [cartIds,setCartIds]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);

  const selected=variants.find(v=>v.id===variantId)??variants[0]??null;
  const selectedIsPhysical=selected?.fulfillment==="PHYSICAL";
  const selectedIsDigital=selected?.fulfillment==="DIGITAL";
  const selectedIsPrint=selected?isPublicPrintVariant(selected):false;
  const matchingPhysical=selectedIsPhysical&&selected
    ?physical.filter(v=>physicalKind(v)===physicalKind(selected)):physical;
  const inCart=selected?cartIds.includes(selected.id):false;

  const reloadCart=useCallback(async()=>{
    try {
      const quote=await getStoreCart(product.store.id);
      setCartIds(quote.items.map(i=>i.variantId));
    }catch{setCartIds([]);}
  },[product.store.id]);
  useEffect(()=>{
    void reloadCart();
    window.addEventListener(STORE_CART_UPDATED_EVENT,reloadCart);
    return()=>window.removeEventListener(STORE_CART_UPDATED_EVENT,reloadCart);
  },[reloadCart]);
  useEffect(()=>{
    setVariantId((variants.find(v=>v.available)??variants[0])?.id??"");
  },[product.store.id,product.slug]); // resets when moving to a different listing

  const chooseFulfillment=(fulfillment:"PHYSICAL"|"DIGITAL")=>{
    const candidate=variants.find(v=>v.fulfillment===fulfillment&&v.available)
      ??variants.find(v=>v.fulfillment===fulfillment);
    if(candidate){setVariantId(candidate.id);setMessage(null);}
  };
  const choosePhysicalKind=(kind:PhysicalKind)=>{
    const candidates=physical.filter(v=>physicalKind(v)===kind);
    const candidate=candidates.find(v=>v.available)??candidates[0];
    if(candidate){setVariantId(candidate.id);setMessage(null);}
  };
  const choosePrintVariant=(id:string)=>{
    const exact=availablePublicPrintChoice(prints,id);
    if(exact){setVariantId(exact.id);setMessage(null);}
  };
  const selectByAttr=(key:string,value:string)=>{
    if(!selected)return;
    const chosen=chooseVariant(variants,selected,{key,value});
    if(chosen){setVariantId(chosen.id);setMessage(null);}
    else setMessage("This combination is not available for this artwork.");
  };

  const price=selected?majorUnits(selected.priceMinor,selected.currency):0;
  const compareAt=selected?.compareAtMinor!=null&&selected.compareAtMinor>selected.priceMinor
    ?majorUnits(selected.compareAtMinor,selected.currency):null;
  const prices={
    physical:physical[0]?majorUnits((physical.find(v=>v.available)??physical[0]).priceMinor,physical[0].currency):0,
    digital:digital[0]?majorUnits((digital.find(v=>v.available)??digital[0]).priceMinor,digital[0].currency):0,
  };
  const sizes=[...new Set(matchingPhysical.map(v=>attr(v,"size")).filter(Boolean))];
  const currentSize=selected?attr(selected,"size"):"";
  // Merchant-controlled variant attributes must not be restricted to the old
  // UI's three hardcoded material labels (Matte Paper, Glossy Paper, Canvas).
  const materials=(selectedIsPhysical&&selected
    ?physicalDimensionChoices(matchingPhysical,selected,"material")
    :[...new Set(matchingPhysical.map(v=>attr(v,"material")).filter(Boolean))]).map(publishedMaterial);
  const currentMaterial=materials.find(m=>m.label.toLowerCase()===(selected?attr(selected,"material").toLowerCase():""))??materials[0];
  const frameNames=product.product.offersFraming&&selectedIsPhysical&&selected
    ?physicalDimensionChoices(matchingPhysical,selected,"frame").filter(v=>normalizedOption({frame:v},"frame")!=="none")
    :[];
  const frames=frameNames.map(publishedFrame);
  const currentFrame=frames.find(f=>f.label.toLowerCase()===(selected?attr(selected,"frame").toLowerCase():""))??null;
  const finishes=selectedIsPhysical&&selected?physicalDimensionChoices(matchingPhysical,selected,"finish")
    :[...new Set(matchingPhysical.map(v=>attr(v,"finish")).filter(Boolean))];
  const frameOptions=product.product.offersFraming&&selectedIsPhysical&&selected
    ?physicalDimensionChoices(matchingPhysical,selected,"frame"):[];
  const glazingOptions=product.product.offersGlazing&&selectedIsPhysical&&selected
    ?physicalDimensionChoices(matchingPhysical,selected,"glazing"):[];
  const currentGlazing=selected?attr(selected,"glazing")||"None":"None";
  const currentFinish=selected?attr(selected,"finish"):"";
  // Price each card from the exact SKU that choosing it would select.
  // This keeps the advertised total aligned with the server-priced variant ID.
  const licenses=product.product.offersDigitalLicenses && selectedIsDigital && selected ? allLicenses.flatMap(l=>{
    const target=chooseVariant(variants,selected,{key:"license",value:l.type});
    return target ? [{...l,price:majorUnits(target.priceMinor,target.currency)}] : [];
  }) as LicenseOption[] : [];
  const currentLicense=licenses.find(l=>l.type.toLowerCase()===(selected?attr(selected,"license").toLowerCase():""))??licenses[0];
  const formats=[...new Set(digital.map(v=>attr(v,"format")).filter(Boolean))].map(type=>({type,resolution:selectedIsDigital&&selected?attr(selected,"resolution")||"Included":"Included",multiplier:1}));
  const currentFormat=selectedIsDigital&&selected?attr(selected,"format"):"";
  const canCustomize=product.product.categories?.some(c=>c.toLowerCase()==="spiritual & vodou imagery") &&
    product.product.publicMedia.some(asset=>asset.mimeType==="image/svg+xml");
  const media=product.product.publicMedia[0];
  const previewSrc=media?catalogMediaPath(product.store.id,media.assetId):"";

  async function toggleCart(){
    if(!selected||busy||(!selected.available&&!inCart))return;
    setBusy(true);setMessage(null);
    try{
      if(inCart) await setStoreVariantQuantity(product.store.id,selected.id,0);
      else await addStoreVariant(product.store.id,selected.id,1);
      await reloadCart();
    }catch(reason){setMessage(reason instanceof Error?reason.message:"Cart update unavailable");}
    finally{setBusy(false);}
  }

  return <div className="flex relative flex-col gap-6 w-full">
    <DescriptionCard text={product.product.description}/>
    {selected&&<SaleAndCountdown price={price} compareAt={compareAt} onSale={compareAt!==null}
      endsAt={null} currency={selected.currency}/>}
    <PurchaseOptionsCore
      digitalChecked={!!selectedIsDigital} printChecked={!!selectedIsPhysical}
      digitalPrice={prices.digital} printPrice={prices.physical}
      onToggleDigital={()=>chooseFulfillment("DIGITAL")}
      onTogglePrint={()=>chooseFulfillment("PHYSICAL")}
      allowDigital={digital.length>0} allowPrint={physical.length>0}
      currency={selected?.currency??"USD"} showBundleDiscount={false} physicalLabel={physicalLabel}
    />

    {selectedIsPhysical&&physicalKinds.length>1&&<fieldset className="rounded-xl border border-gray-200 bg-white p-4">
      <legend className="px-1 text-sm font-medium text-gray-800">Choose physical product type</legend>
      <div className="flex flex-wrap gap-2">
        {physicalKinds.map(kind=><button key={kind} type="button"
          onClick={()=>choosePhysicalKind(kind)}
          aria-pressed={selected?physicalKind(selected)===kind:false}
          className={`rounded-lg border px-4 py-2 text-sm ${selected&&physicalKind(selected)===kind
            ?"border-purple-700 bg-purple-600 text-white":"border-gray-300 bg-white hover:border-purple-400"}`}>
          {physicalKindLabel(kind)}
        </button>)}
      </div>
    </fieldset>}

    {canCustomize && <div className="rounded-2xl ring-1 ring-black/5 bg-white p-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-black/70 text-center sm:text-left">Want different colors or gradients?</p>
        <button type="button" onClick={()=>router.push(`/store/${encodeURIComponent(product.slug)}/studio`)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition">
          ✨ Customize this piece
        </button>
      </div>
    </div>}

    <AnimatePresence initial={false}>
      {selectedIsDigital&&product.product.offersDigitalLicenses&&licenses.length>0&&currentLicense&&<motion.div key="digital-license"
        initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
        transition={{duration:0.35}} style={{overflow:"hidden"}}>
        <LicenseSelectorCore selected={currentLicense} licenses={licenses} showFullPrice currency={selected?.currency??"USD"}
          onSelect={license=>selectByAttr("license",license.type)}/>
      </motion.div>}
    </AnimatePresence>

    {selectedIsDigital&&!product.product.offersDigitalLicenses&&attr(selected!,"license")&&<p className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-950" role="status">
      Included license: <strong>{attr(selected!,"license").replace(/^./,c=>c.toUpperCase())}</strong>. The merchant has not enabled a separate license selector for this product; the displayed price is for this exact digital edition.
    </p>}

    {selectedIsDigital&&formats.length>0&&<FormatSelector formats={formats} selected={currentFormat||formats[0].type}
      onChangeAction={format=>selectByAttr("format",format)} inCart={null} updateCart={()=>{}}/>}

    <AnimatePresence initial={false}>
      {selectedIsPhysical&&<motion.div key="print-settings"
        initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
        transition={{duration:0.35}} style={{overflow:"hidden"}}>
        {selectedIsPrint&&selected&&<PublishedPrintSelector variants={prints}
          selectedVariantId={selected.id} onSelect={choosePrintVariant}/>}
        {!selectedIsPrint&&sizes.length>0&&<SizeSelectorCore
          options={sizes.map(label=>({label}))} selected={{label:currentSize||sizes[0]||""}}
          isCustom={false} customSize={{width:"",height:""}}
          onSelect={choice=>selectByAttr("size",choice.label)} onCustomChange={()=>{}}/>}
        {!selectedIsPrint&&(product.product.offersFraming||product.product.offersGlazing) ? <div className="mt-4 rounded-xl border border-purple-100 bg-white p-4">
          <p className="text-sm font-semibold text-gray-800">Available framed and glazed editions</p>
          <p className="mb-3 text-xs text-gray-600">Each choice has its own total price and availability. Only published combinations can be selected.</p>
          <div className="flex flex-wrap gap-2">
          {matchingPhysical.filter(v=>v.available).map(v=><button key={v.id} type="button" onClick={()=>{setVariantId(v.id);setMessage(null);}}
            aria-pressed={selected?.id===v.id} className={`rounded-lg border px-3 py-2 text-left text-xs ${selected?.id===v.id?"border-purple-600 bg-purple-600 text-white":"border-gray-200 hover:border-purple-400"}`}>
              {attr(v,"size")||v.name} · {attr(v,"frame")||"Unframed"} · {attr(v,"glazing")||"No glazing"} · {new Intl.NumberFormat("en-US",{style:"currency",currency:v.currency}).format(majorUnits(v.priceMinor,v.currency))}
            </button>)}
          </div>
        </div>:null}
        <div className="mt-4" />
        {selectedIsPrint&&selected&&<PrintCustomizerCore
          imageSrc={previewSrc||""} materials={[]} frames={[]}
          material={currentMaterial??{label:"Standard material",multiplier:1,thumbnail:"/images/textures/matte.png"}}
          frame={normalizedOption(selected.attributes,"frame")==="none"?null:publishedFrame(attr(selected,"frame"))}
          glazing={currentGlazing} showFrameSelector={false} showGlazingSelector={false}
          onMaterial={()=>{}} onFrame={()=>{}} total={price}/>}
        {!selectedIsPrint&&(materials.length>0||frameOptions.length>0||glazingOptions.length>0)&&<PrintCustomizerCore
          imageSrc={previewSrc||""} materials={materials} frames={frames}
          material={currentMaterial??{label:"Standard material",multiplier:1,thumbnail:"/images/textures/matte.png"}} frame={currentFrame}
          onMaterial={material=>selectByAttr("material",material.label)}
          onFrame={frame=>selectByAttr("frame",frame?.label??"Unframed")}
          showFrameSelector={!!product.product.offersFraming}
          allowUnframed={frameOptions.some(name=>normalizedOption({frame:name},"frame")==="none")}
          glazingOptions={glazingOptions} glazing={currentGlazing}
          showGlazingSelector={!!product.product.offersGlazing}
          onGlazing={name=>selectByAttr("glazing",name)}
          total={price}/>}
        {!selectedIsPrint&&finishes.length>0&&<fieldset className="mt-4 rounded-xl bg-white p-4 ring-1 ring-black/10">
          <legend className="font-semibold text-sm">Finish</legend>
          <div className="flex flex-wrap gap-2">
            {finishes.map(finish=><button key={finish} type="button"
              aria-pressed={currentFinish===finish}
              onClick={()=>selectByAttr("finish",finish)}
              className={`rounded-lg border px-4 py-2 text-sm transition ${currentFinish===finish?"border-purple-600 bg-purple-600 text-white":"border-gray-300 hover:border-purple-400"}`}>
              {finish}
            </button>)}
          </div>
        </fieldset>}
        {!selectedIsPrint&&materials.length===0&&sizes.length===0&&finishes.length===0&&<p className="text-sm text-gray-600">
          This print is available only in its published edition; additional print options are not configured.
        </p>}
      </motion.div>}
    </AnimatePresence>

    {selected&&!selectedIsPrint&&variants.filter(v=>v.fulfillment===selected.fulfillment).length>1&&<div className="space-y-2">
      <label htmlFor="verified-edition" className="block text-sm font-medium text-gray-700">Edition</label>
      <select id="verified-edition" className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
        value={selected.id} onChange={e=>{setVariantId(e.target.value);setMessage(null);}}>
        {variants.filter(v=>v.fulfillment===selected.fulfillment).map(v=><option value={v.id} key={v.id}>
          {v.name}{!v.available?" — Unavailable":""}
        </option>)}
      </select>
    </div>}
    <CartActions inCart={inCart} loading={busy} disabled={!selected?.available}
      onToggleCart={()=>{void toggleCart();}}
      onCheckout={()=>router.push("/cart")}/>
    {message&&<p role="status" className="text-sm text-red-700">{message}</p>}
  </div>;
}
