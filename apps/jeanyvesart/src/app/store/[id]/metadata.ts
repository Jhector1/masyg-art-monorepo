import type { Metadata } from "next";
import { prisma } from "@acme/core/lib/prisma";

// Prefer a dedicated site URL env var (recommended).
// Fallbacks are included so builds don't explode if one is missing.
function getSiteUrl(): string {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  // Ensure no trailing slash
  return env.replace(/\/$/, "");
}

function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const { id } = params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnails: true,
    },
  });

  const siteUrl = getSiteUrl();
  const metadataBase = new URL(siteUrl);

  if (!product) {
    const fallbackUrl = absoluteUrl(`/store/${id}`);
    return {
      title: "Original Painting Not Found | Jean Yves Hector",
      description: "This original painting does not exist or is no longer available.",
      metadataBase,
      alternates: { canonical: fallbackUrl },
      robots: { index: false, follow: false },
    };
  }

  const title = `${product.title} | Original Painting by Jean Yves Hector`;
  const description =
    product.description?.trim().slice(0, 160) ||
    "Explore original paintings by Jean Yves Hector — minimal, quiet, and considered.";

  const imageUrl =
    product.thumbnails?.[0]
      ? product.thumbnails[0].startsWith("http")
        ? product.thumbnails[0]
        : absoluteUrl(product.thumbnails[0])
      : absoluteUrl("/placeholder.png");

  // ✅ Adjust this route to match your app:
  // e.g. /store/originals/[id]  or /store/[id]
  const url = absoluteUrl(`/store/${product.id}`);

  return {
    title,
    description,
    metadataBase,
    alternates: { canonical: url },
    keywords: [
      "original painting",
      "Jean Yves Hector",
      "fine art",
      "contemporary painting",
      "minimal art",
      product.title,
    ],
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "Jean Yves Hector",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    authors: [{ name: "Jean Yves Hector" }],
    category: "Original Paintings",
  };
}
