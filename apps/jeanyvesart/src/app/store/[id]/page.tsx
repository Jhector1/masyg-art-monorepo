export { generateMetadata } from "./metadata";

import OriginalPaintingDetails from "apps/jeanyvesart/src/components/store/painting/OriginalPaintingsDetails";
// import ScreenshotGuard from "@/components/ScreenshotGuard";
import ProductDetail from "./ProductClient";

// option A: async / await
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    // <ScreenshotGuard blurAmount="10px" blurDurationMs={1500}>
      <OriginalPaintingDetails productId={id} />
    // </ScreenshotGuard>
  );
}
