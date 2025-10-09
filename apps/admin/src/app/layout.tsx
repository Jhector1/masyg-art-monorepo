// apps/admin/src/app/layout.tsx  ← SERVER component (no "use client")
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ClientFrame from "@/components/ClientFrame";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions); // ✅ v4-safe

  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Sacramento&display=swap" rel="stylesheet" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClientFrame
          user={{ name: session?.user?.name ?? "Admin", email: session?.user?.email ?? "" }}
        >
          {children}
        </ClientFrame>
      </body>
    </html>
  );
}
