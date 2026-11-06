import { redirect } from "next/navigation";
import { requireMerchantPrincipal } from "@/lib/merchant-session";
import MerchantOnboardingForm from "@/components/merchant/MerchantOnboardingForm";
export const dynamic = "force-dynamic";
export default async function MerchantOnboarding() {
  try { await requireMerchantPrincipal(); }
  catch (error) {
    if (error instanceof Error && "status" in error && error.status === 428) redirect("/merchant/security?next=/merchant/onboarding");
    redirect("/merchant/signin?callbackUrl=/merchant/onboarding");
  }
  return <MerchantOnboardingForm/>;
}
