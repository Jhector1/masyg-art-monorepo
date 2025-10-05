/**
 * Tests for POST /api/stripe/webhook/route.ts
 */
import { makeNextRequest } from '@acme/core/test/helpers/next';
import { POST } from '../route';
import { stripe } from '@acme/core/lib/stripe';
import { PrismaClient, VariantType } from '@prisma/client';

jest.mock('@/lib/stripe');
jest.mock('@prisma/client');

const prisma = new PrismaClient() as any;

const asJson = async (res: any) => {
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; }
  catch { return { status: res.status, text }; }
};

// Helpers to craft event + line items
function makeCheckoutCompletedEvent(opts: Partial<any> = {}) {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_123',
        amount_total: 12345,
        metadata: {},
        ...opts.session,
      },
    },
  };
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Default successful constructEvent
    (stripe.webhooks.constructEvent as jest.Mock).mockImplementation((_buf, _sig, _secret) => {
      return makeCheckoutCompletedEvent();
    });

    // Default listLineItems empty
    (stripe.checkout.sessions.listLineItems as jest.Mock).mockResolvedValue({ data: [] });

    // Prisma defaults
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockResolvedValue({ id: 'ord_1' });
    prisma.cartItem.findMany.mockResolvedValue([]);
    prisma.orderItem.create.mockResolvedValue({});
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });
  });

  test('400 when signature invalid', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error('bad signature');
    });

    const req = makeNextRequest('https://api/stripe/webhook', {
      method: 'POST',
      body: 'raw-body',
      headersObj: { 'stripe-signature': 'nope' },
    });

    const res = await POST(req as any);
    const data = await asJson(res);
    expect(data.status).toBe(400);
    expect(String(data.text)).toMatch(/Webhook Error/);
  });

  test('200 and early exit for non checkout.session.completed', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({ type: 'customer.created' });

    const req = makeNextRequest('https://api/stripe/webhook', {
      method: 'POST',
      body: 'raw',
      headersObj: { 'stripe-signature': 'sig' },
    });

    const res = await POST(req as any);
    const data = await asJson(res);
    expect(data.status).toBe(200);
    expect(data.json.received).toBe(true);
  });

  test('400 when missing both userId and guestId in session metadata', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeCheckoutCompletedEvent({ session: { metadata: {} } })
    );

    const req = makeNextRequest('https://api/stripe/webhook', {
      method: 'POST',
      body: 'raw',
      headersObj: { 'stripe-signature': 'sig' },
    });

    const res = await POST(req as any);
    const data = await asJson(res);
    expect(data.status).toBe(400);
    expect(String(data.text)).toMatch(/Missing customer identity/);
  });

  test('idempotency: if order exists for session, exit 200 received', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeCheckoutCompletedEvent({ session: { id: 'cs_ABC', metadata: { userId: 'u_1' } } })
    );
    prisma.order.findFirst.mockResolvedValue({ id: 'already' });

    const req = makeNextRequest('https://api/stripe/webhook', {
      method: 'POST',
      body: 'raw',
      headersObj: { 'stripe-signature': 'sig' },
    });

    const res = await POST(req as any);
    const data = await asJson(res);
    expect(data.status).toBe(200);
    expect(data.json.received).toBe(true);
    // no writes
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  test('collects cartItemIds from price/product metadata and session CSV; creates order & deletes purchased cart items', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeCheckoutCompletedEvent({
        session: {
          id: 'cs_lin',
          amount_total: 2000,
          metadata: { userId: 'u_9', cartItemIds: 'ci_2,ci_3' },
        },
      })
    );

    (stripe.checkout.sessions.listLineItems as jest.Mock).mockResolvedValue({
      data: [
        {
          quantity: 2,
          amount_subtotal: 3000,
          price: {
            metadata: { cartItemId: 'ci_1', productId: 'prod_A', variantType: 'DIGITAL', digitalVariantId: 'dv_A' },
            product: { metadata: {} },
          },
        },
        {
          quantity: 1,
          amount_subtotal: 5000,
          price: {
            metadata: {}, // no cartItemId here
            product: { metadata: { productId: 'prod_B', variantType: 'PRINT', printVariantId: 'pv_B' } },
          },
        },
      ],
    });

    prisma.cartItem.findMany.mockResolvedValue([
      { id: 'ci_1', cartId: 'cart', productId: 'prod_A', price: 15, quantity: 2, digitalVariantId: 'dv_A', printVariantId: null },
      { id: 'ci_2', cartId: 'cart', productId: 'prod_X', price: 10, quantity: 1, digitalVariantId: null, printVariantId: 'pv_X' },
      { id: 'ci_3', cartId: 'cart', productId: 'prod_Y', price: 20, quantity: 1, digitalVariantId: 'dv_Y', printVariantId: null },
    ]);

    const req = makeNextRequest('https://api/stripe/webhook', {
      method: 'POST',
      body: 'raw',
      headersObj: { 'stripe-signature': 'sig' },
    });

    const res = await POST(req as any);
    const data = await asJson(res);
    expect(data.status).toBe(200);
    expect(data.json.received).toBe(true);

    // Order created with totals and session id
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u_9',
        guestId: undefined,
        total: 20, // 2000/100
        status: 'COMPLETED',
        stripeSessionId: 'cs_lin',
      }),
    });

    // 3 cart items turned into order items
    expect(prisma.orderItem.create).toHaveBeenCalledTimes(4); // 3 from cart + 1 buy-now
    // One of them is the Buy Now (prod_B)
    expect(prisma.orderItem.create.mock.calls.some((c: any[]) =>
      c[0].data.productId === 'prod_B' && c[0].data.type === VariantType.PRINT
    )).toBe(true);

    // delete purchased cart items
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['ci_1', 'ci_2', 'ci_3'] } },
    });
  });

  test('skips Buy Now line if productId/variantType not derivable', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeCheckoutCompletedEvent({
        session: { id: 'cs_skip', amount_total: 1000, metadata: { guestId: 'g_5' } },
      })
    );

    (stripe.checkout.sessions.listLineItems as jest.Mock).mockResolvedValue({
      data: [
        {
          quantity: 1,
          amount_subtotal: 1000,
          price: {
            metadata: {}, // no productId/variantType
            product: { metadata: {} },
          },
        },
      ],
    });

    const req = makeNextRequest('https://api/stripe/webhook', {
      method: 'POST',
      body: 'raw',
      headersObj: { 'stripe-signature': 'sig' },
    });

    const res = await POST(req as any);
    const data = await asJson(res);
    expect(data.status).toBe(200);
    expect(prisma.orderItem.create).toHaveBeenCalledTimes(0); // nothing to create
  });

  test('500 path when transaction fails', async () => {
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(
      makeCheckoutCompletedEvent({
        session: { id: 'cs_fail', amount_total: 100, metadata: { userId: 'u_2' } },
      })
    );

    prisma.$transaction.mockImplementationOnce(async () => {
      throw new Error('db write failed');
    });

    const req = makeNextRequest('https://api/stripe/webhook', {
      method: 'POST',
      body: 'raw',
      headersObj: { 'stripe-signature': 'sig' },
    });

    const res = await POST(req as any);
    const data = await asJson(res);
    expect(data.status).toBe(500);
    expect(data.json.error).toMatch(/Order processing failed/);
  });
});
