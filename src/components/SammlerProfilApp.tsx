"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Gem, Heart, HeartHandshake, Mail, Repeat2, SearchX, Share2, Trophy } from "lucide-react";
import { aktualisiereSupporter, getSession, listBenutzer, zaehle } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { BlattLeiste } from "./BlattLeiste";
import { Punkte } from "./Punkte";
import { SammlerKarussell } from "./SammlerKarussell";
import { TauschDialog } from "./TauschDialog";
import { cn, kopiereText, sammlerLink } from "@/lib/utils";

export function SammlerProfilApp() {
  const version = useStoreVersion();
  const params = useSearchParams();
  const name = (params.get("name") ?? "").trim();
  const idParam = (params.get("id") ?? "").trim();
  const ich = getSession();
  const [tauschAngebot, setTauschAngebot] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [teilenFehler, setTeilenFehler] = useState(false);

  useEffect(() => {
    void aktualisiereSupporter();
  }, []);

  void version;
  const q = name.toLowerCase();
  /* Eindeutige ID hat Vorrang (robust gegen Namens-Kollisionen wie "alina."
     vs. "Alina" – getrennte Konten werden nie verwechselt, egal was mit dem
     Namen beim Teilen passiert). Der Name bleibt als Fallback für ältere
     Links (?name=...) und nicht-ID-basierte Einstiege.
     Ein abschließender Punkt wird beim Abgleich ignoriert: Er kann beim Teilen
     verloren gehen, und neue Konten dürfen ohnehin nicht mehr mit einem Punkt
     enden – dadurch ist die Zuordnung eindeutig. */
  const kandidaten = name || idParam ? listBenutzer() : [];
  const benutzer = idParam
    ? (kandidaten.find((u) => u.id === idParam) ?? null)
    : name
      ? (kandidaten.find((u) => u.name.toLowerCase() === q) ??
        kandidaten.find((u) => u.name.toLowerCase().replace(/\.+$/, "") === q.replace(/\.+$/, "")) ??
        null)
      : null;

  if ((!name && !idParam) || !benutzer) {
    return (
      <div className="mt-6 space-y-4">
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
          <SearchX className="h-8 w-8 text-candy-300" />
          <p className="font-display text-lg font-bold">
            {name
              ? `Kein Profil für „${name}“ gefunden.`
              : "Kein Sammler ausgewählt."}
          </p>
          <p className="text-sm">
            Vielleicht lädt die Seite noch – oder du schaust direkt in der{" "}
            <Link href="/rangliste" className="font-bold text-candy-600 hover:underline">
              Rangliste
            </Link>{" "}
            vorbei.
          </p>
        </div>
      </div>
    );
  }

  const z = zaehle(benutzer);

  async function teileProfil(kontenId: string, benutzerName: string) {
    const url = sammlerLink(kontenId, benutzerName);
    const titel = `Diddl-Collect: ${benutzerName}s Sammelgalerie`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titel, url });
      } catch {
        /* Nutzer hat abgebrochen – kein Feedback nötig */
      }
      return;
    }
    if (await kopiereText(url)) {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    } else {
      setTeilenFehler(true);
      setTimeout(() => setTeilenFehler(false), 2500);
    }
  }

  const wunschIds = ich
    ? new Set(Object.keys(ich.statuses).filter((id) => ich.statuses[id]?.includes("wish")))
    : new Set<string>();
  const treffer = Object.keys(benutzer.statuses)
    .filter((id) => benutzer.statuses[id]?.includes("offer") && wunschIds.has(id))
    .sort((a, b) => a.localeCompare(b));
  const wunschliste = Object.keys(benutzer.statuses)
    .filter((id) => benutzer.statuses[id]?.includes("wish"))
    .sort((a, b) => a.localeCompare(b));
  /* Umgekehrt: Blätter, die ER sich wünscht und die ICH zum Tausch markiert habe. */
  const umgekehrt = ich && ich.id !== benutzer.id
    ? Object.keys(benutzer.statuses)
        .filter((id) => benutzer.statuses[id]?.includes("wish") && ich.statuses[id]?.includes("offer"))
        .sort((a, b) => a.localeCompare(b))
    : [];

  return (
    <div className="mt-6 space-y-5">
      <div className="card-soft flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-berry-400 font-display text-2xl font-black text-white">
            {benutzer.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-ink-800">
              {benutzer.name}
              {benutzer.supporter && (
                <span
                  className="chip bg-yellow-400 px-2 py-0.5 text-xs text-white shadow-sm"
                  title="Unterstützer: hält die Seite mit einer Spende am Laufen"
                >
                  <Gem className="h-3.5 w-3.5" /> Supporter
                </span>
              )}
            </p>
            <p className="text-xs font-semibold text-ink-600">
              Sammler seit {new Date(benutzer.createdAt).toLocaleDateString("de-DE")}
            </p>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <Punkte label="Eigene Blätter" wert={z.own} farbe="text-candy-500" />
          <Punkte label="Wunschliste" wert={z.wish} farbe="text-berry-400" />
          <Punkte label="Zum Tauschen" wert={z.offer} farbe="text-peach-500" />
          <Punkte label="Bewiesen" wert={z.beweise} farbe="text-emerald-600" />
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-start sm:self-auto">
          {ich?.id === benutzer.id && (
            <Link
              href="/konto"
              className="rounded-full bg-candy-500 px-4 py-2 text-center text-sm font-bold text-white hover:bg-candy-600"
            >
              Zur eigenen Sammlung
            </Link>
          )}
          <button
            type="button"
            onClick={() => void teileProfil(benutzer.id, benutzer.name)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all",
              kopiert && !teilenFehler
                ? "bg-emerald-600 text-white shadow-sm"
                : teilenFehler
                  ? "font-semibold text-red-600 ring-1 ring-red-200"
                  : "bg-white text-ink-700 ring-1 ring-cream-300 hover:bg-candy-100 hover:ring-candy-300",
            )}
          >
            <Share2 className="h-4 w-4" />
            {kopiert && !teilenFehler
              ? "Link kopiert!"
              : teilenFehler
                ? "Teilen fehlgeschlagen"
                : "Galerie teilen"}
          </button>
        </div>
      </div>

      {ich && ich.id !== benutzer.id && treffer.length > 0 && (
        <div className="card-soft border-mint-200 bg-mint-50 p-5">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
            <Mail className="h-5 w-5 text-emerald-500" />
            {treffer.length} {treffer.length === 1 ? "Treffer" : "Treffer"} auf deiner Wunschliste
          </h3>
          <p className="mt-1 text-xs font-semibold text-ink-600">
            Diese angebotenen Blätter von {benutzer.name} fehlen dir noch – perfekt für einen gemeinsamen
            Brief mit mehreren Blättern, das spart Porto.
          </p>
          <BlattLeiste ids={treffer} knopfStil="gruen" aufBlatt={(id) => setTauschAngebot(id)} />
        </div>
      )}

      {ich && ich.id !== benutzer.id && umgekehrt.length > 0 && (
        <div className="card-soft border-berry-200 bg-berry-50 p-5">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
            <HeartHandshake className="h-5 w-5 text-berry-400" />
            {umgekehrt.length} {umgekehrt.length === 1 ? "Blatt hast" : "Blätter hast"} du, das sich{" "}
            {benutzer.name} wünscht
          </h3>
          <p className="mt-1 text-xs font-semibold text-ink-600">
            Diese Blätter hast du zum Tauschen markiert und {benutzer.name} steht auf seiner Wunschliste –
            der perfekte Anlass für ein Angebot:{" "}
            <Link href="/tausch" className="font-bold text-candy-600 hover:underline">
              zur Tauschbörse
            </Link>
            .
          </p>
          <BlattLeiste ids={umgekehrt} />
        </div>
      )}

      <SammlerKarussell benutzer={benutzer} titel={`${benutzer.name}s Lieblingsblätter`} />

      {wunschliste.length > 0 && (
        <div className="card-soft p-5">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
            <Heart className="h-5 w-5 text-berry-400" />
            Wunschliste
            <span className="chip bg-berry-100 px-1.5 py-0.5 text-xs text-berry-400">{z.wish}</span>
          </h3>
          <p className="mt-1 text-xs font-semibold text-ink-600">
            {ich?.id === benutzer.id
              ? "Deine Wunschblätter – such sie in der Börse als angeboten."
              : "Das sucht dieser Sammler – vielleicht kannst du helfen."}
          </p>
          <BlattLeiste ids={wunschliste} />
        </div>
      )}

      {Object.keys(benutzer.statuses).some((id) => benutzer.statuses[id]?.includes("offer")) && (
        <div className="card-soft p-5">
          <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
            <Repeat2 className="h-5 w-5 text-peach-400" />
            Zum Tauschen angeboten
            <span className="chip bg-peach-100 px-1.5 py-0.5 text-xs text-peach-500">
              {z.offer}
            </span>
          </h3>
          <p className="mt-1 text-xs font-semibold text-ink-600">
            {ich?.id === benutzer.id
              ? "Diese Blätter hast du zum Tausch markiert. Wunschbetrag und Notiz hinterlegst du im Konto."
              : "Mach ein Angebot: eigene Blätter wählen oder einen Geldbetrag vorschlagen."}
          </p>
          <BlattLeiste
            ids={Object.keys(benutzer.statuses)
              .filter((id) => benutzer.statuses[id]?.includes("offer"))
              .sort((a, b) => a.localeCompare(b))}
            knopfStil={ich?.id !== benutzer.id ? "rosa" : undefined}
            aufBlatt={ich?.id !== benutzer.id ? (id) => setTauschAngebot(id) : undefined}
            zusatz={(id) => {
              const info = benutzer.tausch?.[id];
              if (!info || (info.betrag == null && !info.notiz)) return null;
              return [
                info.betrag != null
                  ? `€ ${info.betrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`
                  : null,
                info.notiz ?? null,
              ]
                .filter(Boolean)
                .join(" · ");
            }}
          />
        </div>
      )}

      {tauschAngebot && (
        <TauschDialog
          blattId={tauschAngebot}
          anbieter={{ id: benutzer.id, name: benutzer.name }}
          aufSchliessen={() => setTauschAngebot(null)}
        />
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-ink-600">
        <Trophy className="h-3.5 w-3.5 text-candy-500" />
        Alle Sammler findest du in der{" "}
        <Link href="/rangliste" className="text-candy-600 hover:underline">
          Rangliste
        </Link>
        .
      </p>
    </div>
  );
}


