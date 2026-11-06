jest.mock("@acme/core/lib/prisma", () => ({
  prisma: { storefront: { findFirst: jest.fn() }, digitalGrant: { findFirst: jest.fn(), updateMany: jest.fn() } },
}));
import { prisma } from "@acme/core/lib/prisma";
import { authorizeBuyerGrant, consumeBuyerGrant } from "./buyer-grant-download";
const db=prisma as jest.Mocked<typeof prisma>;
const args={userId:"buyer_001",storeId:"store_001",grantId:"grant_001"};
const valid={
 id:"grant_001",uses:0,maximumUses:1,revokedAt:null,expiresAt:null,digitalFileId:"file_001",
 item:{fulfillment:"DIGITAL",variantId:"variant_001",purchasedFiles:[{digitalFileId:"file_001"}]},
 file:{id:"file_001",variantId:"variant_001",label:"Art.zip",asset:{private:true,storageKey:"secret_storage_key",mimeType:"application/zip"}},
};
beforeEach(()=>{jest.clearAllMocks();(db.storefront.findFirst as jest.Mock).mockResolvedValue({organizationId:"org_001"});(db.digitalGrant.findFirst as jest.Mock).mockResolvedValue(valid)});
test("anonymous cannot reach persistence",async()=>{
 await expect(authorizeBuyerGrant({...args,userId:null})).rejects.toMatchObject({status:401});
 expect(db.storefront.findFirst).not.toHaveBeenCalled();
});
test("buyer + store + settled order always constrained",async()=>{
 await authorizeBuyerGrant(args);
 expect(db.digitalGrant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
  where: {id:"grant_001",organizationId:"org_001",item:{order:{organizationId:"org_001",storeId:"store_001",status:{in:["PAID","FULFILLING","FULFILLED"]},payments:{some:{status:"SUCCEEDED"}},customer:{is:{userId:"buyer_001"}}}}},
 }));
});
test.each([
 { ...valid, revokedAt:new Date() },
 { ...valid, uses:1 },
 { ...valid, item:{ ...valid.item, purchasedFiles:[] } },
 { ...valid, file:{ ...valid.file, asset:{...valid.file.asset,private:false} } },
 { ...valid, file:{ ...valid.file, variantId:"other_variant" } },
])("rejects unusable or unsnapshotted private files",async record=>{
 (db.digitalGrant.findFirst as jest.Mock).mockResolvedValue(record);
 await expect(authorizeBuyerGrant(args)).rejects.toMatchObject({status:404});
 expect(db.digitalGrant.updateMany).not.toHaveBeenCalled();
});
test("uses are reserved with compare-and-swap, including scope + settled status",async()=>{
 (db.digitalGrant.updateMany as jest.Mock).mockResolvedValue({count:1});
 const grant=await authorizeBuyerGrant(args);
 await consumeBuyerGrant(grant);
 expect(db.digitalGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
  where:expect.objectContaining({id:"grant_001",organizationId:"org_001",uses:0,revokedAt:null}),
  data:{uses:{increment:1}},
 }));
});
test("concurrent consumption loses safely",async()=>{
 (db.digitalGrant.updateMany as jest.Mock).mockResolvedValue({count:0});
 const grant=await authorizeBuyerGrant(args);
 await expect(consumeBuyerGrant(grant)).rejects.toMatchObject({status:409});
});
