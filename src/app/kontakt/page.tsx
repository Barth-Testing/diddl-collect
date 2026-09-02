import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { KontaktFormular } from "@/components/KontaktFormular";

export const metadata: Metadata = {
  title: "Kontakt – Diddl-Collect",
  description:
    "Kontakt zum Diddl-Collect-Betreiber: Fragen, Probleme, Tausch-Themen oder Anregungen – über unser Kontaktformular oder per E-Mail an math.tricks.mail@gmail.com.",
  alternates: { canonical: "/kontakt" },
};

export default function KontaktSeite() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-berry-100 text-berry-500">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-800 sm:text-3xl">
            <span className="text-berry-500">Kontakt</span> aufnehmen
          </h1>
          <p className="text-sm font-semibold text-ink-600">
            Wir helfen dir gerne weiter – melde dich einfach!
          </p>
        </div>
      </div>

      <section className="card-soft mt-8 p-6">
        <h2 className="font-display text-lg font-bold text-ink-800">Schreib uns eine Nachricht</h2>
        <p className="mt-1 text-sm text-ink-600">
          Wenn du Kontakt aufnehmen willst – ob zu deinem Konto, einem Tausch-Thema, einer Idee
          oder einfach, um Hallo zu sagen – schreib uns hier. Deine Nachricht landet direkt beim
          Betreiber. Du brauchst kein Konto, um uns zu schreiben.
        </p>
        <div className="mt-5">
          <KontaktFormular modus="seite" />
        </div>
      </section>

      <section className="card-soft mt-6 space-y-2 p-6 text-sm text-ink-700">
        <h2 className="font-display text-lg font-bold text-ink-800">Noch Fragen?</h2>
        <p>
          Lieber direkt per E-Mail? Schreib uns an{" "}
          <a
            href="mailto:math.tricks.mail@gmail.com"
            className="font-semibold text-berry-500 underline decoration-berry-200 underline-offset-2 hover:text-berry-600"
          >
            math.tricks.mail@gmail.com
          </a>
          .
        </p>
        <p className="text-ink-600">
          Zum Konto-Passwort &amp; Datenschutz siehe{" "}
          <Link href="/impressum" className="font-semibold text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700">
            Impressum
          </Link>{" "}
          und{" "}
          <Link href="/datenschutz" className="font-semibold text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700">
            Datenschutz
          </Link>
          .
        </p>
      </section>

      <div className="mt-8">
        <Link
          href="/"
          className="chip gap-1.5 bg-white px-5 py-2.5 text-berry-500 ring-2 ring-berry-200 transition hover:bg-berry-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
