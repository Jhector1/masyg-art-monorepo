jest.mock("./prisma",()=>({prisma:{storeFavorite:{findMany:jest.fn(),upsert:jest.fn(),deleteMany:jest.fn()},storeListing:{findFirst:jest.fn()}}}));
jest.mock("./public-catalog",()=>({resolvePublishedStore:jest.fn(),listPublicProductsByIds:jest.fn()}));
import {prisma} from "./prisma";
import {resolvePublishedStore,listPublicProductsByIds} from "./public-catalog";
import {requireFavoriteProductId,listBuyerStoreFavorites,setBuyerStoreFavorite} from "./store-favorites";
beforeEach(()=>{
  jest.clearAllMocks();
  (resolvePublishedStore as jest.Mock).mockResolvedValue({id:"store_001",organizationId:"org_001",slug:"shop",name:"Shop"});
});
test("refuses invalid product IDs before mutation",()=>{
  expect(()=>requireFavoriteProductId("../../other")).toThrow();
  expect(()=>requireFavoriteProductId("")).toThrow();
});
test("authenticated writes require published listing in the same organization and store",async()=>{
  (prisma.storeListing.findFirst as jest.Mock).mockResolvedValue({productId:"prod_001"});
  await setBuyerStoreFavorite({userId:"user_001",storeId:"store_001",productId:"prod_001",enabled:true});
  expect(prisma.storeListing.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({organizationId:"org_001",storeId:"store_001",productId:"prod_001",status:"PUBLISHED"})}));
  expect(prisma.storeFavorite.upsert).toHaveBeenCalledWith(expect.objectContaining({create:{organizationId:"org_001",storeId:"store_001",userId:"user_001",productId:"prod_001"}}));
});
test("cannot create favorites with no authenticated buyer",async()=>{
  await expect(setBuyerStoreFavorite({userId:null,storeId:"store_001",productId:"prod_001",enabled:true})).rejects.toThrow("Sign in");
  expect(prisma.storeFavorite.upsert).not.toHaveBeenCalled();
});
test("only published current-store listings are returned",async()=>{
  (prisma.storeFavorite.findMany as jest.Mock).mockResolvedValue([{productId:"prod_001"},{productId:"prod_hidden"}]);
  (listPublicProductsByIds as jest.Mock).mockResolvedValue({store:{id:"store_001"},products:[{slug:"art",product:{id:"prod_001"}}]});
  const result=await listBuyerStoreFavorites({userId:"user_001",storeId:"store_001"});
  expect(result.favorites).toEqual(["prod_001"]);
  expect(result.products).toHaveLength(1);
});
