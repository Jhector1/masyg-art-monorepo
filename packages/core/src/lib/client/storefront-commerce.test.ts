/** No provider credentials, payments or merchant IDs belong in a storefront transport. */
import { storefrontApiPath, listStoreProducts, addStoreVariant } from "./storefront-commerce";

test("canonical paths are store-scoped, with no legacy endpoint escape", () => {
  expect(storefrontApiPath("store_123", "products")).toBe("/api/public/stores/store_123/products");
  expect(storefrontApiPath("store_123", "checkout/preflight")).toBe("/api/public/stores/store_123/checkout/preflight");
  expect(() => storefrontApiPath("../other", "cart")).toThrow();
  expect(() => storefrontApiPath("store_123", "../checkout")).toThrow();
});

test("catalog encodes search text rather than allowing path manipulation", async () => {
  const old = global.fetch;
  const mock = jest.fn(async () => ({ok: true, json: async () => ({store:{id:"store_123",slug:"store",name:"Store"},page:1,products:[]})}));
  global.fetch = mock as unknown as typeof fetch;
  try {
    await listStoreProducts("store_123", {q:"art & nature"});
    expect(mock).toHaveBeenCalledWith("/api/public/stores/store_123/products?q=art+%26+nature", expect.objectContaining({cache:"no-store",credentials:"same-origin"}));
  } finally {global.fetch = old;}
});

test("cart submits variant and quantity only; never trusts client prices", async () => {
  const old = global.fetch;
  const mock = jest.fn(async () => ({ok:true,json:async()=>({items:[],currency:null,subtotalMinor:0,issues:[],readyForCheckout:false,note:""})}));
  global.fetch = mock as unknown as typeof fetch;
  try {
    await addStoreVariant("store_123", "variant_456", 2);
    const [url, init] = mock.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe("/api/public/stores/store_123/cart");
    expect(JSON.parse(String(init.body))).toEqual({variantId:"variant_456",quantity:2});
  } finally {global.fetch=old;}
});


test("current storefront resolution uses a fixed, verified-host endpoint", async()=>{
  const {getCurrentStorefront}=await import("./storefront-commerce");
  const oldFetch=global.fetch;
  const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({store:{id:"store_001",name:"Art",slug:"art"}})});
  global.fetch=fetchMock as typeof fetch;
  try {
    await expect(getCurrentStorefront()).resolves.toMatchObject({store:{id:"store_001"}});
    expect(fetchMock).toHaveBeenCalledWith("/api/public/store-context",expect.objectContaining({credentials:"same-origin",cache:"no-store"}));
  }finally{global.fetch=oldFetch;}
});
test("single-order client only uses canonical store-scoped URLs", async()=>{
  const {getStoreOrder}=await import("./storefront-commerce");
  const oldFetch=global.fetch;
  const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({order:{id:"order_001"}})});
  global.fetch=fetchMock as typeof fetch;
  try{
    await getStoreOrder("store_001","order_001");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/public/stores/store_001/orders/order_001");
    expect(() => getStoreOrder("store_001","../../other")).toThrow("Invalid order ID");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }finally{global.fetch=oldFetch;}
});


test("digital grant downloads are same-origin POST with verified IDs and no caller URL", async () => {
  const {downloadStoreGrant} = await import("./storefront-commerce");
  const oldFetch=global.fetch;
  const calls: unknown[][]=[];
  const mock=jest.fn(async (url: string, init: RequestInit) => {
    calls.push([url,init]);
    return {
      ok:true,
      status:200,
      headers:{get:(header:string)=>header==="content-disposition"?'attachment; filename="artwork.pdf"':null},
      blob:async()=>new Blob(["test-file"]),
    };
  });
  global.fetch=mock as unknown as typeof fetch;
  try {
    const result=await downloadStoreGrant("store_123","grant_456");
    expect(result.filename).toBe("artwork.pdf");
    expect(calls[0][0]).toBe("/api/public/stores/store_123/downloads/grant_456");
    expect(calls[0][1]).toEqual(expect.objectContaining({method:"POST",credentials:"same-origin",cache:"no-store",body:"{}"}));
    await expect(downloadStoreGrant("store_123","../../evil")).rejects.toThrow("Invalid storefront ID");
    expect(mock).toHaveBeenCalledTimes(1);
  } finally {global.fetch=oldFetch;}
});


test("favorites use verified-store URLs and only send product IDs", async () => {
  const {listStoreFavorites,setStoreFavorite}=await import("./storefront-commerce");
  const oldFetch=global.fetch;
  const mock=jest.fn(async (_url: string, _init?: RequestInit)=>({ok:true,json:async()=>({store:{id:"store_123"},favorites:[],products:[]})}));
  global.fetch=mock as unknown as typeof fetch;
  try{
    await listStoreFavorites("store_123");
    expect(mock.mock.calls[0][0]).toBe("/api/public/stores/store_123/favorites");
    await setStoreFavorite("store_123","prod_001",true);
    const [path,init]=mock.mock.calls[1] as unknown as [string,RequestInit];
    expect(path).toBe("/api/public/stores/store_123/favorites");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({productId:"prod_001"});
    expect(()=>setStoreFavorite("store_123","../forged",false)).toThrow("Invalid product ID");
    expect(mock).toHaveBeenCalledTimes(2);
  }finally{global.fetch=oldFetch;}
});
