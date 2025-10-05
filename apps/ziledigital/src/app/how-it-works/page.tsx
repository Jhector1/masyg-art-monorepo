// File: src/app/how-it-works/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircleIcon,
  CursorArrowRaysIcon,
  PaintBrushIcon,
  CreditCardIcon,
  ArrowDownTrayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ShoppingBagIcon,
  PhotoIcon,
  GlobeAmericasIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "How It Works | ZileDigital",
  description:
    "See how ZileDigital works—from browsing Haitian-inspired art to customizing, purchasing digital or print versions, and downloading files.",
  openGraph: {
    title: "How It Works | ZileDigital",
    description:
      "See how ZileDigital works—from browsing Haitian-inspired art to customizing, purchasing digital or print versions, and downloading files.",
    type: "website",
  },
};

const steps = [
  {
    title: "Browse Artworks",
    desc: "Explore curated collections inspired by Haiti’s culture, mysticism, nature, and everyday life.",
    icon: GlobeAmericasIcon,
  },
  {
    title: "Pick Digital or Print",
    desc: "Choose a digital download (multiple formats/sizes) or a museum-quality print with size, material, and frame options.",
    icon: ShoppingBagIcon,
  },
  {
    title: "Customize (Optional)",
    desc: "Use Zile Studio to adjust colors, backgrounds, and styles on select pieces before checkout.",
    icon: PaintBrushIcon,
  },
  {
    title: "Secure Checkout",
    desc: "Pay safely via Stripe. Guests can check out or create an account to save purchases.",
    icon: CreditCardIcon,
  },
  {
    title: "Instant Digital Downloads",
    desc: "Access your files immediately on the success page and in your profile’s Purchases tab.",
    icon: ArrowDownTrayIcon,
  },
  {
    title: "Licensing That Fits",
    desc: "Choose personal or commercial licenses for digital use. Clear usage rights right from the product page.",
    icon: ShieldCheckIcon,
  },
];

const digitalPerks = [
  "Multiple file formats (JPG/PNG/SVG/PDF) when available",
  "High-resolution exports suitable for print and web",
  "Immediate access after payment",
  "License options: Personal / Commercial / Extended",
];

const printPerks = [
  "Premium paper or canvas options",
  "Size picker with live price updates",
  "Optional frame preview",
  "Carefully fulfilled and shipped to you",
];

