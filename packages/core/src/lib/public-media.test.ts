jest.mock("@acme/core/lib/prisma", () => ({ prisma: {
  storefront: { findFirst: jest.fn() },
  productMedia: { findFirst: jest.fn() },
} }));
import { prisma } from "@acme/core/lib/prisma";
import { getPublishedPreviewStorageKey } from "./public-media";
const storeLookup = prisma.storefront.findFirst as jest.Mock;
const mediaLookup = prisma.productMedia.findFirst as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); storeLookup.mockResolvedValue({ id:"store_001", organizationId:"org_001" }); });

test("rejects unpublished storefront media before looking up assets", async () => {
  storeLookup.mockResolvedValue(null);
  await expect(getPublishedPreviewStorageKey({storeId:"store_hidden",assetId:"asset_001"})).rejects.toMatchObject({status:404});
  expect(mediaLookup).not.toHaveBeenCalled();
});

test("resolves preview only from same organization, published listing and public asset", async () => {
  mediaLookup.mockResolvedValue({asset:{storageKey:"cloudinary:image:upload:example"}});
  const key = await getPublishedPreviewStorageKey({storeId:"store_001",assetId:"asset_001"});
  expect(key).toBe("cloudinary:image:upload:example");
  expect(mediaLookup).toHaveBeenCalledWith({
    where: {
      organizationId:"org_001", assetId:"asset_001", asset:{private:false},
      product:{status:"PUBLISHED",listings:{some:{organizationId:"org_001",storeId:"store_001",status:"PUBLISHED"}}},
    },
    select:{asset:{select:{storageKey:true}}},
  });
});

test("does not reveal private, foreign or unlisted assets", async () => {
  mediaLookup.mockResolvedValue(null);
  await expect(getPublishedPreviewStorageKey({storeId:"store_001",assetId:"asset_private"})).rejects.toMatchObject({status:404});
});
