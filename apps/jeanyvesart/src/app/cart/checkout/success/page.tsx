// File: src/app/cart/checkout/success/page.tsx
'use client'
import { Suspense } from "react";
import dynamic from "next/dynamic";
// import CheckoutSuccessPage from "@/components/store/checkout/CheckoutSuccessPage";

const CheckoutSuccessPage = dynamic(() => import("@acme/ui/components/store/checkout/CheckoutSuccessPage"), {
  ssr: false,
});

export default function Page() {
  return (
    <Suspense fallback={<div className="py-10 text-center">Loading page…</div>}>
      <CheckoutSuccessPage />
    </Suspense>
  );
}
