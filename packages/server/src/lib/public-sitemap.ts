import { NextRequest, NextResponse } from "next/server";
import { listPublishedSitemapListings } from "@acme/core/lib/public-sitemap";
import { normalizePublicHostHeader } from "@acme/core/lib/storefront-host";
import { PublicCatalogError } from "@acme/core/lib/public-catalog";

const xmlEscape = (raw: string) => raw.replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[c] ?? c));

/** One sitemap implementation for all storefronts. The Host must map to a verified,
 * published store domain. Do not use NEXTAUTH_URL or unverified forwarded-host headers.
 */
export function createPublishedSitemapHandler(staticPaths: readonly string[]) {
  return async function GET(request: NextRequest) {
    try {
      const host = normalizePublicHostHeader(request.headers.get("host"));
      const { listings } = await listPublishedSitemapListings(host);
      const baseUrl = `https://${host}`;
      const urls = [
        ...staticPaths.map(path => ({ path, updated: null as Date | null })),
        ...listings.map(item => ({ path: `/store/${encodeURIComponent(item.slug)}`, updated: item.updatedAt })),
      ];
      const items = urls.map(({ path, updated }) =>
        `<url><loc>${xmlEscape(baseUrl + path)}</loc>${updated ? `<lastmod>${updated.toISOString()}</lastmod>` : ""}</url>`
      ).join("");
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
      return new NextResponse(xml, { headers: {
        "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300",
      }});
    } catch (error) {
      if (error instanceof PublicCatalogError) {
        return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
      }
      console.error("Published storefront sitemap failed", error);
      return new NextResponse("Sitemap unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  };
}
