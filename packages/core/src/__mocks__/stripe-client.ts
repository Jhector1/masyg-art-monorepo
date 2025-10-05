type AnyFn = (...args: any[]) => any;

const mkFn = <T extends AnyFn>(ret?: any) => {
  const fn = jest.fn<T>() as unknown as jest.MockedFunction<T>;
  if (ret !== undefined) fn.mockResolvedValue(ret);
  return fn;
};

export const stripeMock = {
  products: { create: mkFn() },
  prices:   { create: mkFn() },
  checkout: {
    sessions: {
      create: mkFn(),
      listLineItems: mkFn(),
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

export type StripeMock = typeof stripeMock;
