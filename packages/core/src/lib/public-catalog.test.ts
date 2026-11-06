jest.mock("@acme/core/lib/prisma", () => ({ prisma: {
  storefront: { findFirst: jest.fn() },
  storeDomain: { findUnique: jest.fn() },
  storeListing: { findMany: jest.fn(), findFirst: jest.fn() },
} }));
import { prisma } from "@acme/core/lib/prisma";
import {
  getPublicProduct, listPublicProducts, normalizeVerifiedHostname,
  parsePublicListingPage, resolvePublishedStoreByDomain,
} from "./public-catalog";
const db = prisma as jest.Mocked<typeof prisma>;
const published = { id: "store_001", organizationId: "org_001", name: "Art Shop", slug: "art-shop" };
beforeEach(() => {
  jest.clearAllMocks();
  (db.storefront.findFirst as jest.Mock).mockResolvedValue(published);
});

test("never returns private products from unpublished storefronts", async () => {
  (db.storefront.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(listPublicProducts({ storeId: "store_hidden" })).rejects.toMatchObject({ status: 404 });
  expect(db.storeListing.findMany).not.toHaveBeenCalled();
  expect(db.storefront.findFirst).toHaveBeenCalledWith({
    where: { id: "store_hidden", published: true },
    select: expect.anything(),
  });
});

test("every list query is scoped to tenant, store and publication status", async () => {
  (db.storeListing.findMany as jest.Mock).mockResolvedValue([]);
  await listPublicProducts({ storeId: "store_001", query: "Canvas", limit: 12, page: 2 });
  expect((db.storeListing.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({
    where: {
      organizationId: "org_001", storeId: "store_001", status: "PUBLISHED",
      store: { published: true },
      product: { status: "PUBLISHED", variants: { some: { active: true } } },
    },
    take: 12, skip: 12,
  });
});

test("unpublished product slug cannot be found", async () => {
  (db.storeListing.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(getPublicProduct({ storeId: "store_001", slug: "hidden-art" })).rejects.toMatchObject({ status: 404 });
  expect((db.storeListing.findFirst as jest.Mock).mock.calls[0][0].where).toMatchObject({
    organizationId: "org_001", storeId: "store_001", status: "PUBLISHED",
    product: { status: "PUBLISHED" },
  });
});

test("public payload never exposes private storage IDs, digital file IDs or inventory quantities", async () => {
  (db.storeListing.findMany as jest.Mock).mockResolvedValue([{
    slug: "portrait", product: {
      id: "product_001", title: "Portrait", description: "Mixed media",
      media: [{ sortOrder: 0, asset: { id: "cover_001", mimeType: "image/jpeg", storageKey: "secret" } }],
      variants: [
        { id: "variant_001", name: "Download", attributes: {}, fulfillment: "DIGITAL", inventoryPolicy: "UNLIMITED", priceMinor: 500, currency: "USD", inventory: [], digitalFiles: [{ id: "private_file_001" }] },
        { id: "variant_002", name: "Sticker", attributes: {}, fulfillment: "PHYSICAL", inventoryPolicy: "TRACKED", priceMinor: 200, currency: "USD", inventory: [{ onHand: 3, reserved: 2 }], digitalFiles: [] },
      ],
    },
  }]);
  const data = await listPublicProducts({ storeId: "store_001" });
  expect(data.products[0].product.variants.map(v => v.available)).toEqual([true, true]);
  const serialized = JSON.stringify(data);
  expect(serialized).not.toMatch(/private_file_001|storageKey|secret|onHand|reserved|organizationId/);
  expect(serialized).toContain("cover_001");
});

test("out-of-stock physical and digital-without-file variants cannot be purchased", async () => {
  (db.storeListing.findFirst as jest.Mock).mockResolvedValue({
    slug: "sticker", product: { id: "product_001", title: "Sticker", description: "", media: [],
      variants: [
        { id: "variant_001", name: "Digital", attributes: null, fulfillment: "DIGITAL", inventoryPolicy: "UNLIMITED", priceMinor: 200, currency: "USD", inventory: [], digitalFiles: [] },
        { id: "variant_002", name: "Sticker", attributes: null, fulfillment: "PHYSICAL", inventoryPolicy: "TRACKED", priceMinor: 500, currency: "USD", inventory: [{ onHand: 0, reserved: 0 }], digitalFiles: [] },
      ],
    },
  });
  const result = await getPublicProduct({ storeId: "store_001", slug: "sticker" });
  expect(result.product.variants.map(v => v.available)).toEqual([false, false]);
});

test("verified domain must be verified, dated and have a published store", async () => {
  (db.storeDomain.findUnique as jest.Mock).mockResolvedValue({
    status: "VERIFIED", verifiedAt: new Date(), store: { ...published, published: true },
  });
  await expect(resolvePublishedStoreByDomain("ART.EXAMPLE.COM.")).resolves.toMatchObject({ id: "store_001" });
  (db.storeDomain.findUnique as jest.Mock).mockResolvedValue({
    status: "PENDING", verifiedAt: null, store: { ...published, published: true },
  });
  await expect(resolvePublishedStoreByDomain("art.example.com")).rejects.toMatchObject({ status: 404 });
});

test("rejects dangerous domains and invalid pagination", () => {
  expect(() => normalizeVerifiedHostname("foo.com:443")).toThrow();
  expect(() => normalizeVerifiedHostname("https://foo.com")).toThrow();
  expect(() => parsePublicListingPage({ limit: 100000 })).toThrow();
  expect(() => parsePublicListingPage({ page: -2 })).toThrow();
});

test("published catalog returns only license editions matching the product opt-in",async()=>{
  const base={id:"prod_abc",title:"Digital",description:"",categories:[],media:[],variants:[
    {id:"plain",name:"Plain",attributes:{format:"SVG"},fulfillment:"DIGITAL",inventoryPolicy:"UNLIMITED",priceMinor:1000,currency:"USD",inventory:[],digitalFiles:[{id:"file1"}]},
    {id:"personal",name:"Personal",attributes:{format:"SVG",license:"personal"},fulfillment:"DIGITAL",inventoryPolicy:"UNLIMITED",priceMinor:1200,currency:"USD",inventory:[],digitalFiles:[{id:"file2"}]},
    {id:"commercial",name:"Commercial",attributes:{format:"SVG",license:"commercial"},fulfillment:"DIGITAL",inventoryPolicy:"UNLIMITED",priceMinor:4200,currency:"USD",inventory:[],digitalFiles:[{id:"file3"}]},
  ]};
  (db.storeListing.findFirst as jest.Mock).mockResolvedValue({slug:"digital",product:{...base,offersDigitalLicenses:true}});
  const licensed=await getPublicProduct({storeId:"store_001",slug:"digital"});
  expect(licensed.product.variants.map(v=>v.id)).toEqual(["personal","commercial"]);
  expect(licensed.product.variants.map(v=>v.priceMinor)).toEqual([1200,4200]);
  (db.storeListing.findFirst as jest.Mock).mockResolvedValue({slug:"digital",product:{...base,offersDigitalLicenses:false}});
  const plain=await getPublicProduct({storeId:"store_001",slug:"digital"});
  expect(plain.product.variants.map(v=>v.id)).toEqual(["plain","personal","commercial"]);
});

test("one active licensed SVG and one fixed framed print are both published when selector switches are off",async()=>{
 (db.storeListing.findFirst as jest.Mock).mockResolvedValue({slug:"island",product:{id:"prod_island",title:"Island",description:"",
   offersDigitalLicenses:false,offersFraming:false,offersGlazing:false,media:[],categories:[],variants:[
     {id:"digital",name:"Download SVG",fulfillment:"DIGITAL",attributes:{license:"commercial",format:"SVG"},inventoryPolicy:"UNLIMITED",priceMinor:1000,currency:"USD",inventory:[],digitalFiles:[{id:"private-id"}]},
     {id:"print",name:"Framed print",fulfillment:"PHYSICAL",attributes:{frame:"Black wood",size:"16 x 20"},inventoryPolicy:"UNLIMITED",priceMinor:4200,currency:"USD",inventory:[],digitalFiles:[]},
   ]}});
 const item=await getPublicProduct({storeId:"store_001",slug:"island"});
 expect(item.product.variants.map(v=>v.id)).toEqual(["digital","print"]);
 expect(item.product.variants.map(v=>v.available)).toEqual([true,true]);
 expect(JSON.stringify(item)).not.toContain("private-id");
});
