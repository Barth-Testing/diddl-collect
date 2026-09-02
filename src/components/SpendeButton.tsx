"use client";

import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";

type PayPalDonateConfig = {
  env: string;
  hosted_button_id: string;
  image: { src: string; alt: string; title: string };
};

type PayPalGlobal = {
  PayPal?: {
    Donation: {
      Button: (config: PayPalDonateConfig) => { render: (target: string) => void };
    };
  };
};

export function SpendeButton() {
  const [offen, setOffen] = useState(false);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    if (!offen || geladen) return;
    const fenster = window as PayPalGlobal;
    const starte = () => setGeladen(true);
    if (fenster.PayPal?.Donation) {
      starte();
      return;
    }
    const skript = document.createElement("script");
    skript.src = "https://www.paypalobjects.com/donate/sdk/donate-sdk.js";
    skript.charset = "UTF-8";
    skript.onload = starte;
    document.head.appendChild(skript);
  }, [offen, geladen]);

  useEffect(() => {
    if (!geladen) return;
    const fenster = window as PayPalGlobal;
    try {
      fenster.PayPal?.Donation.Button({
        env: "production",
        hosted_button_id: "34QBZEHBFXZ8U",
        image: {
          src: "https://www.paypalobjects.com/de_DE/DE/i/btn/btn_donateCC_LG.gif",
          alt: "Spenden mit dem PayPal-Button",
          title: "PayPal – The safer, easier way to pay online!",
        },
      }).render("#donate-button");
    } catch {
      setGeladen(false);
    }
  }, [geladen]);

  return (
    <div className="fixed bottom-24 right-4 z-30 flex flex-col items-end gap-2 print:hidden">
      {offen && (
        <div className="animate-pop card-soft w-72 max-w-[calc(100vw-2rem)] p-4 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-sm font-bold text-ink-800">Knuddel-Herz bitte!</p>
              <p className="mt-0.5 text-xs font-semibold text-ink-600">
                Damit die Sammelstube weiterläuft.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOffen(false)}
              aria-label="Schließen"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cream-100 text-ink-600 hover:bg-candy-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3">
            <div id="donate-button-container">
              <div id="donate-button" />
            </div>
            {!geladen && (
              <p className="text-center text-xs font-semibold text-ink-600">
                PayPal-Button wird geladen …
              </p>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-label="Spenden"
        title="Spenden"
        className="flex h-12 w-36 items-center justify-center gap-1.5 rounded-full bg-candy-500 px-4 text-sm font-bold text-white shadow-lg shadow-candy-300/40 transition-transform hover:scale-105 hover:bg-candy-600"
      >
        <Heart className="h-4 w-4 fill-white" />
        <span className={offen ? "hidden" : "inline"}>Spenden</span>
      </button>
    </div>
  );
}
