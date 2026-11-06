/**
 * CORS applies ONLY to anonymous, already-published catalog GET responses.
 * No cookies, credentials, checkout, buyer data or merchant write endpoints.
 */
const publishedCatalogHeaders: Readonly<Record<string, string>> = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});

export function addPublishedCatalogCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(publishedCatalogHeaders)) {
    headers.set(key, value);
  }
  // Catalog handlers never set cookies. Do not forward Set-Cookie if that changes.
  headers.delete("Set-Cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function publishedCatalogOptions(): Response {
  return new Response(null, { status: 204, headers: publishedCatalogHeaders });
}
