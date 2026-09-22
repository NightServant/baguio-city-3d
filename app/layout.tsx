import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { theme } from "./theme";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ElevationRail } from "@/components/site/ElevationRail";
import { RouteTransition } from "@/components/site/RouteTransition";

// One family, worked at two extremes. Archivo is variable on BOTH weight and
// width, so the width axis becomes an active design element: display type is
// stretched like warp under tension, body text sits at normal width.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  axes: ["wdth"],
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
        archivo.variable,
        geistMono.variable,
        "font-sans",
      )}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {/* AppRouterCacheProvider collects Emotion's CSS while Next streams
            chunks; without it MUI styles flash in after hydration. */}
        <AppRouterCacheProvider options={{ key: "mui" }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <a
              href="#main-content"
              className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <SiteNav />
            <ElevationRail />
            <main id="main-content" className="flex-1">
              <RouteTransition>{children}</RouteTransition>
            </main>
            <SiteFooter />
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
