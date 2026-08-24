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
    const cleanup = verbindeTausch();
    return () => {
      remove();
      cleanup();
    };
  }, []);

  const ungelesen = ich ? ungeleseneThreads(ich) : 0;

  return (
    <Link
      href="/postfach"
      aria-label={`Postfach${ungelesen > 0 ? ` – ${ungelesen} ungelesen` : ""}`}
      title="Postfach"
      className="relative flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100 sm:px-3"
    >
      <Mail className="h-4 w-4" />
      <span className="hidden sm:inline">Postfach</span>
      {ungelesen > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-peach-400 px-1 text-[10px] font-black text-white">
          {ungelesen}
        </span>
      )}
    </Link>
  );
}
