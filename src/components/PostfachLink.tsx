"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { getSession, holSessionToken } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import {
  ladeUngelesen,
  lesestandAktiv,
  subscribeTausch,
  ungeleseneThreads,
  verbindeTausch,
} from "@/lib/tausch";

export function PostfachLink() {
  useStoreVersion();
  const [, setVersion] = useState(0);
  const ich = getSession();

  useEffect(() => {
    const remove = subscribeTausch(() => setVersion((v) => v + 1));
    /* Ohne Anmeldung gibt es keine Ungelesen-Markierung. */
    if (!ich) return () => remove();

    /* Server-Lesestand (geräteübergreifend): winzige RPC, kein Voll-Download.
       Egress-Guard: tauschangebot/postnachrichten werden hier NIE mehr global
       geladen. Poll 60 s + Fokus/Sichtbarkeit. */
    let tot = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let cleanupAlt: (() => void) | null = null;
    const pruefe = () => {
      if (!document.hidden) void ladeUngelesen();
    };
    void ladeUngelesen().then(() => {
      if (tot || !holSessionToken()) return;
      if (lesestandAktiv()) {
        pollTimer = setInterval(pruefe, 60_000);
        document.addEventListener("visibilitychange", pruefe);
        window.addEventListener("focus", pruefe);
      } else {
        /* DB-Migration noch nicht eingespielt: altes Verhalten (voller Sync). */
        cleanupAlt = verbindeTausch();
      }
    });
    return () => {
      tot = true;
      remove();
      if (pollTimer !== undefined) clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", pruefe);
      window.removeEventListener("focus", pruefe);
      cleanupAlt?.();
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
