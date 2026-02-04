

import ForgotPasswordClient from './ForgotPasswordClient';
import { Suspense } from "react";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ForgotPasswordPage() {
 

  return (
    <Suspense fallback={8}>
      {/* <SEO title="Haitian Digital Art Gallery" description="Buy and explore uniquely crafted Haitian vector artworks." /> */}
      <ForgotPasswordClient  />
    </Suspense>
  );
}

