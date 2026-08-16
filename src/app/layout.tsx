import type { Metadata, Viewport } from "next";
import { Nunito, Quicksand } from "next/font/google";
import Script from "next/script";
import { Header, Footer } from "@/components/Header";
import { PwaRegistrierung } from "@/components/PwaRegistrierung";
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

export const metadata: Metadata = {
  title: {
    default: "Knuddelblätter – Diddl-Blätter Sammelalbum",
    template: "%s",
  },
  description:
    "Das süße Sammelalbum für Diddl-Blätter: Katalog stöbern, sammeln, Wünsche träumen und Doppelte tauschen.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Knuddelblätter",
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
        <PwaRegistrierung />
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