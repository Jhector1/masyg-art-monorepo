import { Suspense } from "react";
import StoreClient from "./StoreClient";

export default function StorePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading store…</div>}>
      <StoreClient />
    </Suspense>
  );
}
