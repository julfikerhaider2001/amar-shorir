import type { Metadata, Viewport } from "next";
import { Baloo_Da_2, Noto_Sans_Bengali } from "next/font/google";
import { t } from "./i18n";
import { withBase } from "./lib/paths";
import "./globals.css";

// Baloo Da 2 is a round, friendly Bangla display face for headings; Noto Sans
// Bengali is a plain, very legible text face. Both shape conjuncts (যুক্তাক্ষর)
// correctly and draw digits in their familiar forms (Hind Siliguri was tried,
// but its ১ is an unusual small hook). Self-hosted by next/font.
const display = Baloo_Da_2({ variable: "--font-display", subsets: ["bengali", "latin"], weight: ["500", "600", "700", "800"] });
const body = Noto_Sans_Bengali({ variable: "--font-body", subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"] });

/** Origin only — the Pages subpath is added by `withBase`. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://anatomy-atelier.openai.site");

const image = { url: withBase("/og.jpg"), width: 1200, height: 675, alt: t.meta.imageAlt };

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: t.meta.title,
  description: t.meta.description,
  applicationName: t.brand.name,
  alternates: { canonical: withBase("/") },
  icons: {
    icon: [
      { url: withBase("/favicon.svg"), type: "image/svg+xml" },
      { url: withBase("/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withBase("/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    shortcut: withBase("/favicon.svg"),
    apple: { url: withBase("/apple-touch-icon.png"), sizes: "180x180" },
  },
  openGraph: {
    type: "website",
    siteName: t.brand.name,
    locale: "bn_BD",
    title: t.meta.title,
    description: t.meta.description,
    images: [image],
  },
  twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description, images: [image] },
};

export const viewport: Viewport = { themeColor: "#fff4d6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
