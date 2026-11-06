import {GLAZING_CHOICES, FRAME_CHOICES, normalizedOption, physicalOptionsAllowed, physicalOptionsReady} from "./physical-options";
describe("merchant-controlled physical customizations",()=>{
  const variants=[
    {active:true,fulfillment:"PHYSICAL",attributes:{frame:"Unframed",glazing:"None"}},
    {active:true,fulfillment:"PHYSICAL",attributes:{frame:"Black wood",glazing:"UV acrylic"}},
  ];
  it("fixed priced physical configurations remain purchasable when selectors are off",()=>{
    expect(physicalOptionsAllowed({},"PHYSICAL",{frame:"Black wood"})).toBe(true);
    expect(physicalOptionsAllowed({offersFraming:true},"PHYSICAL",{frame:"Black wood"})).toBe(true);
    expect(physicalOptionsAllowed({offersFraming:true},"PHYSICAL",{glazing:"UV acrylic"})).toBe(true);
    expect(physicalOptionsAllowed({offersFraming:true,offersGlazing:true},"PHYSICAL",{frame:"Black wood",glazing:"UV acrylic"})).toBe(true);
    expect(physicalOptionsAllowed({offersFraming:true,offersGlazing:true},"DIGITAL",{frame:"Black wood"})).toBe(false);
  });
  it("recognizes legacy none/unframed and refuses premature enablement",()=>{
    expect(normalizedOption({},"frame")).toBe("none");
    expect(normalizedOption({frame:"Unframed"},"frame")).toBe("none");
    expect(physicalOptionsReady(variants,"frame")).toBe(true);
    expect(physicalOptionsReady(variants,"glazing")).toBe(true);
    expect(physicalOptionsReady(variants.slice(0,1),"frame")).toBe(false);
    expect(physicalOptionsReady([{...variants[1],active:false},variants[0]],"glazing")).toBe(false);
  });
  it("has curated defaults but accepts merchant-specific frame names",()=>{
    expect(FRAME_CHOICES).toContain("Black wood");
    expect(GLAZING_CHOICES).toContain("UV acrylic");
    expect(normalizedOption({frame:"Mahogany Custom"},"frame")).toBe("mahogany custom");
  });
});
