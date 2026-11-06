jest.mock("@acme/core/lib/prisma", () => ({ prisma: { $transaction: jest.fn(), customer: { findFirst: jest.fn() }, customerNote: {findMany:jest.fn()} } }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess:jest.fn(),validateTenantId:(x:string)=>x,
  TenantAccessError:class TenantAccessError extends Error {status=404;},
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { customerNoteInput, addMerchantCustomerNote, listMerchantCustomerNotes } from "./merchant-customer-notes";
const args={userId:"owner_1",organizationId:"org_1",storeId:"store_1",customerId:"customer_1"};
function tx(){return { organizationMember:{findUnique:jest.fn().mockResolvedValue({role:"OWNER"})},
  customer:{findFirst:jest.fn().mockResolvedValue({id:"customer_1"})},
  customerNote:{create:jest.fn().mockResolvedValue({id:"note_1",body:"Call tomorrow"})},
  merchantAuditLog:{create:jest.fn()},};}
beforeEach(()=>{jest.clearAllMocks();(requireMerchantAccess as jest.Mock).mockResolvedValue({organizationId:"org_1",storeId:"store_1",role:"OWNER"});
  (prisma.customer.findFirst as jest.Mock).mockResolvedValue({id:"customer_1"});});
it("rejects blank and overly long notes",()=>{
  expect(customerNoteInput.safeParse({body:"  "}).success).toBe(false);
  expect(customerNoteInput.safeParse({body:"x".repeat(2001)}).success).toBe(false);
});
it("does not expose customer notes outside the selected storefront",async()=>{
  (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(listMerchantCustomerNotes(args)).rejects.toMatchObject({status:404});
  expect(prisma.customerNote.findMany).not.toHaveBeenCalled();
});
it("writes scoped note and audit in the same transaction",async()=>{
  const mock=tx();(prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await addMerchantCustomerNote({...args,body:{body:" Call tomorrow "}});
  expect(mock.customerNote.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({organizationId:"org_1",storeId:"store_1",customerId:"customer_1",body:"Call tomorrow"})}));
  expect(mock.merchantAuditLog.create).toHaveBeenCalledTimes(1);
});
it("rechecks membership before writing",async()=>{
  const mock=tx();mock.organizationMember.findUnique.mockResolvedValue({role:"MEMBER"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(mock));
  await expect(addMerchantCustomerNote({...args,body:{body:"hello"}})).rejects.toMatchObject({status:404});
  expect(mock.customerNote.create).not.toHaveBeenCalled();
});
