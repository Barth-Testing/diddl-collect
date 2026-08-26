import Link from "next/link";
import { ArrowLeftRight, HeartHandshake, LayoutGrid, MessagesSquare, PawPrint, ShoppingBag, Trophy } from "lucide-react";
import { MausKlein } from "./MausMotto";
import { HeaderBenutzer } from "./HeaderBenutzer";
import { AppInstallieren } from "./AppInstallieren";
import { PostfachLink } from "./PostfachLink";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-candy-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink-800 hover:opacity-80">
          <MausKlein className="h-9 w-9 sm:h-10 sm:w-10" />
          <span className="font-display hidden text-xl font-bold tracking-tight sm:inline">
            Diddl-<span className="text-candy-500">Collect</span>
          </span>
        </Link>
        <nav className="no-scrollbar -mx-1 flex min-w-0 shrink items-center gap-0.5 overflow-x-auto px-1 sm:gap-2">
          <Link
            href="/katalog"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100 sm:px-3"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden lg:inline">Katalog</span>
          </Link>
          <Link
            href="/rangliste"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100 sm:px-3"
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden lg:inline">Rangliste</span>
          </Link>
          <Link
            href="/forum"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100 sm:px-3"
          >
            <MessagesSquare className="h-4 w-4" />
            <span className="hidden lg:inline">Forum</span>
          </Link>
          <Link
            href="/tausch"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100 sm:px-3"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden lg:inline">Tauschbörse</span>
          </Link>
          <Link
            href="/konto"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-2 text-sm font-bold text-candy-600 hover:bg-candy-100 sm:px-3"
          >
            <HeartHandshake className="h-4 w-4" />
            <span className="hidden lg:inline">Meine Sammlung</span>
          </Link>
          <Link
            href="/shop"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-peach-100 px-1.5 py-2 text-sm font-bold text-peach-500 hover:bg-peach-200 sm:px-3"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden lg:inline">Shop</span>
          </Link>
          <AppInstallieren className="flex shrink-0 items-center gap-1.5 rounded-full bg-mint-200 px-1.5 py-2 text-sm font-bold text-emerald-800 hover:bg-mint-300 sm:px-3" />
          <PostfachLink />
          <HeaderBenutzer />
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-candy-100 bg-white/70">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-10 text-sm text-ink-600">
        <div className="flex items-center gap-2">
          <PawPrint className="h-4 w-4 text-candy-400" />
          <p>
            Diddl-Collect – ein inoffizielles Sammelalbum für Diddl&nbsp;Blätter. Bilder stammen aus
            dem öffentlichen Katalog von{" "}
            <a
              href="https://www.diddl-exchange.de"
              target="_blank"
              rel="noopener noreferrer"
              className="text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700"
            >
              diddl-exchange.de
            </a>
            .
          </p>
        </div>
        <p>
          Alle abgebildeten Motive gehören ihren Rechteinhabern (Diddl&nbsp;Studios / Thomas
          Goletz) und werden hier ausschließlich als Verlinkung zu Katalog-Zwecken angezeigt.
          Alle Angaben werden nur lokal in deinem Browser gespeichert.
        </p>
      </div>
    </footer>
  );
}