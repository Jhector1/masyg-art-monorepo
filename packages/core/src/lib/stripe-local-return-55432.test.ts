import { stripeTestLocalReturnOrigin } from "./stripe-checkout-contract";

const input = (databaseUrl: string, overrides: Partial<Parameters<typeof stripeTestLocalReturnOrigin>[0]> = {}) => ({
  nodeEnv: "development",
  optedIn: "true",
  checkoutEnabled: "true",
  databaseUrl,
  ...overrides,
});

const localUrl = (port: string) => `postgresql://unused:unused@127.0.0.1:${port}/haitian_art_store?schema=ziledigital`;

test("explicit local checkout accepts the verified PG18 development port 55432", () => {
  expect(stripeTestLocalReturnOrigin(input(localUrl("55432")))).toBe("http://localhost:3001");
});

test("preserves existing port 5432 compatibility for other matching local-dev databases", () => {
  expect(stripeTestLocalReturnOrigin(input(localUrl("5432")))).toBe("http://localhost:3001");
});

test.each(["55433", "5433", "5434", "65535"])("rejects unapproved PostgreSQL port %s", port => {
  expect(stripeTestLocalReturnOrigin(input(localUrl(port)))).toBeNull();
});

test("rejects a non-local PostgreSQL host", () => {
  expect(stripeTestLocalReturnOrigin(input("postgresql://unused:unused@db.example.com:55432/haitian_art_store?schema=ziledigital"))).toBeNull();
});

test("rejects wrong database or schema", () => {
  expect(stripeTestLocalReturnOrigin(input("postgresql://unused:unused@127.0.0.1:55432/learnoir_db?schema=ziledigital"))).toBeNull();
  expect(stripeTestLocalReturnOrigin(input("postgresql://unused:unused@127.0.0.1:55432/haitian_art_store?schema=public"))).toBeNull();
});

test("never enables local checkout outside development", () => {
  expect(stripeTestLocalReturnOrigin(input(localUrl("55432"), { nodeEnv: "production" }))).toBeNull();
});

test("requires both explicit local-return and checkout flags", () => {
  expect(stripeTestLocalReturnOrigin(input(localUrl("55432"), { optedIn: "false" }))).toBeNull();
  expect(stripeTestLocalReturnOrigin(input(localUrl("55432"), { checkoutEnabled: "false" }))).toBeNull();
});
