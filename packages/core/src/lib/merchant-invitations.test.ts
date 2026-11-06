jest.mock("@acme/core/lib/prisma", () => ({ prisma: { $transaction: jest.fn(), staffInvitation: { findMany: jest.fn() } } }));
jest.mock("./tenancy", () => ({
  requireMerchantAccess: jest.fn(), validateTenantId: (x: string) => x,
  TenantAccessError: class TenantAccessError extends Error { constructor(public status = 404, message = "Not found") { super(message); } },
}));
import { prisma } from "@acme/core/lib/prisma";
import { requireMerchantAccess } from "./tenancy";
import { invitationInput, createMerchantInvitation, acceptMerchantInvitation, revokeMerchantInvitation } from "./merchant-invitations";
const access = requireMerchantAccess as jest.Mock;
const token = "a".repeat(43);
const now = new Date();
const future = new Date(Date.now() + 86400000);
function txMock() { return {
  organizationMember: { findUnique: jest.fn().mockResolvedValue({role:"OWNER"}), create: jest.fn() },
  storeMember: {create: jest.fn()},
  user: { findUnique: jest.fn().mockResolvedValue(null) },
  staffInvitation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({id:"invite_1"}),
    count: jest.fn().mockResolvedValue(0), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({count:1}), findFirst: jest.fn().mockResolvedValue({id:"invite_1"}) },
  storefront: {findFirst:jest.fn().mockResolvedValue({id:"store_1"})},
  merchantAuditLog:{create:jest.fn()},
}; }
beforeEach(()=>{jest.clearAllMocks();access.mockResolvedValue({organizationId:"org_1",role:"OWNER"});});
it("validates input; forbids platform role and tampered fields",()=>{
  expect(invitationInput.safeParse({email:"a@example.com",role:"PLATFORM_ADMIN"}).success).toBe(false);
  expect(invitationInput.safeParse({email:"a@example.com",role:"ADMIN", actorUserId:"other"}).success).toBe(false);
});
it("creates only a hash and no staff grant before email acceptance",async()=>{
  const tx=txMock();(prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  const result=await createMerchantInvitation("owner_1","org_1",{email:"Target@Example.com",role:"MEMBER",storeId:"store_1"});
  expect(result.token).toMatch(/^[A-Za-z0-9_-]{40,90}$/);
  expect(tx.staffInvitation.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({email:"target@example.com",role:"MEMBER"})}));
  const data=tx.staffInvitation.create.mock.calls[0][0].data;
  expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(data.tokenHash).not.toBe(result.token);
  expect(tx.organizationMember.create).not.toHaveBeenCalled();
  expect(tx.storeMember.create).not.toHaveBeenCalled();
});
it("blocks duplicate live invitations for the same organization and email",async()=>{
  const tx=txMock();tx.staffInvitation.findUnique.mockResolvedValue({id:"invite_old",expiresAt:future,deliveryStatus:"SENT"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await expect(createMerchantInvitation("owner_1","org_1",{email:"t@example.com",role:"ADMIN"})).rejects.toThrow(/active invitation/);
  expect(tx.staffInvitation.create).not.toHaveBeenCalled();
});
it("rejects acceptance when the signed-in email differs",async()=>{
  const tx=txMock();tx.user.findUnique.mockResolvedValue({id:"user_1",email:"intruder@example.com"});
  tx.staffInvitation.findUnique.mockResolvedValue({id:"invite_1",organizationId:"org_1",email:"target@example.com",role:"ADMIN",storeId:null,expiresAt:future,acceptedAt:null,revokedAt:null,deliveryStatus:"SENT"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await expect(acceptMerchantInvitation("user_1",{token})).rejects.toMatchObject({status:403});
  expect(tx.organizationMember.create).not.toHaveBeenCalled();
});
it("accepts once and grants only the selected viewer store",async()=>{
  const tx=txMock();tx.user.findUnique.mockResolvedValue({id:"user_1",email:"target@example.com"});
  tx.organizationMember.findUnique.mockResolvedValue(null);
  tx.staffInvitation.findUnique.mockResolvedValue({id:"invite_1",organizationId:"org_1",email:"target@example.com",role:"MEMBER",storeId:"store_1",expiresAt:future,acceptedAt:null,revokedAt:null,deliveryStatus:"SENT"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  const result=await acceptMerchantInvitation("user_1",{token});
  expect(result).toEqual({accepted:true,organizationId:"org_1",role:"MEMBER"});
  expect(tx.storeMember.create).toHaveBeenCalledWith({data:{organizationId:"org_1",storeId:"store_1",userId:"user_1",role:"VIEWER"}});
  expect(tx.staffInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({acceptedAt:null,revokedAt:null,deliveryStatus:"SENT"})}));
  expect(tx.merchantAuditLog.create).toHaveBeenCalledTimes(1);
});
it("fails if the invitation has been revoked",async()=>{
  const tx=txMock();tx.user.findUnique.mockResolvedValue({id:"user_1",email:"target@example.com"});
  tx.staffInvitation.findUnique.mockResolvedValue({id:"invite_1",organizationId:"org_1",email:"target@example.com",role:"ADMIN",expiresAt:future,acceptedAt:null,revokedAt:now,deliveryStatus:"SENT"});
  (prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await expect(acceptMerchantInvitation("user_1",{token})).rejects.toMatchObject({status:404});
});
it("revocation clears active key and logs it atomically",async()=>{
  const tx=txMock();(prisma.$transaction as jest.Mock).mockImplementation(fn=>fn(tx));
  await revokeMerchantInvitation("owner_1","org_1","invite_1");
  expect(tx.staffInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({activeKey:null})}));
  expect(tx.merchantAuditLog.create).toHaveBeenCalledTimes(1);
});
