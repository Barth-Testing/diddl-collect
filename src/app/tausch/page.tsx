import { TauschboerseApp } from "@/components/TauschboerseApp";

export const metadata = {
  title: "Tauschbörse für Diddl-Blätter – Diddl Collect | Knuddelblätter",
  description:
    "Die Tauschbörse für Diddl-Sammler: Offene Tauschangebote aller Sammler entdecken, eigene Doppelblätter anbieten und private Verhandlungen führen.",
  alternates: { canonical: "/tausch" },
};

export default function TauschSeite() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        Die Tausch-<span className="text-candy-500">börse</span>
      </h1>
      <p className="mt-1 text-ink-600">
        Zeig, was du sammelst und tausche Doppelte: Blätter oder Geldbetrag vorschlagen, im
        Postfach verhandeln – ganz ohne Zwischenhändler.
      </p>
      <TauschboerseApp />
    </main>
  );
}
