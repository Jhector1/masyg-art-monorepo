// import { NextRequest } from 'next/server';

/** Build a NextRequest for tests */
// test/helpers/next.ts
/**
 * Lightweight NextRequest mock for testing route handlers without Next runtime.
 * Returns an object that quacks like NextRequest where your code uses it.
 */
export function makeNextRequest(
  url: string,
  init?: {
    method?: string;
    body?: any; // string | object | Buffer
    headersObj?: Record<string, string>;
  }
): any /* NextRequest-like */ {
  const method = init?.method ?? 'GET';
  const headers = new Headers(init?.headersObj);

  // Normalize body for json() and arrayBuffer()
  const asString =
    typeof init?.body === 'string'
      ? init!.body
      : init?.body instanceof Buffer
      ? init!.body.toString('utf8')
      : init?.body != null
      ? JSON.stringify(init!.body)
      : '';

  const encoder = new TextEncoder();
  const bodyBuf = encoder.encode(asString);

  return {
    method,
    url,
    nextUrl: new URL(url),
    headers,
    json: async () => {
      if (!asString) return undefined;
      try { return JSON.parse(asString); } catch { return asString; }
    },
    arrayBuffer: async () => bodyBuf.buffer,
    // add any other bits you need later
  };
}
