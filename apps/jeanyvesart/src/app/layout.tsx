// File: src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

import Providers from "./providers";
import Header from "@/components/layout/Header";
// import CheckoutHost from "@acme/ui/components/orders/CheckoutHost";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "https://jeanyveshector.com";

export const viewport: Viewport = { themeColor: "#0f0f1a" };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Jean Yves Hector — Art & Studio",
    template: "%s | Jean Yves Hector",
  },
  description:
    "The personal studio of Jean Yves Hector. Minimal, quiet pieces across original paintings and drawings.",
  keywords: [
    "Jean Yves Hector",
    "original paintings",
    "drawings",
    "contemporary art",
    "minimal art",
    "studio",
    "gallery",
  ],
  authors: [{ name: "Jean Yves Hector" }],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Jean Yves Hector — Art & Studio",
    description:
      "Personal studio site by Jean Yves Hector. Explore original paintings and drawings.",
    url: "/",
    siteName: "jeanyveshector.com",
    images: [{ url: "/images/og-cover.jpg", width: 1200, height: 630, alt: "Jean Yves Hector — Art & Studio" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jean Yves Hector — Art & Studio",
    description: "Minimal, quiet originals.",
    images: ["/images/og-cover.jpg"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION_TOKEN,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-white">
      <head>
        {/* Optional display font; remove if you want stricter minimalism */}
        <link href="https://fonts.googleapis.com/css2?family=Sacramento&display=swap" rel="stylesheet" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <div className="min-h-screen bg-white text-neutral-900">
            <Header />

            {/* <CheckoutHost /> */}

            <main className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 py-6 md:py-10">
              {children}
            </main>

            <footer className="px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16 py-10 border-t border-neutral-200 text-xs text-neutral-500">
              © {new Date().getFullYear()} Jean Yves Hector
            </footer>
          </div>
        </Providers>

        {/* Structured data */}
        <Script
          id="ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Jean Yves Hector",
              url: SITE_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <Script
          id="ld-person"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "Jean Yves Hector",
              url: SITE_URL,
              image: `${SITE_URL}/images/og-cover.jpg`,
              sameAs: [
                // add socials if/when you want
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
