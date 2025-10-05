'use client';
import { useState } from 'react';

export default function useAddToCart(userId: string, product: { id: string; price: number }, options: { digital: boolean; print: boolean }, calculatePrice: (type: 'Digital' | 'Print') => string) {
  const [loading, setLoading] = useState(false);

  const handleAddToCart = async () => {
    setLoading(true);

    const items: Array<{ type: string; price: string }> = [];
    if (options.digital) items.push({ type: 'Digital', price: calculatePrice('Digital') });
    if (options.print) items.push({ type: 'Print', price: calculatePrice('Print') });

    try {
      for (const item of items) {


        await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            productId: product.id,
            type: item.type,
            price: parseFloat(item.price),
            quantity: 1,
          }),
        });
      }
   

      //router.push('/cart');
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setLoading(false);
    }
  };

  return { handleAddToCart, loading };
}
