"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { getSession } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { subscribeTausch, ungeleseneThreads, verbindeTausch } from "@/lib/tausch";

export function PostfachLink() {
  useStoreVersion();
  const [, setVersion] = useState(0);
  const ich = getSession();

  useEffect(() => {
    const remove = subscribeTausch(() => setVersion((v) => v + 1));
    /* Ohne Anmeldung gibt es keine Ungelesen-Markierung – die schweren
       Tausch-Downloads (Angebote + Posts) müssen dann nicht auf jedem
       Seitenaufruf mitlaufen. */
    const cleanup = ich ? verbindeTausch() : () => {};
    return () => {
      remove();
      cleanup();
    };
  }, [ich?.id]);

  const ungelesen = ich ? ungeleseneThreads(ich) : 0;

  return (
    <Link
      href="/postfach"
      aria-label={`Postfach${ungelesen > 0 ? ` – ${ungelesen} ungelesen` : ""}`}
      title="Postfach"
      className="relative flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1.5 text-xs font-bold text-ink-700 hover:bg-candy-100 sm:px-2.5"
    >
      <Mail className="h-3.5 w-3.5" />
      <span className="hidden 2xl:inline">Postfach</span>
      {ungelesen > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-peach-400 px-1 text-[10px] font-black text-white">
          {ungelesen}
        </span>
      )}
    </Link>
  );
}
