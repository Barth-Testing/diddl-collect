import type { Metadata } from "next";
import { Nunito, Quicksand } from "next/font/google";
import { Header, Footer } from "@/components/Header";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${nunito.variable} ${quicksand.variable}`}>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}