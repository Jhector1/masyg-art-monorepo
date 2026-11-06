jest.mock("@acme/core/lib/prisma", () => ({prisma:{
  storeDomain:{findUnique:jest.fn()},
  storefront:{findFirst:jest.fn()},
}}));
import { prisma } from "@acme/core/lib/prisma";
import { normalizePublicHostHeader, resolvePublicStoreFromHostHeader, isLocalPreviewHostHeader } from "./storefront-host";
const findDomain = prisma.storeDomain.findUnique as jest.Mock;
const findStore = prisma.storefront.findFirst as jest.Mock;
// Test-only writable view: newer Node.js typings expose NODE_ENV as readonly.
const mutableNodeEnv = process.env as unknown as { NODE_ENV?: string };
const initialEnv = {
  nodeEnv: process.env.NODE_ENV,
  organizationId: process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID,
  storeId: process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID,
};
function restoreEnv() {
  if (initialEnv.nodeEnv===undefined) delete mutableNodeEnv.NODE_ENV;
  else mutableNodeEnv.NODE_ENV=initialEnv.nodeEnv;
  if (initialEnv.organizationId===undefined) delete process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID;
  else process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID=initialEnv.organizationId;
  if (initialEnv.storeId===undefined) delete process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID;
  else process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID=initialEnv.storeId;
}
beforeEach(()=>{
  findDomain.mockReset();findStore.mockReset();
  delete process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID;
  delete process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID;
  mutableNodeEnv.NODE_ENV="test";
});
afterAll(restoreEnv);
test("resolves only a verified, published domain into a server-authoritative storefront",async()=>{
  findDomain.mockResolvedValue({status:"VERIFIED",verifiedAt:new Date(),store:{id:"store_001",organizationId:"org_001",slug:"art",name:"Art",published:true}});
  await expect(resolvePublicStoreFromHostHeader("ART.Example.COM:443")).resolves.toMatchObject({id:"store_001",name:"Art"});
  expect(findDomain).toHaveBeenCalledWith({where:{hostname:"art.example.com"},select:expect.anything()});
  findDomain.mockResolvedValue({status:"PENDING",verifiedAt:null,store:{published:true}});
  await expect(resolvePublicStoreFromHostHeader("art.example.com")).rejects.toMatchObject({status:404});
});
test("does not trust malformed or forwarded-looking hosts", async()=>{
  for(const input of ["evil.com,art.example.com","art.example.com@evil.com","localhost:3000","art.example.com:abc","art.example.com:0","art.example.com:65536","https://art.example.com","[::1]:3000",null]) {
    expect(()=>normalizePublicHostHeader(input)).toThrow();
  }
  expect(findDomain).not.toHaveBeenCalled();
  expect(findStore).not.toHaveBeenCalled();
});
test("explicit development loopback mapping resolves only the configured, published organization/store",async()=>{
  mutableNodeEnv.NODE_ENV="development";
  process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID="org_001";
  process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID="store_001";
  findStore.mockResolvedValue({id:"store_001",organizationId:"org_001",name:"Art",slug:"art"});
  for(const host of ["localhost:3000","LOCALHOST:3000","127.0.0.1:3002"]) {
    await expect(resolvePublicStoreFromHostHeader(host)).resolves.toMatchObject({id:"store_001",organizationId:"org_001"});
  }
  expect(findStore).toHaveBeenCalledWith({
    where:{id:"store_001",organizationId:"org_001",published:true},select:expect.anything(),
  });
  expect(findDomain).not.toHaveBeenCalled();
});
test("development preview fails closed if identifiers are missing or store is unpublished",async()=>{
  mutableNodeEnv.NODE_ENV="development";
  await expect(resolvePublicStoreFromHostHeader("localhost:3000")).rejects.toMatchObject({status:404});
  expect(findStore).not.toHaveBeenCalled();
  process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID="org_001";
  process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID="store_001";
  findStore.mockResolvedValue(null);
  await expect(resolvePublicStoreFromHostHeader("localhost:3000")).rejects.toMatchObject({status:404});
  expect(findStore).toHaveBeenCalledWith({
    where:{id:"store_001",organizationId:"org_001",published:true},select:expect.anything(),
  });
});
test("preview never allows arbitrary or spoofed hosts and cannot activate outside development",async()=>{
  mutableNodeEnv.NODE_ENV="development";
  process.env.ZILEDIGITAL_LOCAL_PREVIEW_ORGANIZATION_ID="org_001";
  process.env.ZILEDIGITAL_LOCAL_PREVIEW_STORE_ID="store_001";
  for(const host of ["localhost.evil.com","evil.com,localhost","localhost:0","localhost:65536","127.0.0.2:3000", "localhost@evil.com", "[::1]:3000"]) {
    expect(isLocalPreviewHostHeader(host)).toBe(false);
    await expect(resolvePublicStoreFromHostHeader(host)).rejects.toMatchObject({status:404});
  }
  expect(findStore).not.toHaveBeenCalled();
  mutableNodeEnv.NODE_ENV="production";
  await expect(resolvePublicStoreFromHostHeader("localhost:3000")).rejects.toMatchObject({status:404});
  expect(findStore).not.toHaveBeenCalled();
});
