import type { Metadata, Viewport } from "next";
import { Nunito, Quicksand } from "next/font/google";
import Script from "next/script";
import { Header, Footer } from "@/components/Header";
import { PwaRegistrierung } from "@/components/PwaRegistrierung";
import { SpendeButton } from "@/components/SpendeButton";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

const SEITEN_URL = "https://diddl-collect.pages.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SEITEN_URL),
  title: {
    default: "Diddl Collect – Sammelalbum & Katalog für Diddl-Blätter",
    template: "%s",
  },
  description:
    "Diddl-Collect: Das kostenlose inoffizielle Sammelalbum für Diddl-Blätter. Katalog mit allen Motiven durchstöbern, Häkchen setzen, Wunschliste pflegen, Doppelte tauschen und in der Sammler-Rangliste punkten.",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SEITEN_URL,
    siteName: "Diddl-Collect",
    title: "Diddl Collect – Sammelalbum & Katalog für Diddl-Blätter",
    description:
      "Alle Diddl-Blätter sammeln: Katalog stöbern, Häkchen setzen, Wünsche träumen und Doppelte mit anderen Sammlern tauschen.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Diddl-Collect – das Sammelalbum für Diddl-Blätter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Diddl Collect – Sammelalbum & Katalog für Diddl-Blätter",
    description:
      "Alle Diddl-Blätter sammeln: Katalog stöbern, Häkchen setzen, Wünsche träumen und Doppelte tauschen.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Diddl-Collect",
    statusBarStyle: "default",
  },
  other: {
    "google-adsense-account": "ca-pub-9547389888021360",
  },
};

export const viewport: Viewport = {
  themeColor: "#f9679c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${nunito.variable} ${quicksand.variable}`}>
      <body>
        <Header />
        {children}
        <Footer />
        <SpendeButton />
        <PwaRegistrierung />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Diddl-Collect",
              alternateName: "Diddl Collect",
              url: SEITEN_URL,
              inLanguage: "de-DE",
              description:
                "Kostenloses inoffizielles Sammelalbum für Diddl-Blätter: Katalog, Wunschliste, Tauschbörse und Sammler-Rangliste.",
            }),
          }}
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9547389888021360"
          crossOrigin="anonymous"
        />
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-D0RQYZ4M49" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-D0RQYZ4M49');`}
        </Script>
      </body>
    </html>
  );
}