"use client";

import SEO from "@acme/ui/components/SEO";
import Gallery from "@acme/ui/components/store/Gallery";
import { useCart } from "@acme/core/contexts/CartContext";
import { useUser } from "@acme/core/contexts/UserContext";
import { toast } from "react-hot-toast";
import { loadStripe } from "@stripe/stripe-js";
import { useState } from "react";
// import { getEffectiveSale } from "@/lib/pricing";

export default function CartPage() {
  const { cart, loadingCart, totalPrice } = useCart();
  const { user, guestId } = useUser();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const stripePromise = loadStripe(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
  );

  const handleCheckout = async () => {
    if (!user && !guestId) {
      toast.error("You must be logged in to checkout.");
      return;
    }

    const stripe = await stripePromise;
    if (!stripe) {
      toast.error("Stripe failed to initialize.");
      return;
    }

    setIsCheckingOut(true); // Start loading

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: user?.id ?? guestId,
          cartProductList: cart.map((data) => {
            
            return {
              quantity: data.cartQuantity,
              myProduct: {
                id: data.id,
                title: data.title,
                price: data.price,
                imageUrl: data.thumbnails[0] || "/placeholder.png",
                digital: data.digital
                  ? {
                      id: data.digital.id,
                      format: data.digital.format,
                    }
                  : undefined,
                print: data.print
                  ? {
                      id: data.print.id,
                      format: data.print.format,
                      size: data.print.size,
                      material: data.print.material,
                      frame: data.print.frame,
                    }
                  : undefined,
              },
              cartItemId: data.cartItemId,
            };
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      const result = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (result.error) {
        toast.error(result.error.message || "Redirect failed");
        console.error("Stripe redirect error:", result.error);
      }
    } catch (error: unknown) {
      let message = "Unexpected error";
      if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message || "Failed to start checkout");
      console.error("Checkout error:", error);
    } finally {
      setIsCheckingOut(false); // End loading in case of failure
    }
  };

  if (loadingCart) {
    return <div className="text-center py-10">Loading your cart…</div>;
  }

  return (
    <>
      <SEO
        title="Your Cart"
        description="Review and manage items in your cart before checkout."
      />
      <div className="max-w-7xl mx-auto  py-10">
        <h1 className="text-3xl font-bold text-green-700 mb-4">Your Cart</h1>
        {cart.length === 0 ? (
          <p className="text-gray-600">Your cart is empty.</p>
        ) : (
          <CartPage/>
        
        )}
      </div>
    </>
  );
}
