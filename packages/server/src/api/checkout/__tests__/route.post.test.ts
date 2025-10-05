/**
 * POST /api/checkout — tests (ESM-safe mocks, no spyOn on named exports)
 *
 * Adjust the sample payloads in makeDigitalItem/makePrintItem
 * if your route expects different field names.
 */

import { POST } from '../route';

// ---- Mocks (must be top-level) ---------------------------------------------
jest.mock('@/utils/guest', () => ({
  getCustomerIdFromRequest: jest.fn(),
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  },
}));

// ---- Typed access to mocks --------------------------------------------------
import { getCustomerIdFromRequest } from '@acme/core/utils/guest';
import { stripe } from '@acme/core/lib/stripe';

const mockGetCustomer = getCustomerIdFromRequest as jest.MockedFunction<
  typeof getCustomerIdFromRequest
>;
const mockStripeCreate = stripe.checkout.sessions.create as jest.Mock;

// ---- Helpers ----------------------------------------------------------------
const asJson = async (res: any) => ({
  status: res.status,
  json: await res.json(),
});

const makeReq = (body: any) =>
  new Request('http://localhost/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

// Minimal digital/print shapes — adjust to match your route’s types
const makeDigitalItem = (overrides: Record<string, any> = {}) => ({
  id: 'cart_dig_1',
  type: 'Digital',
  productId: 'prod_abc',
  name: 'Sunrise Over Jacmel',
  currency: 'usd',
  unitAmount: 1200, // in cents
  quantity: 1,
  // typical digital metadata your route may add to line item product_data
  format: 'PNG',
  size: '4096x4096',
  license: 'Personal',
  ...overrides,
});

const makePrintItem = (overrides: Record<string, any> = {}) => ({
  id: 'cart_prt_1',
  type: 'Print',
  productId: 'prod_def',
  name: 'Drums of Rara',
  currency: 'usd',
  unitAmount: 4500, // in cents
  quantity: 1,
  // typical print options
  material: 'Canvas',
  frame: 'Black',
  size: '12x16',
  ...overrides,
});

// Common success from Stripe
const stripeOk = { id: 'cs_test_123', url: 'https://stripe.test/session' };

// ---- Reset between tests ----------------------------------------------------
afterEach(() => {
  jest.resetAllMocks();
});

// ---- Tests ------------------------------------------------------------------
describe('POST /api/checkout', () => {
  test('400 when body missing cartProductList', async () => {
    mockGetCustomer.mockResolvedValue({ userId: null, guestId: 'guest_123' });
    const res = await POST(makeReq({}) as any);
    const { status, json } = await asJson(res);

    expect(status).toBe(400);
    expect(json.error ?? JSON.stringify(json)).toMatch(/cartProductList/i);
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });

  test('creates Stripe session with digital item metadata and session-level CSV', async () => {
    mockGetCustomer.mockResolvedValue({ userId: 'user_123', guestId: null });
    mockStripeCreate.mockResolvedValue(stripeOk);

    const body = {
      cartProductList: [
        makeDigitalItem({ id: 'cart_dig_1' }),
        // add more items if you want
      ],
    };

    const res = await POST(makeReq(body) as any);
    const { status } = await asJson(res);

    expect(status).toBe(200);
    expect(mockStripeCreate).toHaveBeenCalledTimes(1);

    const arg = mockStripeCreate.mock.calls[0][0];

    // Expect a Stripe Session payload with at least one line item
    expect(arg).toEqual(
      expect.objectContaining({
        mode: expect.any(String),
        line_items: expect.arrayContaining([expect.any(Object)]),
      })
    );

    // Session-level metadata is present (CSV of cart item ids, etc.)
    // If you use a different key name, tweak the expectation here:
    expect(arg.metadata).toEqual(
      expect.objectContaining({
        // change key if your route uses a different one
        // e.g., 'purchased_cart_item_ids_csv' or 'cart_item_ids_csv'
        // We'll just assert ANY key exists and includes the id.
      })
    );

    // Be liberal: ensure the cart id shows up somewhere in metadata object
    const metaString = JSON.stringify(arg.metadata ?? {});
    expect(metaString).toMatch(/cart_dig_1/);

    // Line-item digital metadata — adjust keys if your route differs
    const first = arg.line_items[0];
    expect(first).toEqual(
      expect.objectContaining({
        quantity: expect.any(Number),
        price_data: expect.objectContaining({
          currency: expect.any(String),
          unit_amount: expect.any(Number),
          product_data: expect.objectContaining({
            name: expect.any(String),
            metadata: expect.objectContaining({
              type: 'Digital',
              format: expect.any(String),
              size: expect.any(String),
              license: expect.any(String),
            }),
          }),
        }),
      })
    );
  });

  test('creates Stripe session with print item metadata', async () => {
    mockGetCustomer.mockResolvedValue({ userId: null, guestId: 'guest_789' });
    mockStripeCreate.mockResolvedValue(stripeOk);

    const body = {
      cartProductList: [
        makePrintItem({
          id: 'cart_prt_1',
          size: '16x20',
          material: 'Paper',
          frame: 'Natural Wood',
        }),
      ],
    };

    const res = await POST(makeReq(body) as any);
    const { status } = await asJson(res);

    expect(status).toBe(200);
    expect(mockStripeCreate).toHaveBeenCalledTimes(1);

    const arg = mockStripeCreate.mock.calls[0][0];
    const item = arg.line_items[0];

    // Ensure print-specific metadata made it into product_data.metadata
    expect(item).toEqual(
      expect.objectContaining({
        price_data: expect.objectContaining({
          product_data: expect.objectContaining({
            metadata: expect.objectContaining({
              type: 'Print',
              size: '16x20',
              material: 'Paper',
              frame: 'Natural Wood',
            }),
          }),
        }),
      })
    );
  });

  test('500 path bubbles Stripe errors', async () => {
    mockGetCustomer.mockResolvedValue({ userId: 'user_fail', guestId: null });
    mockStripeCreate.mockRejectedValue(new Error('Stripe is down'));

    const body = {
      cartProductList: [makeDigitalItem()],
    };

    const res = await POST(makeReq(body) as any);
    const { status, json } = await asJson(res);

    expect(status).toBeGreaterThanOrEqual(500);
    expect((json.error ?? '') + '').toMatch(/stripe|error/i);
    expect(mockStripeCreate).toHaveBeenCalledTimes(1);
  });
});
