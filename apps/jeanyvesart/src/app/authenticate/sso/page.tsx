import { Suspense } from "react";

import SsoCompleteClient from "./SsoCompleteClient";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; callbackUrl?: string }>;
}) {
  const { code = "", callbackUrl = "/" } = await searchParams;

  return (
    <Suspense fallback={null}>
      <SsoCompleteClient code={code} callbackUrl={callbackUrl} />
    </Suspense>
  );
}
