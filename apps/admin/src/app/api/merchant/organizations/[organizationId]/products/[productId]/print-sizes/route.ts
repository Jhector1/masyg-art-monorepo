import { NextRequest, NextResponse } from 'next/server';
import { requireMerchantPrincipal } from '@/lib/merchant-session';
import { merchantHttpError } from '@/lib/merchant-http';
import { createMerchantPrintSizes, listMerchantPrintSizes } from '@acme/core/lib/merchant-print-sizes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ organizationId: string; productId: string }> };

/** Listing-scoped read; does not expose another store's inventory/catalog. */
export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await ctx.params;
    const storeId = request.nextUrl.searchParams.get('storeId');
    if (!storeId) return NextResponse.json({ error: 'Store context required' }, { status: 400 });
    const data = await listMerchantPrintSizes({ userId, organizationId, productId, storeId });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return merchantHttpError(error); }
}

/** One atomic batch; variants never become live until separately activated. */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const userId = await requireMerchantPrincipal();
    const { organizationId, productId } = await ctx.params;
    const result = await createMerchantPrintSizes({ userId, organizationId, productId, input: await request.json() });
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return merchantHttpError(error); }
}
