
import ResetPasswordClient from './ResetPasswordClient';
import { Suspense } from "react";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default function ResetPasswordPage() {
 

  return (
    <Suspense fallback={null}>
      {/* <SEO title="Haitian Digital Art Gallery" description="Buy and explore uniquely crafted Haitian vector artworks." /> */}
      <ResetPasswordClient  />
    </Suspense>
  );
}