const faqs = [
  {
    q: "Do I need an account to buy?",
    a: "No—guests can purchase. Creating an account lets you re-download files, track orders, and save favorites.",
  },
  {
    q: "What file formats do I get for digital?",
    a: "It depends on the artwork. Many offer JPG/PNG for general use; selected pieces also include SVG/PDF for vector workflows.",
  },
  {
    q: "Where do I find my downloads?",
    a: "On the checkout success page right after payment and anytime in your Profile → Collections.",
  },
  {
    q: "What’s the difference between Personal and Commercial licenses?",
    a: "Personal is for non-commercial projects. Commercial allows use in business contexts. Extended covers higher-volume or broader distribution. Each product page links to the full license.",
  },
  {
    q: "Can I return digital items?",
    a: "Because digital files are instantly accessible, they’re generally non-refundable. If there’s a technical issue, contact support and we’ll help.",
  },
  {
    q: "How long do print orders take?",
    a: "Production + shipping times vary by destination and material. You’ll get tracking once your order ships.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="bg-white dark:bg-neutral-950">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-gray-600 dark:border-neutral-800 dark:text-neutral-300">
              <SparklesIcon className="h-4 w-4" />
              Celebrate Haiti’s spirit through digital art
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              How ZileDigital Works
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-neutral-300">
              From discovery to download (or doorstep) in a few simple steps.
            </p>

            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/artworks"
                className="rounded-xl bg-indigo-600 px-5 py-3 text-white shadow hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Browse Artworks
              </Link>
              <Link
                href="/about"
                className="rounded-xl border border-gray-300 px-5 py-3 text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t border-gray-100 py-14 dark:border-neutral-900">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Simple, transparent flow
          </h2>
          <p className="mt-1 text-gray-600 dark:text-neutral-300">
            Whether you want a high-res digital file or a premium print, it’s the same smooth experience.
          </p>

          <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="group rounded-2xl border border-gray-100 p-6 shadow-sm transition hover:shadow-md dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                    <s.icon className="h-6 w-6" />
                  </span>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Step {i + 1}
                  </div>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-neutral-300">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Digital vs Print */}
      <section className="border-t border-gray-100 py-14 dark:border-neutral-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 p-6 shadow-sm dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <PhotoIcon className="h-6 w-6 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Digital Downloads</h3>
            </div>
            <ul className="mt-4 space-y-2">
              {digitalPerks.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 text-emerald-500" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-sm text-gray-500 dark:text-neutral-400">
              Tip: Some artworks include an editor (“Zile Studio”) for color and style tweaks before purchase.
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 p-6 shadow-sm dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <CursorArrowRaysIcon className="h-6 w-6 text-pink-600" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Fine-Art Prints</h3>
            </div>
            <ul className="mt-4 space-y-2">
              {printPerks.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 text-emerald-500" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-sm text-gray-500 dark:text-neutral-400">
              Shipping times vary by region and material. You’ll receive tracking once it’s on the way.
            </div>
          </div>
        </div>
      </section>

      {/* Customization block */}
      <section className="border-t border-gray-100 py-14 dark:border-neutral-900">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Customize with Zile Studio</h3>
              <p className="mt-2 text-gray-600 dark:text-neutral-300">
                Select artworks let you personalize colors, gradients, and backgrounds—right in the browser.
                Your chosen style is saved to your purchase, so downloads reflect your design.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-neutral-300">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 text-emerald-500" />
                  <span>Live preview with safe, high-quality exports</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 text-emerald-500" />
                  <span>Vector-friendly pipeline for crisp results</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 text-emerald-500" />
                  <span>Re-download your customized version anytime</span>
                </li>
              </ul>
              <div className="mt-6">
                <Link
                  href="/store"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white shadow hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <PaintBrushIcon className="h-5 w-5" />
                  Try it on select pieces
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-600 dark:border-neutral-800 dark:text-neutral-300">
              <p className="font-medium text-gray-900 dark:text-white">What you’ll see before checkout:</p>
              <ul className="mt-3 list-disc space-y-1 pl-6">
                <li>Selected format & size (e.g., JPG 8K, SVG, PDF)</li>
                <li>Print material & frame choice (if print)</li>
                <li>License tier and price breakdown</li>
                <li>Estimated delivery (for prints)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Downloads & Account */}
      <section className="border-t border-gray-100 py-14 dark:border-neutral-900">
        <div className="mx-auto max-w-6xl px-4">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">After You Purchase</h3>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 p-6 shadow-sm dark:border-neutral-800">
              <ArrowDownTrayIcon className="h-6 w-6 text-indigo-600" />
              <h4 className="mt-3 font-semibold text-gray-900 dark:text-white">Instant Downloads</h4>
              <p className="mt-2 text-sm text-gray-600 dark:text-neutral-300">
                Access files immediately on the success page and anytime in your profile’s Purchases.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-6 shadow-sm dark:border-neutral-800">
              <ShieldCheckIcon className="h-6 w-6 text-emerald-600" />
              <h4 className="mt-3 font-semibold text-gray-900 dark:text-white">Clear Licensing</h4>
              <p className="mt-2 text-sm text-gray-600 dark:text-neutral-300">
                Personal, Commercial, and Extended licenses are available. View details on each product page.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-6 shadow-sm dark:border-neutral-800">
              <CreditCardIcon className="h-6 w-6 text-pink-600" />
              <h4 className="mt-3 font-semibold text-gray-900 dark:text-white">Secure & Simple</h4>
              <p className="mt-2 text-sm text-gray-600 dark:text-neutral-300">
                Payments handled by Stripe. Your data stays safe; we never store card details.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/authenticate"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-white shadow hover:bg-indigo-700"
            >
              Create an Account
            </Link>
            <Link
              href="/authenticate"
              className="rounded-xl border border-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-50 dark:border-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              Continue as Guest
            </Link>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="border-t border-gray-100 py-16 dark:border-neutral-900">
        <div className="mx-auto max-w-6xl px-4">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">FAQ</h3>
          <dl className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-100 dark:divide-neutral-900 dark:border-neutral-800">
            {faqs.map((f, idx) => (
              <div key={idx} className="p-5">
                <dt className="font-medium text-gray-900 dark:text-white">{f.q}</dt>
                <dd className="mt-2 text-sm text-gray-600 dark:text-neutral-300">{f.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 rounded-2xl bg-indigo-50 p-6 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-200">
            Need more help?{" "}
            <Link href="/contact" className="font-medium underline">
              Contact support
            </Link>
            .
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-100 py-16 dark:border-neutral-900">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Ready to explore?
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-gray-600 dark:text-neutral-300">
            Discover new releases, customize select pieces, and make them yours—digitally or as a fine-art print.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link href="/store" className="rounded-xl bg-indigo-600 px-5 py-3 text-white shadow hover:bg-indigo-700">
              Shop Artworks
            </Link>
            <Link
              href="/profile"
              className="rounded-xl border border-gray-300 px-5 py-3 text-gray-800 hover:bg-gray-50 dark:border-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-900"
            >
              Go to Profile
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
