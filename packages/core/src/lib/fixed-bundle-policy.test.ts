import {previewFixedBundle, BundlePolicyError, type TrustedBundleComponent} from "./fixed-bundle-policy";

const coffee:TrustedBundleComponent={variantId:"coffee",organizationId:"orgA",storeId:"storeA",fulfillment:"PHYSICAL",quantity:1,
  currency:"USD",unitPriceMinor:1900,active:true,availablePhysicalQuantity:20};
const mug:TrustedBundleComponent={...coffee,variantId:"mug",unitPriceMinor:1200};
const kit=(components:TrustedBundleComponent[], fixedPriceMinor:number)=>previewFixedBundle({organizationId:"orgA",storeId:"storeA",currency:"USD",components,fixedPriceMinor});

describe("v39A fixed-bundle safety policy — no reservation/checkout", () => {
  it("allocates $24 kit across $19 coffee + $12 mug deterministically", () => {
    const result=kit([coffee,mug],2400);
    expect(result.regularTotalMinor).toBe(3100);
    expect(result.savingsMinor).toBe(700);
    expect(result.components.map(c=>c.netMinor)).toEqual([1471,929]);
    expect(result.components.reduce((sum,c)=>sum+c.netMinor,0)).toBe(2400);
  });
  it("does not create independent bundle inventory", () => {
    expect(()=>kit([coffee,{...mug,availablePhysicalQuantity:0}],2400)).toThrow(BundlePolicyError);
  });
  it("accepts mixed physical/digital only with private digital file ready", () => {
    const digital:TrustedBundleComponent={...mug,variantId:"digital",fulfillment:"DIGITAL",privateDigitalFileReady:true};
    const result=kit([coffee,digital],2000);
    expect(result.components.map(x=>x.fulfillment)).toEqual(["PHYSICAL","DIGITAL"]);
    expect(()=>kit([coffee,{...digital,privateDigitalFileReady:false}],2000)).toThrow(BundlePolicyError);
  });
  it("refuses foreign merchant or store components",()=>{
    expect(()=>kit([coffee,{...mug,organizationId:"orgB"}],2000)).toThrow();
    expect(()=>kit([coffee,{...mug,storeId:"storeB"}],2000)).toThrow();
  });
  it("refuses duplicates, missing stock, inactive components and excessive quantity",()=>{
    expect(()=>kit([coffee,coffee],2000)).toThrow();
    expect(()=>kit([coffee,{...mug,active:false}],2000)).toThrow();
    expect(()=>kit([coffee,{...mug,quantity:21}],2000)).toThrow();
  });
  it("supports valid zero-value components with zero price",()=>{
    const result=kit([{...coffee,unitPriceMinor:0},{...mug,unitPriceMinor:0}],0);
    expect(result.components.every(c=>c.netMinor===0)).toBe(true);
  });
  it("never offers more-expensive-than-components bundles or invalid prices",()=>{
    expect(()=>kit([coffee,mug],3200)).toThrow();
    expect(()=>kit([coffee,mug],-1)).toThrow();
  });
  it("never loses a cent in largest-remainder allocation",()=>{
    const result=kit([{...coffee,unitPriceMinor:1},{...mug,unitPriceMinor:1}],1);
    expect(result.components.reduce((sum,c)=>sum+c.netMinor,0)).toBe(1);
    expect(result.components.every(c=>c.netMinor<=1)).toBe(true);
  });
});
