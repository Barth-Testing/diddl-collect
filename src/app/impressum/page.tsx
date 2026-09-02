import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Impressum – Diddl-Collect",
  description:
    "Impressum und Angaben zum Betreiber von Diddl-Collect, dem inoffiziellen Sammelalbum für Diddl-Blätter.",
  alternates: { canonical: "/impressum" },
};

export default function ImpressumSeite() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        <span className="text-candy-500">Impressum</span>
      </h1>
      <p className="mt-1 text-ink-600">Angaben gemäß § 5 TMG / § 18 MStV.</p>

      <section className="card-soft mt-8 space-y-6 p-6">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">Angaben zum Betreiber</h2>
          <p className="mt-2 text-ink-700">
            Diddl-Collect
            <br />
            Toni Barth
            <br />
            <span className="text-ink-500">(Anschrift auf Anfrage)</span>
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">Kontakt</h2>
          <p className="mt-2 text-ink-700">
            E-Mail-Anfragen über das Kontaktformular der jeweiligen Plattform oder direkt über die
            im Impressum hinterlegten Wege.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">Verantwortlich für den Inhalt</h2>
          <p className="mt-2 text-ink-700">
            Toni Barth
            <br />
            <span className="text-ink-500">(Anschrift auf Anfrage)</span>
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">Urheberrecht &amp; Marken</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Diddl-Collect ist ein inoffizielles, nicht von den Rechteinhabern autorisiertes Projekt.
            Alle abgebildeten Motive und die Marke „Diddl“ gehören ihren Rechteinhabern (Diddl Studios /
            Thomas Goletz). Die Bilder werden ausschließlich als Hotlinks zu Katalog-Zwecken angezeigt
            und nicht reproduziert. Wenn du der Meinung bist, dass Inhalte dieser Seite Rechte
            verletzen, melde dich bitte, damit wir die Inhalte umgehend prüfen und entfernen können.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">Haftung für Links</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Diese Seite enthält Links zu externen Webseiten Dritter (z. B. diddl-exchange.de, Amazon
            und den Amazon-Partnerprogramm-Angeboten). Auf die Inhalte dieser externen Seiten haben
            wir keinen Einfluss. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
            Anbieter verantwortlich.
          </p>
        </div>
      </section>

      <div className="mt-8">
        <Link
          href="/"
          className="chip gap-1.5 bg-white px-5 py-2.5 text-candy-600 ring-2 ring-candy-200 transition hover:bg-candy-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
