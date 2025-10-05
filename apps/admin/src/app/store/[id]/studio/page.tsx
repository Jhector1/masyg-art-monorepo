


import EditableCanvas from "@acme/ui/components/studio/EditableCanvas";

// option A: async / await
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    // <ScreenshotGuard blurAmount="10px" blurDurationMs={1500}>
      <EditableCanvas productId={id} />
    // </ScreenshotGuard>
  );
}
