import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMerchantPrincipal } from '@/lib/merchant-session';
import { merchantHttpError } from '@/lib/merchant-http';
import {
  getMerchantCatalogOptionGroups, createMerchantCatalogOptionGroup,
  addMerchantCatalogOptionValues, setMerchantOfferingOptionGroup,
} from '@acme/core/lib/merchant-catalog-options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ organizationId: string; productId: string }> };
const values = z.array(z.string().min(1).max(100)).min(1).max(200);
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().min(1).max(80), values }).strict(),
  z.object({ action: z.literal('addValues'), groupId: z.string().min(1), values }).strict(),
  z.object({ action: z.literal('link'), groupId: z.string().min(1), offeringId: z.string().min(1), required: z.boolean().optional() }).strict(),
  z.object({ action: z.literal('unlink'), groupId: z.string().min(1), offeringId: z.string().min(1) }).strict(),
]);

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await ctx.params;
    const storeId = request.nextUrl.searchParams.get('storeId');
    if (!storeId) return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    return NextResponse.json(
      await getMerchantCatalogOptionGroups({ userId, organizationId, productId, storeId }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) { return merchantHttpError(error); }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await ctx.params;
    const input = action.parse(await request.json());
    let output;
    if (input.action === 'create') {
      output = await createMerchantCatalogOptionGroup({ userId, organizationId, productId, name: input.name, values: input.values });
    } else if (input.action === 'addValues') {
      output = await addMerchantCatalogOptionValues({ userId, organizationId, productId, groupId: input.groupId, values: input.values });
    } else {
      output = await setMerchantOfferingOptionGroup({
        userId, organizationId, productId, groupId: input.groupId, offeringId: input.offeringId,
        linked: input.action === 'link', required: input.action === 'link' ? input.required : false,
      });
    }
    return NextResponse.json(output, { status: input.action === 'create' ? 201 : 200, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return merchantHttpError(error); }
}
