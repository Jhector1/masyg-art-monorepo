import { Suspense } from "react";
import SEO from "@acme/ui/components/SEO";
import LoginClient from "./LoginClient";

export default function Page() {
  return (
    <>
      <SEO
        title="Sign in – ZileDigital"
        description="Sign in to access your saved art, purchases, and account."
      />
      <Suspense fallback={null}>
        <LoginClient />
      </Suspense>
    </>
  );
}
