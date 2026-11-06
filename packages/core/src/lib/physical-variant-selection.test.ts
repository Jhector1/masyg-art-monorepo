import {physicalDimensionChoices,selectPhysicalVariant} from "./physical-variant-selection";
import type {PublicVariant} from "./public-catalog-view";
const make=(id:string,attributes:object,available=true):PublicVariant=>({id,name:id,attributes,fulfillment:"PHYSICAL",priceMinor: id==="framed"?6900:4200,currency:"USD",compareAtMinor:null,available});
const base=make("base",{size:"16 x 20 in",material:"Fine art paper",frame:"Unframed",glazing:"None"});
const framed=make("framed",{size:"16 x 20 in",material:"Fine art paper",frame:"Black wood",glazing:"UV acrylic"});
const other=make("other",{size:"18 x 24 in",material:"Canvas",frame:"Black wood",glazing:"None"});
test("never silently changes glazing or size when a frame is selected",()=>{
 expect(selectPhysicalVariant([base,framed,other],base,{key:"frame",value:"Black wood"})).toBeNull();
 expect(selectPhysicalVariant([base,framed,other],base,{key:"size",value:"18 x 24 in"})).toBeNull();
});
test("real SKU is selected with the authoritative full price",()=>{
 const sameGlazing=make("same",{size:"16 x 20 in",material:"Fine art paper",frame:"Black wood",glazing:"None"});
 expect(selectPhysicalVariant([base,framed,sameGlazing],base,{key:"frame",value:"Black wood"})?.id).toBe("same");
 expect(selectPhysicalVariant([base,framed,sameGlazing],base,{key:"frame",value:"Black wood"})?.priceMinor).toBe(4200);
});
test("available choices exclude unsupported combinations",()=>{
 expect(physicalDimensionChoices([base,framed,other],base,"frame")).toEqual(["Unframed"]);
 expect(physicalDimensionChoices([base,framed,other],base,"glazing")).toEqual(["None"]);
});
