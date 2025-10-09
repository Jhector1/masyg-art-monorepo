// Server component
import OrderDetailClient from "./client";

export default async function OrderDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;           // ✅ unwrap on the server
  return <OrderDetailClient id={id} />;  // pass to client component
}
