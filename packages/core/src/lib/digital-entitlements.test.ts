import {issuePurchasedDigitalGrants} from "./digital-entitlements";
function makeTx(){return {digitalGrant:{create:jest.fn().mockResolvedValue({id:"grant_001"})}};}
const file=(id="file_001",variantId="variant_001",priv=true)=>({digitalFileId:id,file:{variantId,asset:{private:priv}}});
const item=(overrides:Record<string,unknown>={})=>({id:"item_001",variantId:"variant_001",fulfillment:"DIGITAL" as const,quantity:2,purchasedFiles:[file()],...overrides});
test("issues opaque, unpredictable hashed credentials, no token or URL returned",async()=>{
 const tx=makeTx();
 expect(await issuePurchasedDigitalGrants(tx as never,"org_001",[item()])).toBe(1);
 const data=tx.digitalGrant.create.mock.calls[0][0].data;
 expect(data).toMatchObject({organizationId:"org_001",orderItemId:"item_001",digitalFileId:"file_001",uses:0,revokedAt:null});
 expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
 expect(JSON.stringify(data)).not.toContain("storageKey");
 expect(await issuePurchasedDigitalGrants(makeTx() as never,"org_001",[])).toBe(0);
});
test("blocks cross-variant, public, empty, duplicate and physical entitlements",async()=>{
 for(const invalid of [
  item({purchasedFiles:[]}),
  item({purchasedFiles:[file("file_001","variant_other")]}),
  item({purchasedFiles:[file("file_001","variant_001",false)]}),
  item({purchasedFiles:[file(),file()]}),
  item({fulfillment:"PHYSICAL"}),
  item({quantity:0}),
 ]) {
  const tx=makeTx();
  await expect(issuePurchasedDigitalGrants(tx as never,"org_001",[invalid as ReturnType<typeof item>])).rejects.toThrow();
  expect(tx.digitalGrant.create).not.toHaveBeenCalled();
 }
});
test("issues one grant per distinct purchased file",async()=>{
 const tx=makeTx();
 expect(await issuePurchasedDigitalGrants(tx as never,"org_001",[item({purchasedFiles:[file("file_001"),file("file_002")]})])).toBe(2);
 const hashes=tx.digitalGrant.create.mock.calls.map(c=>c[0].data.tokenHash);
 expect(new Set(hashes).size).toBe(2);
});
