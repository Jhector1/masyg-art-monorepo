// File: src/app/cart/checkout/success/page.tsx
'use client'
import { Suspense } from "react";
// import dynamic from "next/dynamic";
import { RefundPolicy } from "@acme/ui/components/policy/Policy";
// import CheckoutSuccessPage from "@/components/store/checkout/CheckoutSuccessPage";


export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading page…</div>}>
      <RefundPolicy />
    </Suspense>
  );
}
