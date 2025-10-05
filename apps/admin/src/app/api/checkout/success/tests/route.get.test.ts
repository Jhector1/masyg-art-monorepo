/**
 * Tests for GET /api/checkout/success/route.ts
 */
import { makeNextRequest } from '@acme/core/test/helpers/next';
import { GET } from '../route';
import { getCustomerIdFromRequest } from '@acme/core/utils/guest';
import { PrismaClient } from '@prisma/client';

jest.mock('@/utils/guest');
jest.mock('@prisma/client');

const asJson = async (res: any) => ({ status: res.status, json: await res.json() });

const prisma = new PrismaClient() as any;

describe('GET /api/checkout/success', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('401 when not authenticated', async () => {
    (getCustomerIdFromRequest as jest.Mock).mockResolvedValue({ userId: null, guestId: null });

    const req = makeNextRequest('https://api/checkout/success?session_id=cs_X', { method: 'GET' });
    const res = await GET(req as any);
    const data = await asJson(res);

    expect(data.status).toBe(401);
    expect(data.json.error).toMatch(/Not authenticated/);
  });

  test('empty list when no session_id', async () => {
    (getCustomerIdFromRequest as jest.Mock).mockResolvedValue({ userId: 'u', guestId: null });

    const req = makeNextRequest('https://api/checkout/success', { method: 'GET' });
    const res = await GET(req as any);
    const data = await asJson(res);

    expect(data.status).toBe(200);
    expect(data.json.digitalDownloads).toEqual([]);
  });

  test('empty list when order not found', async () => {
    (getCustomerIdFromRequest as jest.Mock).mockResolvedValue({ userId: 'u_5', guestId: null });
    prisma.order.findFirst.mockResolvedValue(null);

    const req = makeNextRequest('https://api/checkout/success?session_id=cs_1', { method: 'GET' });
    const res = await GET(req as any);
    const data = await asJson(res);

    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stripeSessionId: 'cs_1', OR: [{ userId: 'u_5' }] }),
      include: expect.any(Object),
    }));
    expect(data.json.digitalDownloads).toEqual([]);
  });

  test('returns ALL product.formats for each DIGITAL order item with correct ext and thumb', async () => {
    (getCustomerIdFromRequest as jest.Mock).mockResolvedValue({ userId: null, guestId: 'g_9' });

    prisma.order.findFirst.mockResolvedValue({
      id: 'ord_1',
      items: [
        {
          id: 'oi_1',
          productId: 'prod_1',
          product: {
            id: 'prod_1',
            title: 'Sky',
            thumbnails: ['https://cdn/t1.jpg?x=1'],
            formats: [
              'https://f/s1.png?sig=1',
              'https://f/s2.SVG',
              'https://f/s3', // no ext
            ],
          },
          digitalVariant: { id: 'dv_1', format: 'png' },
        },
      ],
    });

    const req = makeNextRequest('https://api/checkout/success?session_id=cs_ok', { method: 'GET' });
    const res = await GET(req as any);
    const data = await asJson(res);

    expect(data.status).toBe(200);
    expect(data.json.digitalDownloads).toEqual([
      {
        id: 'oi_1-0',
        orderItemId: 'oi_1',
        productId: 'prod_1',
        title: 'Sky',
        format: 'png',
        downloadUrl: 'https://f/s1.png?sig=1',
        thumbnail: 'https://cdn/t1.jpg?x=1',
      },
      {
        id: 'oi_1-1',
        orderItemId: 'oi_1',
        productId: 'prod_1',
        title: 'Sky',
        format: 'svg',
        downloadUrl: 'https://f/s2.SVG',
        thumbnail: 'https://cdn/t1.jpg?x=1',
      },
      {
        id: 'oi_1-2',
        orderItemId: 'oi_1',
        productId: 'prod_1',
        title: 'Sky',
        format: '',
        downloadUrl: 'https://f/s3',
        thumbnail: 'https://cdn/t1.jpg?x=1',
      },
    ]);
  });
});
