// app/authenticate/page.tsx (Server Component; no "use client")
import { Suspense } from "react";
import AuthenticationForm from "@acme/ui/components/authenticate/AuthenticationFom";
import SEO from "@acme/ui/components/SEO";

export  default async function Page({
  searchParams,
}: { searchParams: Promise<{ callbackUrl?: string | undefined }> }) {
  // const callbackUrl =
    // typeof searchParams.callbackUrl === "string" ? searchParams.callbackUrl : "/profile";
  const { callbackUrl } = await searchParams;

  return (
    <>
      <SEO title="Haitian Digital Art Gallery" description="Buy and explore uniquely crafted Haitian vector artworks." />
      <Suspense fallback={null}>
        <AuthenticationForm callbackUrl={callbackUrl} />
      </Suspense>
    </>
  );
}
