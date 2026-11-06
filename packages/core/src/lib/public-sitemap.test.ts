jest.mock("@acme/core/lib/prisma", () => ({ prisma: { storeListing: { findMany: jest.fn() } } }));
jest.mock("./storefront-host", () => ({ resolvePublicStoreFromHostHeader: jest.fn() }));
import { prisma } from "@acme/core/lib/prisma";
import { resolvePublicStoreFromHostHeader } from "./storefront-host";
import { listPublishedSitemapListings } from "./public-sitemap";
const lookup = resolvePublicStoreFromHostHeader as jest.Mock;
const list = prisma.storeListing.findMany as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); });

test("rejects unverified or unpublished hosts before any catalog query", async () => {
  lookup.mockRejectedValue({ status: 404 });
  await expect(listPublishedSitemapListings("unverified.test")).rejects.toMatchObject({status:404});
  expect(list).not.toHaveBeenCalled();
});

test("sitemap query is limited to verified tenant, storefront and published active products", async () => {
  lookup.mockResolvedValue({ id:"store_001", organizationId:"org_001", slug:"gallery", name:"Gallery" });
  list.mockResolvedValue([{slug:"painting",updatedAt:new Date("2026-11-01T00:00:00Z")}]);
  const result = await listPublishedSitemapListings("art.example.test");
  expect(lookup).toHaveBeenCalledWith("art.example.test");
  expect(list).toHaveBeenCalledWith({
    where: {
      organizationId:"org_001", storeId:"store_001", status:"PUBLISHED",
      store:{ published:true }, product:{ status:"PUBLISHED", variants:{ some:{ active:true } } },
    },
    select:{ slug:true, updatedAt:true },
    orderBy:[{updatedAt:"desc"},{productId:"asc"}],
    take:500,
  });
  expect(result.listings).toEqual([{slug:"painting",updatedAt:new Date("2026-11-01T00:00:00Z")}]);
  expect(JSON.stringify(result)).not.toMatch(/organizationId|storageKey|private|digitalFile/);
});

test("separate store domains cannot alter the organization scope", async () => {
  lookup.mockResolvedValueOnce({ id:"store_a", organizationId:"org_a", slug:"a", name:"A" })
    .mockResolvedValueOnce({ id:"store_b", organizationId:"org_b", slug:"b", name:"B" });
  list.mockResolvedValue([]);
  await listPublishedSitemapListings("a.example.test");
  await listPublishedSitemapListings("b.example.test");
  expect(list.mock.calls[0][0].where).toMatchObject({organizationId:"org_a",storeId:"store_a"});
  expect(list.mock.calls[1][0].where).toMatchObject({organizationId:"org_b",storeId:"store_b"});
});
