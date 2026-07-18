import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import { INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, SITE_PHONE, SITE_EMAIL } from "@/lib/site";

const SITE_URL = "https://www.adoughcookie.com";
const TITLE = "a dough cookie — Aroma of Freshness";
const DESCRIPTION = "Handcrafted cookies baked fresh daily. Premium cookies delivered warm to your door.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "a dough cookie",
    locale: "en_IN",
    type: "website",
    images: [{ url: "/assets/hero-cookies.jpg", width: 1200, height: 630, alt: "a dough cookie — freshly baked cookies" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/assets/hero-cookies.jpg"],
  },
};

// Tells Google what kind of business this is (name, contact, socials) — the structured-data half
// of SEO that a plain <title>/<meta description> doesn't cover.
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Bakery",
  name: "a dough cookie",
  alternateName: "ADC",
  url: SITE_URL,
  logo: `${SITE_URL}/assets/adc-logo.png`,
  image: `${SITE_URL}/assets/hero-cookies.jpg`,
  description: DESCRIPTION,
  sameAs: [INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL],
  telephone: SITE_PHONE,
  email: SITE_EMAIL,
};

// Without this, mobile browsers use a ~980px layout viewport and scale down,
// so no max-width media query fires and pages render as a shrunk desktop layout.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cabin:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Hanken+Grotesk:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
