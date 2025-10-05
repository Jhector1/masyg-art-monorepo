import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

import { UserProvider } from "@acme/core/contexts/UserContext";
import { CartProvider } from "@acme/core/contexts/CartContext";
import Header from "@acme/ui/components/header/Header";
import { FavoriteProvider } from "@acme/core/contexts/FavoriteContext";
import Head from "next/head";
// import GuestInit from "@/components/GuessInit";
import { Toaster } from "react-hot-toast";
import CheckoutHost from "@acme/ui/components/orders/CheckoutHost";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "https://ziledigital.com";

export const viewport: Viewport = {
  themeColor: "#0f0f1a",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ZileDigital — Haitian Veve & Afro-Caribbean Wall Art",
    template: "%s | ZileDigital",
  },
  description:
    "Shop Haitian veve and Afro-Caribbean wall art as instant digital downloads or premium prints. Customizable colors, frames, and sizes. High-resolution PNG/JPG/SVG/PDF. Support Haitian artists.",
  keywords: [
    // Core brand & marketplace
    "ZileDigital",
    "Zile Digital",
    "Haitian art marketplace",
    "buy Haitian art online",
    "Haiti art shop",
    // Category & format
    "Haitian art",
    "Haitian wall art",
    "Afro-Caribbean art",
    "Caribbean wall art",
    "digital art download",
    "instant download art",
    "printable wall art",
    "SVG vector art",
    "veve SVG",
    "PNG JPG PDF",
    "canvas prints",
    "fine art prints",
    "frame-ready prints",
    "gallery wall",
    // Veve & Vodou long-tail
    "veve symbols",
    "Vodou veve",
    "Vodou art",
    "Erzulie veve",
    "Papa Legba veve",
    "Ogou veve",
    "Damballa veve",
    "Baron Samedi veve",
    "Marassa veve",
    "Gede veve",
    "minimalist veve art",
    "line art veve",
    "sacred symbols art",
    // Use cases & intents
    "Haiti home decor",
    "Caribbean home decor",
    "Haitian culture gifts",
    "boho wall art",
    "black art prints",
    "diaspora art",
    "tropical art prints",
    "Haitian flag art",
    // Product attributes & features
    "high resolution printable",
    "customizable art",
    "custom art prints",
    "color customizable art",
    "downloadable wall art",
    "vector cut files veve",
    // Geo & artist tags (long-tail)
    "Port-au-Prince artists",
    "Cap-Haïtien art",
  ],
  authors: [{ name: "ZileDigital" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ZileDigital — Haitian Veve & Afro-Caribbean Wall Art",
    description:
      "Explore Haitian veve symbols and Afro-Caribbean artwork as digital downloads or premium prints. Customize colors, frames, and sizes.",
    url: "/",
    siteName: "ZileDigital",
    images: [
      {
        url: "/images/why-haitian-art.png",
        width: 1200,
        height: 630,
        alt: "ZileDigital — Haitian Veve & Afro-Caribbean Wall Art",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@ziledigital", // keep if you own it; otherwise remove
    creator: "@ziledigital", // keep if you own it; otherwise remove
    title: "ZileDigital — Haitian Veve & Afro-Caribbean Wall Art",
    description:
      "Instant digital downloads & premium prints. Custom colors, frames, and sizes. Support Haitian artists.",
    images: ["/images/why-haitian-art.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      // maxSnippet: -1,
      // maxImagePreview: "large",
      // maxVideoPreview: -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    // fill these if/when you verify your site:
    google: process.env.GOOGLE_SITE_VERIFICATION_TOKEN,
    // bing: "BING_SITE_VERIFICATION_TOKEN",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Sacramento&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* <UserProvider> */}
        <UserProvider>
          <CartProvider>
            <FavoriteProvider>
              <div className="bg-[#0f0f1a] bg-dot-grid bg-[length:var(--tw-background-size-dot-grid)] min-h-screen bg-gradient-to-r from-amber-100 via-white to-slate-100 text-gray-900">
                <Header />
                <Toaster position="top-right" />

                {/* <GuestInit/> */}

                <main className="px-2 md:px-10 lg:px-20">{children}</main>
                <CheckoutHost />

                <footer className="text-center text-sm py-6">
                  &copy; 2024 ZileDigital Market
                </footer>
              </div>
            </FavoriteProvider>
          </CartProvider>
        </UserProvider>
        {/* </UserProvider> */}

        {/* // ...inside RootLayout return(), just before </body>: */}

        <Script
          id="ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "ZileDigital",
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
          id="ld-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ZileDigital",
              url: SITE_URL,
              logo: `${SITE_URL}/images/why-haitian-art.png`,
              sameAs: [
                "https://instagram.com/ziledigital",
                "https://x.com/ziledigital",
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
