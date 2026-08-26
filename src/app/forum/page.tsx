import { ForumApp } from "@/components/ForumApp";

export const metadata = {
  title: "Forum & Chat für Diddl-Sammler – Diddl-Collect",
  description:
    "Das Knuddel-Chätsch für Diddl-Sammler: Tauschangebote posten, verlorene Blätter finden und mit der Sammel-Gemeinde plaudern.",
  alternates: { canonical: "/forum" },
};

export default function ForumSeite() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        Knuddel-<span className="text-candy-500">Chätsch</span>
      </h1>
      <p className="mt-1 text-ink-600">
        Hier plaudern Sammler: Tauschangebote, verlorene Schätze, Fragen zum Album – alles
        herzlich willkommen.
      </p>
      <ForumApp />
    </main>
  );
}
