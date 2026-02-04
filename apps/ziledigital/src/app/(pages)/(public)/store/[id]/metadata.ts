import { prisma } from "@acme/core/lib/prisma";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id: id},
  });

  if (!product) {
    return {
      title: "Product Not Found | ZileDigital Haitian Art",
      description: "This product does not exist or is no longer available.",
    };
  }

  const title = `${product.title} | ZileDigital Haitian Art`;
  const description =
    product.description?.slice(0, 160) ??
    "Explore unique digital and print artworks inspired by Haitian culture.";
  const imageUrl = product.thumbnails?.[0] || "/placeholder.png";
  const url = `${process.env.NEXTAUTH_URL}/store/${product.id}`;

  return {
    title,
    description,
    metadataBase: new URL(process.env.NEXTAUTH_URL!),
    alternates: {
      canonical: url,
    },
    keywords: [
      "Haitian art",
      "ZileDigital",
      product.title,
      "digital downloads",
      "printable art",
      "Afro-Caribbean culture",
    ],
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "ZileDigital",
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
    authors: [{ name: "ZileDigital" }],
    category: "art",
  };
}
