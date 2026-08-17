import { KontoApp } from "@/components/KontoApp";

export const metadata = {
  title: "Meine Diddl-Blätter-Sammlung – Diddl Collect | Knuddelblätter",
  description:
    "Diddl-Blätter-Sammlung verwalten: Konto anlegen, Besitz und Wunschliste pflegen, Doppelte als Tauschangebot markieren und Beweise hochladen.",
  alternates: { canonical: "/konto" },
};

export default function KontoSeite() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        Meine <span className="text-candy-500">Sammlung</span>
      </h1>
      <KontoApp />
    </main>
  );
}