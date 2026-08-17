import { RangApp } from "@/components/RangApp";

export const metadata = {
  title: "Rangliste der Diddl-Sammler – Diddl Collect | Knuddelblätter",
  description:
    "Wer sammelt die meisten Diddl-Blätter? Punkte sammeln, Plätze erklimmen und mit Foto-Beweisen in die Top-100 der Diddl-Sammler aufsteigen.",
  alternates: { canonical: "/rangliste" },
};

export default function RanglisteSeite() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        Die große Sammler-<span className="text-candy-500">Rangliste</span>
      </h1>
      <p className="mt-1 text-ink-600">
        Punkte gibt es für jedes Blatt in der Sammlung – wer über 100 Blätter angibt, muss sie
        per Foto beweisen, um ganz oben zu stehen.
      </p>
      <RangApp />
    </main>
  );
}