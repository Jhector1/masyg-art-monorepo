jest.mock("./cart-service",()=>({getGuestCart:jest.fn()}));
import { getGuestCart } from "./cart-service";
import { getCheckoutPreflight } from "./checkout-preflight";
import { quoteLines } from "./cart-contract";
beforeEach(()=>jest.clearAllMocks());
test("preflight delegates tenant lookup to the canonical cart service",async()=>{
  (getGuestCart as jest.Mock).mockResolvedValue(quoteLines([]));
  await getCheckoutPreflight({storeId:"store_001",rawToken:"secret",contact:{email:"buyer@example.com"}});
  expect(getGuestCart).toHaveBeenCalledWith({storeId:"store_001",rawToken:"secret"});
});
test("invalid contact is rejected before a database lookup",async()=>{
  await expect(getCheckoutPreflight({storeId:"store_001",contact:{email:"bad",priceMinor:1}})).rejects.toBeDefined();
  expect(getGuestCart).not.toHaveBeenCalled();
});
test("store authorization error is never converted into an empty success",async()=>{
  (getGuestCart as jest.Mock).mockRejectedValue({status:404,message:"Not found"});
  await expect(getCheckoutPreflight({storeId:"foreign_store"})).rejects.toMatchObject({status:404});
});
