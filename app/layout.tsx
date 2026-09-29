import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { theme } from "./theme";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { RouteTransition } from "@/components/site/RouteTransition";
import { Analytics } from "@/components/site/Analytics";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Baguio 3D | A 3D map of Baguio City",
    template: "%s | Baguio 3D",
  },
  description:
    "A free 3D map of Baguio City: tilt the terrain, find landmarks and viewpoints, check jeepney routes and fares, and see what's open to eat and stay.",
  openGraph: {
    title: "Baguio 3D | A 3D map of Baguio City",
    description:
      "Fly over the City of Pines. Discover viewpoints, heritage, jeepney routes, and mountain food and lodging on an interactive 3D map.",
    siteName: "Baguio 3D",
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Baguio 3D | A 3D map of Baguio City",
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
      // InitColorSchemeScript sets data-theme before React hydrates.
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        archivo.variable,
        geistMono.variable,
        "font-sans",
      )}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {/* Light or dark before first paint: the stored choice, else the system setting. */}
        <InitColorSchemeScript attribute="[data-theme='%s']" defaultMode="system" />
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
            {/* Before <main> so keyboard users reach the choice early; it is fixed to the bottom of the screen. */}
            <Analytics />
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
