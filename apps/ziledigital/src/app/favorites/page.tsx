"use client";

import { useEffect, useState } from "react";
import SEO from "@acme/ui/components/SEO";
import Gallery from "@acme/ui/components/store/Gallery";
import { useUser } from "@acme/core/contexts/UserContext";
import { useFavorites } from "@acme/core/contexts/FavoriteContext";
import { ProductListItem } from "@acme/core/types";

export default function FavoritePage() {
  const { isLoggedIn, sessionPulse } = useUser();
  const { favorites, removeFavorite } = useFavorites();
  const [favoriteProducts, setFavoriteProducts] = useState<ProductListItem[]>([]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchFavorites = async () => {
      const res = await fetch(`/api/favorite`, {
        credentials: "include",
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      if (!res.ok) {
        setFavoriteProducts([]);
        return;
      }
      const data = await res.json();
      setFavoriteProducts(Array.isArray(data) ? data : []);
    };

    fetchFavorites();
  }, [isLoggedIn, sessionPulse, favorites]); // re-run on auth pulse and favorites mutation

  const handleLikeToggle = (id: string, liked: boolean) => {
    if (!liked) {
      removeFavorite(id);
      setFavoriteProducts((prev) => prev.filter((item) => String(item.id) !== String(id)));
    }
  };

  return (
    <>
      <SEO
        title="Haitian Digital Art Gallery"
        description="Buy and explore uniquely crafted Haitian vector artworks."
      />
      <div className="max-w-7xl mx-auto py-10">
        <h1 className="text-3xl font-bold text-purple-700 mb-4">Your Favorites</h1>
        <p className="text-gray-600 mb-8">
          Explore the artworks you’ve liked. Tap any image to view details, or click ❤️ to remove.
        </p>

        <Gallery
          products={favoriteProducts}
          showLikeButton
          onLikeToggle={handleLikeToggle}
        />
      </div>
    </>
  );
}
