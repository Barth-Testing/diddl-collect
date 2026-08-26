import { KatalogApp } from "@/components/KatalogApp";

export const metadata = {
  title: "Katalog aller Diddl-Blätter – Diddl-Collect",
  description:
    "Alle Diddl-Blätter im Katalog: nach Jahr, Größe oder Farbe sortieren und filtern, Häkchen setzen, Wunschliste pflegen und Doppelte tauschen.",
  alternates: { canonical: "/katalog" },
};

export default function KatalogSeite() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        Der große Blätter-<span className="text-candy-500">Katalog</span>
      </h1>
      <p className="mt-1 text-ink-600">
        Alle Diddl&nbsp;Blätter auf einen Blick. Häkchen setzen, Wunschliste pflegen und Tausch-Angebote
        machen – alles im Browser gespeichert.
      </p>
      <KatalogApp />
    </main>
  );
}