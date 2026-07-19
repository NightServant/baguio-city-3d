import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

// Body / UI text — clean, quiet grotesk.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// Display face — Fraunces carries the editorial, heritage-warm personality.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

// Mono — the "survey readout" voice for coordinates, elevations, fares, years.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://baguio3d.example"),
  title: {
    default: "Baguio 3D — Explore the Summer Capital in three dimensions",
    template: "%s — Baguio 3D",
  },
  description:
    "An interactive 3D map and field guide to Baguio City: pine-forest viewpoints, American-era heritage, jeepney routes, and where to eat and stay in the Summer Capital of the Philippines.",
  openGraph: {
    title: "Baguio 3D — Explore the Summer Capital in three dimensions",
    description:
      "Fly over the City of Pines. Discover viewpoints, heritage, jeepney routes, and mountain food and lodging on an interactive 3D map.",
    siteName: "Baguio 3D",
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Baguio 3D — Explore the Summer Capital in three dimensions",
    description:
      "Fly over the City of Pines. Discover viewpoints, heritage, jeepney routes, and mountain food and lodging on an interactive 3D map.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        inter.variable,
        fraunces.variable,
        geistMono.variable,
        "font-sans",
      )}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <SiteNav />
        <main id="main-content" className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
