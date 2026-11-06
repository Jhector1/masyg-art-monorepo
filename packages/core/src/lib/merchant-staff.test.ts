jest.mock("@acme/core/lib/prisma", () => ({ prisma: { $transaction: jest.fn(), organizationMember: { findMany: jest.fn() } } }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(), validateTenantId: (x: string) => x,
  TenantAccessError: class TenantAccessError extends Error { status = 404; },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { addMerchantStaff, removeMerchantStaff, updateMerchantStaffRole, listMerchantStaff, staffAddInput } from "./merchant-staff";
function transactionMock() {
  return {
    organizationMember: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(2) },
    storeMember: { create: jest.fn(),deleteMany:jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue({id:"user_target",email:"target@example.com",name:"Target"}) },
    storefront: {findFirst: jest.fn().mockResolvedValue({id:"store_1"})},
    merchantAuditLog: {create:jest.fn()},
  };
}
const access = requireMerchantAccess as jest.Mock;
beforeEach(() => {
  jest.clearAllMocks(); access.mockResolvedValue({organizationId:"org_1",role:"OWNER"});
});
it("validates role and email input before touching database", () => {
  expect(staffAddInput.safeParse({ email:"bad",role:"OWNER" }).success).toBe(false);
  expect(staffAddInput.safeParse({ email:"x@y.com",role:"PLATFORM_ADMIN" }).success).toBe(false);
});
it("adds existing member with selected storefront viewer grant and audit in transaction",async()=>{
  const tx=transactionMock();
  tx.organizationMember.findUnique.mockResolvedValueOnce({role:"OWNER"}).mockResolvedValueOnce(null);
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  const result=await addMerchantStaff("user_actor","org_1",{ email:"TARGET@EXAMPLE.COM", role:"MEMBER", storeId:"store_1" });
  expect(result).toEqual({userId:"user_target",email:"target@example.com",role:"MEMBER"});
  expect(tx.storeMember.create).toHaveBeenCalledWith({data:{organizationId:"org_1",storeId:"store_1",userId:"user_target",role:"VIEWER"}});
  expect(tx.merchantAuditLog.create).toHaveBeenCalledTimes(1);
  expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function),expect.objectContaining({isolationLevel:"Serializable"}));
});
it("rejects non-owner even when prior HTTP request had admin membership",async()=>{
  const tx=transactionMock();tx.organizationMember.findUnique.mockResolvedValueOnce({role:"ADMIN"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await expect(addMerchantStaff("user_actor","org_1",{email:"target@example.com",role:"ADMIN"})).rejects.toMatchObject({status:404});
  expect(tx.organizationMember.create).not.toHaveBeenCalled();
});
it("refuses removal of current owner",async()=>{
  const tx=transactionMock();tx.organizationMember.findUnique.mockResolvedValueOnce({role:"OWNER"}).mockResolvedValueOnce({role:"OWNER"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await expect(removeMerchantStaff("user_actor","org_1","user_actor")).rejects.toThrow(/Another owner/);
  expect(tx.organizationMember.delete).not.toHaveBeenCalled();
});
it("refuses removal of last remaining owner",async()=>{
  const tx=transactionMock();tx.organizationMember.findUnique.mockResolvedValueOnce({role:"OWNER"}).mockResolvedValueOnce({role:"OWNER"});
  tx.organizationMember.count.mockResolvedValue(1);(prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await expect(removeMerchantStaff("user_actor","org_1","user_target")).rejects.toThrow(/last organization owner/);
  expect(tx.organizationMember.delete).not.toHaveBeenCalled();
});
it("removes member with grants and writes audit in same transaction",async()=>{
  const tx=transactionMock();tx.organizationMember.findUnique.mockResolvedValueOnce({role:"OWNER"}).mockResolvedValueOnce({role:"MEMBER"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await removeMerchantStaff("user_actor","org_1","user_target");
  expect(tx.storeMember.deleteMany).toHaveBeenCalledWith({where:{organizationId:"org_1",userId:"user_target"}});
  expect(tx.organizationMember.delete).toHaveBeenCalledTimes(1);
  expect(tx.merchantAuditLog.create).toHaveBeenCalledTimes(1);
});
it("downgrading to viewer revokes old grants before issuing only a selected viewer grant",async()=>{
  const tx=transactionMock();tx.organizationMember.findUnique.mockResolvedValueOnce({role:"OWNER"}).mockResolvedValueOnce({role:"ADMIN"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await updateMerchantStaffRole("user_actor","org_1","user_target",{role:"MEMBER",storeId:"store_1"});
  expect(tx.storeMember.deleteMany).toHaveBeenCalledTimes(1);
  expect(tx.storeMember.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({role:"VIEWER",storeId:"store_1"})}));
});
it("staff listing requires org management permission",async()=>{
  (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([]);
  await listMerchantStaff("user_actor","org_1");
  expect(access).toHaveBeenCalledWith(expect.objectContaining({capability:"manage",organizationId:"org_1"}));
  expect(prisma.organizationMember.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:"org_1"}}));
});
