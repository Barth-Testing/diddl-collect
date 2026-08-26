import { Suspense } from "react";
import { SammlerProfilApp } from "@/components/SammlerProfilApp";

export const metadata = {
  title: "Sammlerprofil – Diddl-Collect",
  description:
    "Sammlerprofil bei Diddl Collect: Punkte, Beweise und das Karussell der Lieblingsblätter anderer Sammler entdecken.",
  alternates: { canonical: "/sammler" },
};

export default function SammlerSeite() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        Sammler<span className="text-candy-500">profil</span>
      </h1>
      <Suspense
        fallback={<div className="card-soft mt-6 p-6 text-sm font-semibold text-ink-600">Lade Profil …</div>}
      >
        <SammlerProfilApp />
      </Suspense>
    </main>
  );
}
