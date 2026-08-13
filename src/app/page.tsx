import Link from "next/link";
import { Camera, Heart, LayoutGrid, Repeat2, Sparkles, Trophy } from "lucide-react";
import { MausMotto } from "@/components/MausMotto";
import { BLAETTER } from "@/lib/blaetter";

export default function Startseite() {
  const einzigartigeFarben = new Set(BLAETTER.map((b) => b.farbe)).size;
  const jahre = `${Math.min(...BLAETTER.map((b) => b.jahr))}–${Math.max(...BLAETTER.map((b) => b.jahr))}`;

  return (
    <main>
      <section className="blob mx-auto max-w-6xl px-4 pt-14 pb-8 text-center sm:pt-20">
        <div className="flex justify-center">
          <MausMotto className="animate-floaty h-36 w-36 sm:h-44 sm:w-44" />
        </div>
        <h1 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-ink-800 sm:text-6xl">
          Sammel alle <span className="text-candy-500">Knuddelblätter</span>!
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-600 sm:text-lg">
          Pippo, Diddlina &amp; Co. zum Greifen nah: Durchstöbere den großen Katalog,
          setze Häkchen, träume auf deiner Wunschliste und tausche Doppelte mit anderen
          Sammlern.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/katalog"
            className="rounded-full bg-candy-500 px-6 py-3 font-bold text-white shadow-lg shadow-candy-300/50 transition hover:-translate-y-0.5 hover:bg-candy-600"
          >
            Jetzt stöbern
          </Link>
          <Link
            href="/konto"
            className="rounded-full bg-white px-6 py-3 font-bold text-candy-600 ring-2 ring-candy-200 transition hover:-translate-y-0.5 hover:bg-candy-100"
          >
            Meine Sammlung
          </Link>
        </div>
        <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-3">
          <Stat wert={String(BLAETTER.length)} label="Blätter im Katalog" />
          <Stat wert={String(einzigartigeFarben)} label="Motiv-Farben" />
          <Stat wert={jahre} label="Jahrgänge" />
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-center text-2xl font-bold text-ink-800">
          So sammelst du <span className="text-candy-500">mit Trixi</span>
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureKarte
            icon={<LayoutGrid className="h-6 w-6" />}
            titel="Katalog stöbern"
            text="Alle Blätter von Din A4 bis A6 in Bildern – sortiert nach Jahr, Größe oder Farbe."
            link="/katalog"
            linkText="Zum Katalog"
            farbe="bg-candy-100 text-candy-600"
          />
          <FeatureKarte
            icon={<Heart className="h-6 w-6" />}
            titel="Häkchen & Wunschliste"
            text="Setze per Klick, was du besitzt oder dir wünschst – direkt im Übersichtskatalog."
            link="/katalog"
            linkText="Häkchen setzen"
            farbe="bg-berry-100 text-berry-400"
          />
          <FeatureKarte
            icon={<Repeat2 className="h-6 w-6" />}
            titel="Doppelte tauschen"
            text="Markiere Blätter als Tausch-Angebot und finde Sammler mit passenden Wünschen."
            link="/konto"
            linkText="Angebote ansehen"
            farbe="bg-peach-100 text-peach-500"
          />
          <FeatureKarte
            icon={<Trophy className="h-6 w-6" />}
            titel="Punkte & Beweise"
            text="Für jeden Besitz gibt es Punkte. Für Plätze in der Top-100 brauchst du Foto-Beweise."
            link="/rangliste"
            linkText="Zur Rangliste"
            farbe="bg-mint-100 text-emerald-600"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="card-soft flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-candy-100 text-candy-600">
            <Camera className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold text-ink-800">Fair bleibt fair: Beweise zählen</h3>
            <p className="text-sm text-ink-600">
              Wer mehr als 100 eigene Blätter angibt, muss ab dann für die Rangliste belegen, was er
              besitzt – ein Foto pro Blatt genügt. So schummeln keine Fantasie-Sammlungen nach oben.
            </p>
          </div>
          <Sparkles className="hidden h-8 w-8 text-candy-300 sm:block" />
        </div>
      </section>
    </main>
  );
}

function Stat({ wert, label }: { wert: string; label: string }) {
  return (
    <dd className="card-soft rounded-2xl px-3 py-4">
      <p className="font-display text-2xl font-bold text-candy-500">{wert}</p>
      <p className="text-xs font-bold text-ink-600">{label}</p>
    </dd>
  );
}

function FeatureKarte({
  icon,
  titel,
  text,
  link,
  linkText,
  farbe,
}: {
  icon: React.ReactNode;
  titel: string;
  text: string;
  link: string;
  linkText: string;
  farbe: string;
}) {
  return (
    <div className="card-soft flex flex-col gap-3 p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${farbe}`}>{icon}</div>
      <h3 className="font-display font-bold text-ink-800">{titel}</h3>
      <p className="flex-1 text-sm text-ink-600">{text}</p>
      <Link href={link} className="text-sm font-bold text-candy-600 hover:text-candy-700">
        {linkText} →
      </Link>
    </div>
  );
}