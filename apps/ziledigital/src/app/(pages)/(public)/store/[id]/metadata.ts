import type { Metadata } from "next";
import { headers } from "next/headers";
import { publishedProductMetadata } from "@acme/server/lib/public-product-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, requestHeaders] = await Promise.all([params, headers()]);
  return publishedProductMetadata({
    host: requestHeaders.get("host"), slug: id,
    siteName: "ZileDigital Haitian Art",
    fallbackDescription: "Explore Haitian artwork, downloadable digital art and physical goods.",
    keywords: ["Haitian art", "ZileDigital", "digital artwork", "physical art"],
  });
}
