import { PostfachApp } from "@/components/PostfachApp";

export const metadata = {
  title: "Tausch-Postfach – Diddl Collect | Knuddelblätter",
  description:
    "Dein privates Tausch-Postfach: Verhandlungen, Nachrichten und Entscheidungen zu deinen Tauschangeboten auf einen Blick.",
  alternates: { canonical: "/postfach" },
};

export default function PostfachSeite() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        Tausch-<span className="text-candy-500">Postfach</span>
      </h1>
      <p className="mt-1 text-ink-600">
        Hier laufen deine Tausch-Verhandlungen zusammen – annehmen, ablehnen oder einfach weiter
        quatschen.
      </p>
      <PostfachApp />
    </main>
  );
}
