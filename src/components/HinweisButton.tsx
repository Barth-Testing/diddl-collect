"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { getSession } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { ladeHinweis, type Hinweis } from "@/lib/hinweis";
import { cn } from "@/lib/utils";

export function HinweisButton() {
  useStoreVersion();
  const [hinweis, setHinweis] = useState<Hinweis | null>(null);
  const ich = getSession();

  useEffect(() => {
    if (!ich) return;
    let aktiv = true;
    void ladeHinweis().then((h) => {
      if (aktiv) setHinweis(h);
    });
    return () => {
      aktiv = false;
    };
  }, [ich?.id]);

  if (!ich || !hinweis || !hinweis.aktiv || !hinweis.text.trim()) return null;

  const inhalt = (
    <>
      <Megaphone className="h-4 w-4 shrink-0" />
      <span className="truncate">{hinweis.text.trim()}</span>
    </>
  );
  const klasse =
    "flex h-12 max-w-44 items-center justify-center gap-1.5 rounded-full bg-mint-200 px-4 text-sm font-bold text-emerald-800 shadow-lg transition-transform hover:scale-105 hover:bg-mint-300";
  const link = hinweis.link?.trim() || "";
  return (
    <div className="fixed bottom-40 right-4 z-30 flex flex-col items-end gap-2 print:hidden">
      {link ? (
        /^https?:\/\//.test(link) ? (
          <a href={link} target="_blank" rel="noopener noreferrer" title={hinweis.text.trim()} className={cn(klasse)}>
            {inhalt}
          </a>
        ) : (
          <Link href={link} title={hinweis.text.trim()} className={cn(klasse)}>
            {inhalt}
          </Link>
        )
      ) : (
        <span title={hinweis.text.trim()} className={cn(klasse)}>
          {inhalt}
        </span>
      )}
    </div>
  );
}
