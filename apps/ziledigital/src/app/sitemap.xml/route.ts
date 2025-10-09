// apps/ziledigital/app/sitemap.xml/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@acme/core/lib/prisma';

// Make sure this route never runs at build time
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs'; // Prisma requires Node runtime (not Edge)

export async function GET() {
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'https://ziledigital.com';

  // During docker build, short-circuit to avoid DB
  if (process.env.SITEMAP_SKIP === '1') {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}</loc><lastmod>${new Date().toISOString()}</lastmod><priority>1.0</priority></url>
</urlset>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
  }

  try {
    // Fetch dynamic product URLs (keep this light)
    const products = await prisma.product.findMany({
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500, // cap to avoid huge sitemaps
    });

    const staticPages = ['', '/about', '/contact', '/store'];
    const staticUrls = staticPages
      .map(
        (path) => `
  <url>
    <loc>${baseUrl}${path}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>0.8</priority>
  </url>`
      )
      .join('\n');

    const productUrls = products
      .map(
        (p) => `
  <url>
    <loc>${baseUrl}/store/${p.id}</loc>
    <lastmod>${p.createdAt.toISOString()}</lastmod>
    <priority>0.6</priority>
  </url>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${productUrls}
</urlset>`;

    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
  } catch (err) {
    console.error('❌ Sitemap generation failed:', err);
    // Degrade gracefully — never break build/runtime
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}</loc><lastmod>${new Date().toISOString()}</lastmod></url>
</urlset>`;
    return new NextResponse(fallback, { headers: { 'Content-Type': 'application/xml' } });
  }
}
