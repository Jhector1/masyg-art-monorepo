import { createPublishedSitemapHandler } from "@acme/server/lib/public-sitemap";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createPublishedSitemapHandler(["", "/contact", "/store"]);
