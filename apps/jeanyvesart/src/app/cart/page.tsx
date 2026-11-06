"use client";
import CanonicalCartView from "@acme/ui/components/cart/CanonicalCartView";

export default function CartArtworksPage() {
  return <CanonicalCartView theme="jeanyvesart" backHref="/store"
    description="Your art selections are securely priced by the JeanYvesArt storefront." />;
}
