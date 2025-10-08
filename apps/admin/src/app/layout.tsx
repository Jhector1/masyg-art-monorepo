// import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// import Script from "next/script";

// import { UserProvider } from "@acme/core/contexts/UserContext";
// import { CartProvider } from "@acme/core/contexts/CartContext";
import Header from "@acme/ui/components/header/Header";
// import { FavoriteProvider } from "@acme/core/contexts/FavoriteContext";
import Head from "next/head";
import AdminHeader from "../components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});



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
        {/* <UserProvider>
          <CartProvider>
            <FavoriteProvider> */}
              <div className="bg-[#0f0f1a] bg-dot-grid bg-[length:var(--tw-background-size-dot-grid)] min-h-screen bg-gradient-to-r from-amber-100 via-white to-slate-100 text-gray-900">
                {/* <Header /> */}
                <AdminHeader/>
                {/* <Toaster position="top-right" /> */}

                {/* <GuestInit/> */}

                <main className="px-2 md:px-10 lg:px-20">{children}</main>
                {/* <CheckoutHost /> */}

                <footer className="text-center text-sm py-6">
                  &copy; 2024 ZileDigital Market
                </footer>
              </div>
            {/* </FavoriteProvider>
          </CartProvider> */}
        {/* </UserProvider> */}
        {/* </UserProvider> */}

        {/* // ...inside RootLayout return(), just before </body>: */}

       
      </body>
    </html>
  );
}
