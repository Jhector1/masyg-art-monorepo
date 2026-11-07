/**
 * Boundary regression of the ACTUAL route handler functions, with in-memory
 * session, Prisma, provider, network and NextResponse test doubles. No server,
 * Stripe connection or database is used. Run from the repository root with:
 *   node --test packages/server/src/lib/http-boundary-security.test.mjs
 *
 * TypeScript transpilation is only to load the supplied TS handlers in node:test.
 * It is not a substitute for the normal TypeScript or Next.js build checks.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const serverSrc = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreSrc = resolve(serverSrc, "../../core/src/lib");
const routes = {
  orders: "api/public/stores/[storeId]/orders/route.ts",
  order: "api/public/stores/[storeId]/orders/[orderId]/route.ts",
  checkout: "api/public/stores/[storeId]/orders/by-session/route.ts",
  digital: "api/public/stores/[storeId]/my-digital-purchases/route.ts",
  download: "api/public/stores/[storeId]/downloads/[grantId]/route.ts",
  cron: "api/integrations/commerce/reconcile-stripe-test/route.ts",
};
function loadTS(file, imports, env = {}) {
  const source = readFileSync(file, "utf8");
  const transpiled = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  }, reportDiagnostics: true});
  if (transpiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`TypeScript transpilation failed: ${file}`);
  }
  const module = { exports: {} };
  const scopedRequire = (id) => {
    if (Object.hasOwn(imports, id)) return imports[id];
    if (id === "node:crypto") return require(id);
    throw new Error(`Unexpected module import in boundary test: ${id} (${file})`);
  };
  const sandbox = { module, exports: module.exports, require: scopedRequire,
    Response, Request, Headers, AbortSignal, Buffer, URL,
    console: {error: () => {}}, process: {env},
  };
  vm.runInNewContext(transpiled.outputText, sandbox, {filename:file, timeout:5000});
  return module.exports;
}
function errorClass(name) {
  return class extends Error {
    constructor(status=404, message="Not found") {super(message); this.name=name; this.status=status;}
  };
}
const TenantAccessError = errorClass("TenantAccessError");
const PublicCatalogError = errorClass("PublicCatalogError");
const BuyerDigitalAccessError = errorClass("BuyerDigitalAccessError");
const BuyerGrantError = errorClass("BuyerGrantError");
const CartSafetyError = errorClass("CartSafetyError");
const validateTenantId = value => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,128}$/.test(value)) throw new TenantAccessError();
  return value;
};
const tenancy = {TenantAccessError, validateTenantId};
function makeHarness({userId="buyer_a", host="a.shop.test"}={}) {
  const calls={host:[], orders:[], order:[], checkout:[], digital:[], grant:[], consume:0, fetch:0, spool:0, cron:0, prisma:[]};
  const organizations={store_a:"org_a",store_b:"org_b"};
  const fakeOrders=[
    {id:"order_a_1",storeId:"store_a",organizationId:"org_a",buyer:"buyer_a",status:"PAID",totalMinor:1100},
    {id:"order_a_2",storeId:"store_a",organizationId:"org_a",buyer:"buyer_b",status:"PAID",totalMinor:2200},
    {id:"order_b_1",storeId:"store_b",organizationId:"org_b",buyer:"buyer_a",status:"PAID",totalMinor:3300},
  ];
  const prisma={
    storefront:{
      findUnique:async ({where})=>{calls.prisma.push("storefront.findUnique");return organizations[where.id]?{organizationId:organizations[where.id]}:null;},
      findFirst:async ({where})=>{calls.prisma.push("storefront.findFirst");return where.published && organizations[where.id]?{organizationId:organizations[where.id]}:null;},
    },
    order:{
      findMany:async opts=>{calls.orders.push(opts);return fakeOrders.filter(o=>o.storeId===opts.where.storeId&&o.organizationId===opts.where.organizationId&&o.buyer===opts.where.customer.is.userId);},
      findFirst:async opts=>{calls.order.push(opts);return fakeOrders.find(o=>o.id===opts.where.id&&o.storeId===opts.where.storeId&&o.organizationId===opts.where.organizationId&&o.buyer===opts.where.customer.is.userId)||null;},
    },
    checkoutAttempt:{
      findFirst:async opts=>{
        calls.checkout.push(opts);
        if (opts.where.providerSessionId!=="cs_test_a_001"||opts.where.storeId!=="store_a"||opts.where.organizationId!=="org_a"||opts.where.order.customer.is.userId!=="buyer_a") return null;
        return {order:{id:"order_a_1",status:"PENDING",currency:"USD",totalMinor:1100,
          createdAt:new Date("2026-11-07T01:00:00Z"),shippingAddress:null,
          items:[{id:"line_a",titleSnapshot:"Digital art",fulfillment:"DIGITAL",quantity:1,totalMinor:1100}]}};
      },
    },
  };
  const orderService=loadTS(resolve(coreSrc,"customer-orders.ts"),{
    "@acme/core/lib/prisma":{prisma},"./tenancy":tenancy,
  });
  const checkoutService=loadTS(resolve(coreSrc,"customer-checkout-session.ts"),{
    "@acme/core/lib/prisma":{prisma},"./tenancy":tenancy,
  });
  const auth = {getServerSession:async()=>userId?{user:{id:userId}}:null};
  const hostLookup={resolvePublicStoreFromHostHeader:async incoming=>{
    calls.host.push(incoming);
    if(incoming==="a.shop.test") return {id:"store_a"};
    if(incoming==="b.shop.test") return {id:"store_b"};
    throw new PublicCatalogError(404);
  }};
  const digitalService={BuyerDigitalAccessError,listBuyerDigitalEntitlements:async args=>{
    calls.digital.push(args);
    return {purchases:[],userId:args.userId};
  }};
  const grantService={BuyerGrantError,
    authorizeBuyerGrant:async args=>{
      calls.grant.push(args);
      throw new BuyerGrantError(404);
    },
    consumeBuyerGrant:async()=>{calls.consume++;},
  };
  const requiredOrigin={requireSameOriginJson:req=>{
    if(req.headers.get("origin")!=="https://a.shop.test") throw new CartSafetyError(400);
  }};
  const next={NextResponse:{json:(body,opts)=>Response.json(body,opts)}};
  const shared={
    "next/server":next,"next-auth":auth,"@acme/core/lib/auth":{authOptions:{}},
    "@acme/core/lib/tenancy":tenancy,"@acme/core/lib/public-catalog":{PublicCatalogError},
    "@acme/core/lib/storefront-host":hostLookup,
    "@acme/core/lib/customer-orders":orderService,
    "@acme/core/lib/customer-checkout-session":checkoutService,
    "@acme/core/lib/buyer-digital-entitlements":digitalService,
    "@acme/core/lib/buyer-grant-download":grantService,
    "@acme/server/lib/public-request-guard":requiredOrigin,
    "@acme/core/lib/cart-contract":{CartSafetyError},
    "@acme/server/lib/private-digital-download":{
      parsePrivateDigitalStorageKey:()=>({extension:"zip"}),
      privateDigitalDownloadUrl:()=>"https://private.example.test/file",
      downloadFilename:()=>"art.zip",
    },
    "@acme/server/lib/private-download-spool":{
      PrivateDownloadSpoolError:errorClass("PrivateDownloadSpoolError"),
      spoolPrivateDownload:async()=>{calls.spool++;throw Error("spool must not run in negative tests");},
    },
  };
  const loadRoute = name=>loadTS(resolve(serverSrc,routes[name]),shared);
  const request=(incoming=host,options={})=>new Request(`https://${incoming}/api`,{
    method:options.method||"GET",
    headers:{host:incoming,...options.headers},
  });
  const ctx=(storeId="store_a", orderId="order_a_1",grantId="grant_a")=>({params:Promise.resolve({storeId,orderId,grantId})});
  return {calls,prisma,orderService,checkoutService,digitalService,grantService,loadRoute,request,ctx};
}
function assertPrivate(resp,status) {
  assert.equal(resp.status,status);
  assert.match(resp.headers.get("cache-control")||"", /no-store/);
  assert.equal(resp.headers.get("vary"),"Cookie");
}

test("order list: unauthenticated request fails before host and DB",async()=>{
  const h=makeHarness({userId:null});
  const resp=await h.loadRoute("orders").GET(h.request(),h.ctx());
  assertPrivate(resp,401);
  assert.equal(h.calls.host.length,0);
  assert.equal(h.calls.prisma.length,0);
});
test("order list: foreign storefront host gets 404 without order query",async()=>{
  const h=makeHarness();
  const resp=await h.loadRoute("orders").GET(h.request("b.shop.test"),h.ctx("store_a"));
  assertPrivate(resp,404);
  assert.equal(h.calls.orders.length,0);
});
test("order list: authenticated buyer sees only owned, organization-scoped orders",async()=>{
  const h=makeHarness();
  const resp=await h.loadRoute("orders").GET(h.request(),h.ctx());
  assertPrivate(resp,200);
  const data=await resp.json();
  assert.deepEqual(data.orders.map(o=>o.id),["order_a_1"]);
  assert.equal(h.calls.orders.length,1);
  assert.equal(h.calls.orders[0].where.organizationId,"org_a");
  assert.equal(h.calls.orders[0].where.storeId,"store_a");
  assert.equal(h.calls.orders[0].where.customer.is.userId,"buyer_a");
});
test("order detail: buyer B cannot read buyer A order",async()=>{
  const h=makeHarness({userId:"buyer_b"});
  const resp=await h.loadRoute("order").GET(h.request(),h.ctx("store_a","order_a_1"));
  assertPrivate(resp,404);
  assert.equal(h.calls.order[0].where.customer.is.userId,"buyer_b");
});
test("order detail: cross-store host and cross-store order are denied",async()=>{
  const h=makeHarness();
  const handler=h.loadRoute("order");
  assertPrivate(await handler.GET(h.request("b.shop.test"),h.ctx("store_a","order_a_1")),404);
  assert.equal(h.calls.order.length,0);
  assertPrivate(await handler.GET(h.request(),h.ctx("store_a","order_b_1")),404);
  assert.equal(h.calls.order[0].where.organizationId,"org_a");
});
test("order detail: anonymous request cannot query store",async()=>{
  const h=makeHarness({userId:null});
  assertPrivate(await h.loadRoute("order").GET(h.request(),h.ctx()),401);
  assert.equal(h.calls.prisma.length,0);
});
test("My Art: anonymous and foreign-host requests cannot reach purchase catalog",async()=>{
  const anon=makeHarness({userId:null});
  assertPrivate(await anon.loadRoute("digital").GET(anon.request(),anon.ctx()),401);
  assert.equal(anon.calls.digital.length,0);
  const foreign=makeHarness();
  assertPrivate(await foreign.loadRoute("digital").GET(foreign.request("b.shop.test"),foreign.ctx()),404);
  assert.equal(foreign.calls.digital.length,0);
});
test("My Art: authenticated request passes verified buyer and store only",async()=>{
  const h=makeHarness();
  const resp=await h.loadRoute("digital").GET(h.request(),h.ctx());
  assertPrivate(resp,200);
  assert.equal(h.calls.digital.length,1);
  assert.equal(h.calls.digital[0].userId,"buyer_a");
  assert.equal(h.calls.digital[0].storeId,"store_a");
});
test("My Art: downstream forbidden purchase query stays private",async()=>{
  const h=makeHarness();
  h.digitalService.listBuyerDigitalEntitlements=async()=>{throw new BuyerDigitalAccessError(404)};
  assertPrivate(await h.loadRoute("digital").GET(h.request(),h.ctx()),404);
});
test("checkout status: anonymous and foreign-host requests never query payment",async()=>{
  const anonymous=makeHarness({userId:null});
  const anonReq=anonymous.request();anonReq.nextUrl=new URL("https://a.shop.test/?session_id=cs_test_a_001");
  assertPrivate(await anonymous.loadRoute("checkout").GET(anonReq,anonymous.ctx()),401);
  assert.equal(anonymous.calls.checkout.length,0);
  const foreign=makeHarness();
  const req=foreign.request("b.shop.test");req.nextUrl=new URL("https://b.shop.test/?session_id=cs_test_a_001");
  assertPrivate(await foreign.loadRoute("checkout").GET(req,foreign.ctx()),404);
  assert.equal(foreign.calls.checkout.length,0);
});
test("checkout status: buyer B cannot use buyer A session URL",async()=>{
  const h=makeHarness({userId:"buyer_b"});
  const req=h.request();req.nextUrl=new URL("https://a.shop.test/?session_id=cs_test_a_001");
  const resp=await h.loadRoute("checkout").GET(req,h.ctx());
  assertPrivate(resp,404);
  assert.equal(h.calls.checkout[0].where.order.customer.is.userId,"buyer_b");
});
test("checkout status: pending redirect stays pending without granting access",async()=>{
  const h=makeHarness();
  const req=h.request();req.nextUrl=new URL("https://a.shop.test/?session_id=cs_test_a_001");
  const resp=await h.loadRoute("checkout").GET(req,h.ctx());
  assertPrivate(resp,200);
  const data=await resp.json();
  assert.equal(data.status,"PENDING");
  assert.equal(data.processing,true);
  assert.equal(h.calls.grant.length,0);
  assert.equal(h.calls.consume,0);
  assert.equal(h.calls.fetch,0);
  assert.doesNotMatch(JSON.stringify(data),/storageKey|tokenHash|providerPaymentId/);
});
test("download: bad origin fails before auth, grant and storage fetch",async()=>{
  const h=makeHarness();
  const req=h.request("a.shop.test",{method:"POST",headers:{origin:"https://foreign.test"}});
  const resp=await h.loadRoute("download").POST(req,h.ctx());
  assert.equal(resp.status,400);
  assert.match(resp.headers.get("cache-control")||"",/no-store/);
  assert.equal(h.calls.grant.length,0);
  assert.equal(h.calls.spool,0);
});
test("download: authenticated host still required, cannot use foreign-store grant",async()=>{
  const h=makeHarness();
  const req=h.request("b.shop.test",{method:"POST",headers:{origin:"https://a.shop.test"}});
  const resp=await h.loadRoute("download").POST(req,h.ctx());
  assert.equal(resp.status,404);
  assert.equal(h.calls.grant.length,0);
});
test("download: anonymous request cannot access grants",async()=>{
  const h=makeHarness({userId:null});
  const req=h.request("a.shop.test",{method:"POST",headers:{origin:"https://a.shop.test"}});
  const resp=await h.loadRoute("download").POST(req,h.ctx());
  assert.equal(resp.status,401);
  assert.equal(h.calls.grant.length,0);
});
test("download: revoked or foreign-user grant is masked and never fetched",async()=>{
  const h=makeHarness();
  const req=h.request("a.shop.test",{method:"POST",headers:{origin:"https://a.shop.test"}});
  const resp=await h.loadRoute("download").POST(req,h.ctx());
  assert.equal(resp.status,404);
  assert.equal(h.calls.grant.length,1);
  assert.equal(h.calls.grant[0].userId,"buyer_a");
  assert.equal(h.calls.grant[0].storeId,"store_a");
  assert.equal(h.calls.grant[0].grantId,"grant_a");
  assert.equal(h.calls.consume,0);
  assert.equal(h.calls.spool,0);
});
test("cron: no or wrong bearer cannot invoke recovery",async()=>{
  const file=resolve(serverSrc,"lib/commerce-cron-auth.ts");
  const auth=loadTS(file,{});
  let invoked=0;
  const secret="x".repeat(48);
  const handler=loadTS(resolve(serverSrc,routes.cron),{
    "../../../../lib/commerce-cron-auth":auth,
    "../../../../payments/stripe-test-recovery-job":{reconcileLostStripeTestPayments:async()=>{invoked++;return {scanned:0,recovered:0,errors:0,providerUnavailable:0};}},
  },{ZILEDIGITAL_COMMERCE_CRON_SECRET:secret});
  for(const token of [null,"Bearer wrong","Bearer "+"y".repeat(48),"Basic "+secret]){
    const resp=await handler.POST({headers:{get:()=>token}});
    assert.equal(resp.status,401);
    assert.match(resp.headers.get("cache-control")||"",/no-store/);
  }
  assert.equal(invoked,0);
});
test("cron: exact bearer succeeds only once per explicit invocation",async()=>{
  const auth=loadTS(resolve(serverSrc,"lib/commerce-cron-auth.ts"),{});
  let invoked=0;
  const secret="a".repeat(48);
  const handler=loadTS(resolve(serverSrc,routes.cron),{
    "../../../../lib/commerce-cron-auth":auth,
    "../../../../payments/stripe-test-recovery-job":{reconcileLostStripeTestPayments:async limit=>{assert.equal(limit,10);invoked++;return {scanned:0,recovered:0,errors:0,providerUnavailable:0};}},
  },{ZILEDIGITAL_COMMERCE_CRON_SECRET:secret});
  const resp=await handler.POST({headers:{get:()=>`Bearer ${secret}`}});
  assert.equal(resp.status,200);
  assert.equal(invoked,1);
});
test("cron: insufficient configured secret always fails closed",async()=>{
  const auth=loadTS(resolve(serverSrc,"lib/commerce-cron-auth.ts"),{});
  const handler=loadTS(resolve(serverSrc,routes.cron),{
    "../../../../lib/commerce-cron-auth":auth,
    "../../../../payments/stripe-test-recovery-job":{reconcileLostStripeTestPayments:async()=>{throw new Error("must not invoke")}},
  },{ZILEDIGITAL_COMMERCE_CRON_SECRET:"short"});
  assert.equal((await handler.POST({headers:{get:()=>"Bearer short"}})).status,401);
});
