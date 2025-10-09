import { Suspense } from "react";
import ChangePasswordClient from "./ChangePasswordClient";

export const dynamic = "force-dynamic"; // don’t prerender at build
export const revalidate = 0;            // no ISR

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChangePasswordClient />
    </Suspense>
  );
}
