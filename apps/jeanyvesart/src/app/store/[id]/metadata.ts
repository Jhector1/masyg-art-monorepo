import type { Metadata } from "next";
import { headers } from "next/headers";
import { publishedProductMetadata } from "@acme/server/lib/public-product-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, requestHeaders] = await Promise.all([params, headers()]);
  return publishedProductMetadata({
    host: requestHeaders.get("host"), slug: id,
    siteName: "Jean Yves Hector",
    fallbackDescription: "Original paintings and drawings by Jean Yves Hector.",
    keywords: ["original painting", "fine art", "Jean Yves Hector"],
  });
}
