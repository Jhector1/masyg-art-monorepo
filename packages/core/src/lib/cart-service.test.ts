jest.mock("@acme/core/lib/prisma",()=>({prisma:{cart:{findFirst:jest.fn()},$transaction:jest.fn()}}));
jest.mock("./public-catalog",()=>({resolvePublishedStore:jest.fn()}));
import { prisma } from "@acme/core/lib/prisma";
import { resolvePublishedStore } from "./public-catalog";
import { getGuestCart, mutateGuestCart } from "./cart-service";
const db=prisma as jest.Mocked<typeof prisma>;
const store={id:"store_001",organizationId:"org_001",slug:"art",name:"Art"};
beforeEach(()=>{jest.clearAllMocks();(resolvePublishedStore as jest.Mock).mockResolvedValue(store)});
test("unknown guest token cannot query another person's cart",async()=>{
  const data=await getGuestCart({storeId:"store_001",rawToken:"invalid"});
  expect(data.items).toEqual([]);
  expect(db.cart.findFirst).not.toHaveBeenCalled();
});
test("every cart lookup is scoped to organization/store and hashed token",async()=>{
  (db.cart.findFirst as jest.Mock).mockResolvedValue(null);
  await getGuestCart({storeId:"store_001",rawToken:"a".repeat(32)});
  const options=(db.cart.findFirst as jest.Mock).mock.calls[0][0];
  expect(options.where).toMatchObject({organizationId:"org_001",storeId:"store_001"});
  expect(options.where.guestTokenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(options.where.guestTokenHash).not.toBe("a".repeat(32));
});
test("unpublished store cannot reach a cart",async()=>{
  (resolvePublishedStore as jest.Mock).mockRejectedValue({status:404});
  await expect(getGuestCart({storeId:"store_private",rawToken:"a".repeat(32)})).rejects.toMatchObject({status:404});
  expect(db.cart.findFirst).not.toHaveBeenCalled();
});

test("mutation cannot add a foreign merchant variant",async()=>{
  const transactionCart={findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()};
  const transactionVariants={findFirst:jest.fn().mockResolvedValue(null)};
  (db.$transaction as jest.Mock).mockImplementation(async (work:(tx:any)=>Promise<unknown>)=>work({
    cart:transactionCart,productVariant:transactionVariants,cartItem:{findUnique:jest.fn()},
  }));
  await expect(mutateGuestCart({
    storeId:"store_001",payload:{variantId:"foreign_variant",quantity:1},mode:"add",
  })).rejects.toMatchObject({status:404});
  expect(transactionVariants.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where:expect.objectContaining({ organizationId:"org_001",product:expect.objectContaining({
      listings:{some:{organizationId:"org_001",storeId:"store_001",status:"PUBLISHED"}},
    }) }),
  }));
  expect(transactionCart.create).not.toHaveBeenCalled();
});


test("removing an unpublished item never requires product publication",async()=>{
  const cart={findFirst:jest.fn().mockResolvedValue({id:"cart_001"}),create:jest.fn()};
  const variants={findFirst:jest.fn()};
  const items={findUnique:jest.fn().mockResolvedValue({id:"item_001",quantity:1}),deleteMany:jest.fn().mockResolvedValue({count:1})};
  (db.$transaction as jest.Mock).mockImplementation(async (work:(tx:any)=>Promise<unknown>)=>work({cart,productVariant:variants,cartItem:items}));
  (db.cart.findFirst as jest.Mock).mockResolvedValue(null);
  await mutateGuestCart({storeId:"store_001",rawToken:"a".repeat(32),mode:"set",payload:{variantId:"variant_001",quantity:0}});
  expect(variants.findFirst).not.toHaveBeenCalled();
  expect(items.deleteMany).toHaveBeenCalledWith({where:{organizationId:"org_001",cartId:"cart_001",variantId:"variant_001"}});
});
test("concurrent-style increment respects maximum line quantity",async()=>{
  const transactionCart={findFirst:jest.fn().mockResolvedValue({id:"cart_001"}),create:jest.fn()};
  const variant={id:"variant_001",name:"Print",fulfillment:"PHYSICAL",inventoryPolicy:"UNLIMITED",priceMinor:100,currency:"USD",active:true,
    inventory:[],digitalFiles:[],product:{id:"prod_001",title:"Print",status:"PUBLISHED",listings:[{status:"PUBLISHED"}]}};
  const items={findUnique:jest.fn().mockResolvedValue({id:"item_001",quantity:19}),update:jest.fn(),create:jest.fn()};
  (db.$transaction as jest.Mock).mockImplementation(async (work:(tx:any)=>Promise<unknown>)=>work({cart:transactionCart,productVariant:{findFirst:jest.fn().mockResolvedValue(variant)},cartItem:items}));
  await expect(mutateGuestCart({
    storeId:"store_001",rawToken:"a".repeat(32),payload:{variantId:"variant_001",quantity:2},mode:"add",
  })).rejects.toMatchObject({status:409});
  expect(items.update).not.toHaveBeenCalled();
  expect(items.create).not.toHaveBeenCalled();
});
