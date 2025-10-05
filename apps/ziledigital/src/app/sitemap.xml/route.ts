import { NextResponse } from "next/server";
import { prisma } from "@acme/core/lib/prisma"; // Make sure this path is correct for your project

export const runtime = "nodejs"; // Required: Prisma does NOT support edge

export async function GET() {
  try {
    const baseUrl = "https://ziledigital.com"; // Update to your correct domain

    // Fetch dynamic product URLs
    const products = await prisma.product.findMany({
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Static pages
    const staticPages = ["", "/about", "/contact", "/store"];
    const staticUrls = staticPages.map(
      (path) => `
      <url>
        <loc>${baseUrl}${path}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <priority>1.0</priority>
      </url>`
    );

    // Product pages
    const productUrls = products.map(
      (product) => `
      <url>
        <loc>${baseUrl}/store/${product.id}</loc>
        <lastmod>${product.createdAt.toISOString()}</lastmod>
        <priority>0.9</priority>
      </url>`
    );

    // Full XML string
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${[...staticUrls, ...productUrls].join("\n")}
    </urlset>`;

    return new NextResponse(sitemap, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error("❌ Sitemap generation failed:", error);
    return new NextResponse("Sitemap error", { status: 500 });
  }
}
