import Link from "next/link";
import { HeartHandshake, LayoutGrid, MessagesSquare, PawPrint, Trophy } from "lucide-react";
import { MausKlein } from "./MausMotto";
import { HeaderBenutzer } from "./HeaderBenutzer";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-candy-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 text-ink-800 hover:opacity-80">
          <MausKlein className="h-10 w-10" />
          <span className="font-display text-xl font-bold tracking-tight">
            Knuddel<span className="text-candy-500">blätter</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/katalog"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Katalog</span>
          </Link>
          <Link
            href="/rangliste"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100"
          >
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Rangliste</span>
          </Link>
          <Link
            href="/forum"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-ink-700 hover:bg-candy-100"
          >
            <MessagesSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Forum</span>
          </Link>
          <Link
            href="/konto"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-candy-600 hover:bg-candy-100"
          >
            <HeartHandshake className="h-4 w-4" />
            <span className="hidden sm:inline">Meine Sammlung</span>
          </Link>
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
            Knuddelblätter – ein inoffizielles Sammelalbum für Diddl&nbsp;Blätter. Bilder stammen aus
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