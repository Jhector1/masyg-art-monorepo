import { validateStoreShippingSettings, mixedTestCheckoutAllowed } from "./store-shipping-policy";
const good = () => ({enabled:true, physicalTaxCode:"txcd_99999999", shippingTaxCode:"txcd_88888888",rates:[{country:"US",region:"",currency:"USD",amountMinor:500,enabled:true}]});
describe("tenant-safe merchant shipping configuration",()=>{
  it("accepts explicit flat rate in integer minor units",()=>expect(validateStoreShippingSettings(good()).rates[0]?.amountMinor).toBe(500));
  it("accepts country and currency in lower case only after normalization",()=>{const input=good();input.rates[0]!.country="us";input.rates[0]!.currency="usd";expect(validateStoreShippingSettings(input).rates[0]).toMatchObject({country:"US",currency:"USD"});});
  it("rejects duplicate normalized rate keys",()=>{const a=good();a.rates.push({...a.rates[0]!, country:"us"});expect(()=>validateStoreShippingSettings(a)).toThrow("Only one flat rate");});
  it("rejects negative or fractional shipping",()=>{expect(()=>validateStoreShippingSettings({...good(),rates:[{...good().rates[0],amountMinor:1.1}]})).toThrow();expect(()=>validateStoreShippingSettings({...good(),rates:[{...good().rates[0],amountMinor:-1}]})).toThrow();});
  it("rejects missing tax category when enabling shipping",()=>expect(()=>validateStoreShippingSettings({...good(),physicalTaxCode:null})).toThrow("tax category"));
  it("requires shipping tax category for nonzero shipping",()=>expect(()=>validateStoreShippingSettings({...good(),shippingTaxCode:null})).toThrow("shipping tax category"));
  it("allows free shipping without shipping tax category",()=>expect(validateStoreShippingSettings({...good(),shippingTaxCode:null,rates:[{...good().rates[0]!,amountMinor:0}]}).rates).toHaveLength(1));
  it("rejects enabled configuration without enabled rates",()=>expect(()=>validateStoreShippingSettings({...good(),rates:[{...good().rates[0]!,enabled:false}]})).toThrow("enabled shipping rate"));
  it("allows disabled draft configuration",()=>expect(validateStoreShippingSettings({enabled:false,physicalTaxCode:null,shippingTaxCode:null,rates:[]})).toMatchObject({enabled:false}));
  it("rejects arbitrary extra buyer/merchant fields",()=>expect(()=>validateStoreShippingSettings({...good(),secretKey:"secret"})).toThrow());
  it("rejects invalid country and region",()=>expect(()=>validateStoreShippingSettings({...good(),rates:[{...good().rates[0]!,country:"USA",region:"12345678901234567"}]})).toThrow());
  it("requires BOTH admin toggle and server feature flag",()=>{expect(mixedTestCheckoutAllowed({serverFlag:"true",merchantEnabled:true,rateCount:1})).toBe(true);expect(mixedTestCheckoutAllowed({serverFlag:undefined,merchantEnabled:true,rateCount:1})).toBe(false);expect(mixedTestCheckoutAllowed({serverFlag:"true",merchantEnabled:false,rateCount:1})).toBe(false);expect(mixedTestCheckoutAllowed({serverFlag:"true",merchantEnabled:true,rateCount:0})).toBe(false);});
});
