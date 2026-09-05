"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function NachObenButton() {
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    const aktualisieren = () => setSichtbar(window.scrollY > 600);
    aktualisieren();
    window.addEventListener("scroll", aktualisieren, { passive: true });
    return () => window.removeEventListener("scroll", aktualisieren);
  }, []);

  if (!sichtbar) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Nach oben scrollen"
      title="Nach oben"
      className="fixed bottom-4 left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-700 shadow-lg ring-1 ring-cream-300 transition-transform hover:scale-105 hover:bg-candy-100 hover:text-candy-700 print:hidden"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
