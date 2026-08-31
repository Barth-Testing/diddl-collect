"use client";

import { LogOut, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { getSession, logout } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";

export function HeaderBenutzer() {
  useStoreVersion();
  const benutzer = getSession();

  if (!benutzer) {
    return (
      <Link
        href="/konto"
        className="flex items-center gap-1.5 rounded-full bg-candy-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-candy-600"
      >
        <UserCircle2 className="h-4 w-4" />
        <span className="hidden 2xl:inline">Anmelden</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/konto"
        className="flex items-center gap-1.5 rounded-full bg-candy-100 px-3 py-2 text-sm font-bold text-candy-700 hover:bg-candy-200"
        title="Angemeldet als"
      >
        <span className="flex shrink-0 h-5 w-5 items-center justify-center rounded-full bg-candy-400 text-[10px] font-black text-white">
          {benutzer.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate 2xl:inline">{benutzer.name}</span>
      </Link>
      <button
        onClick={() => logout()}
        className="flex shrink-0 items-center justify-center rounded-full p-2 text-ink-600 hover:bg-candy-100"
        title="Abmelden"
        aria-label="Abmelden"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}