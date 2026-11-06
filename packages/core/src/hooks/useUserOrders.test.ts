import {ordersToCollection,selectFlat} from "./useUserOrders";
import type {BuyerOrder} from "../lib/client/storefront-commerce";
const paid:BuyerOrder={id:"order_001",status:"PAID",currency:"USD",subtotalMinor:1200,taxMinor:0,shippingMinor:0,totalMinor:1200,createdAt:"2026-11-03T12:00:00.000Z",items:[{id:"item_001",titleSnapshot:"Art",skuSnapshot:null,fulfillment:"DIGITAL",quantity:1,unitPriceMinor:1200,totalMinor:1200,variant:{productId:"prod_001"}}]};
test("only settled orders become purchased collection items",()=>{
 const pending={...paid,id:"order_002",status:"PENDING"};
 const all=selectFlat(ordersToCollection([pending,paid]));
 expect(all).toHaveLength(1);
 expect(all[0]).toMatchObject({id:"item_001",price:12,currency:"USD",order:{id:"order_001",status:"PAID"},product:{id:"prod_001"}});
 expect(all[0].digital?.tokens).toEqual([]);
});
test("zero-decimal currency is represented in major units",()=>{
 const row={...paid,currency:"JPY",items:[{...paid.items[0],unitPriceMinor:400}]};
 expect(selectFlat(ordersToCollection([row]))[0].price).toBe(400);
});
