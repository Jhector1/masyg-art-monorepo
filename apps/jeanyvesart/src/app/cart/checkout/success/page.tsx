// File: src/app/cart/checkout/success/page.tsx
import { Suspense } from "react";
import CheckoutSuccessClient from "./CheckoutSuccessClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Suspense
        fallback={
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="h-6 w-56 animate-pulse rounded bg-neutral-100" />
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-neutral-100" />
          </div>
        }
      >
        <CheckoutSuccessClient />
      </Suspense>
    </div>
  );
}
