// lib/embeddedCheckoutManager.ts
"use client";
import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  return stripePromise!;
}

type Ctrl = { destroy: () => void };

let activeCtrl: Ctrl | null = null;
let creating = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function startEmbeddedCheckout(
  init: (stripe: Stripe) => Promise<Ctrl>,
  mount: (ctrl: Ctrl) => Promise<void> | void
) {
  while (creating) await sleep(25);
  creating = true;
  try {
    if (activeCtrl) {
      try { activeCtrl.destroy(); } catch {}
      activeCtrl = null;
      await sleep(10);
    }
    const stripe = await getStripe();
    if (!stripe) throw new Error("Stripe failed to load");
    const ctrl = await init(stripe);
    if (activeCtrl) {
      try { ctrl.destroy(); } catch {}
      throw new Error("Another Embedded Checkout is already active.");
    }
    activeCtrl = ctrl;
    await mount(ctrl);
    return ctrl;
  } finally {
    creating = false;
  }
}

export function destroyEmbeddedCheckout(ctrl?: Ctrl) {
  if (ctrl && ctrl !== activeCtrl) {
    try { ctrl.destroy(); } catch {}
    return;
  }
  if (activeCtrl) {
    try { activeCtrl.destroy(); } catch {}
    activeCtrl = null;
  }
}
