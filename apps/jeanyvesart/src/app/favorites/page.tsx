"use client";
import SEO from "@acme/ui/components/SEO";
import PublishedGallery from "@acme/ui/components/storefront/PublishedGallery";
export default function FavoritePage(){
 return <>
  <SEO title="Haitian Digital Art Gallery" description="Buy and explore uniquely crafted Haitian vector artworks."/>
  <div className="max-w-7xl mx-auto py-10">
   <h1 className="text-3xl font-bold text-purple-700 mb-4">Your Favorites</h1>
   <p className="text-gray-600 mb-8">Explore the artworks you’ve liked. Tap any image to view details, or click ❤️ to remove.</p>
   <PublishedGallery favoritesOnly originalsOnly/>
  </div>
 </>;
}
