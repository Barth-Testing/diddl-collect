"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Heart, Users } from "lucide-react";
import { BLAETTER_NACH_ID, blattTitel } from "@/lib/blaetter";
import { getSession, listBenutzer, zaehle } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { subscribeTausch, verbindeTausch } from "@/lib/tausch";
import { aktuelleBlattId, type Blatt, type TauschInfo } from "@/lib/types";
import { TauschDialog } from "./TauschDialog";
import { cn } from "@/lib/utils";

function formatBetrag(wert: number | null) {
  return wert === null ? null : wert.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

type AnbieterEintrag = {
  id: string;
  name: string;
  info?: TauschInfo;
  own: number;
  offer: number;
};

type AngebotsGruppe = {
  blattId: string;
  blatt: Blatt;
  anbieter: AnbieterEintrag[];
};

function suchText(gruppe: AngebotsGruppe) {
  const { blatt, anbieter } = gruppe;
  return `${blattTitel(blatt)} ${blatt.name ?? ""} ${blatt.nummer} ${blatt.groesse} ${blatt.farbe} ${
    blatt.kollektion ?? ""
  } ${anbieter.map((a) => a.name).join(" ")} ${anbieter.map((a) => a.info?.notiz ?? "").join(" ")}`.toLowerCase();
}

export function TauschboerseApp() {
  useStoreVersion();
  const params = useSearchParams();
  const blattParam = params.get("blatt");
  const [, setVersion] = useState(0);
  const ich = getSession();
  const [suche, setSuche] = useState(() => {
    const b = blattParam ? BLAETTER_NACH_ID.get(blattParam) : undefined;
    return b ? blattTitel(b) : "";
  });
  const [nurBlatt, setNurBlatt] = useState<string | null>(blattParam);
  const [groesse, setGroesse] = useState("");
  const [farbe, setFarbe] = useState("");
  const [nurWunsch, setNurWunsch] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<{ blattId: string; anbieter: { id: string; name: string } } | null>(null);
  const [sichtbar, setSichtbar] = useState(120);

  const zuruecksetzen = () => setNurBlatt(null);

  useEffect(() => {
    const cleanup = verbindeTausch();
    const remove = subscribeTausch(() => setVersion((v) => v + 1));
    return () => {
      remove();
      cleanup();
    };
  }, []);

  const gruppen = useMemo(() => {
    const map = new Map<string, AngebotsGruppe>();
    for (const u of listBenutzer()) {
      const z = zaehle(u);
      for (const [id, statuse] of Object.entries(u.statuses)) {
        if (!statuse.includes("offer")) continue;
        const blattId = aktuelleBlattId(id);
        const blatt = BLAETTER_NACH_ID.get(blattId);
        if (!blatt) continue;
        const gruppe = map.get(blattId) ?? { blattId, blatt, anbieter: [] };
        if (gruppe.anbieter.every((a) => a.id !== u.id)) {
          gruppe.anbieter.push({ id: u.id, name: u.name, info: u.tausch?.[id], own: z.own, offer: z.offer });
        }
        map.set(blattId, gruppe);
      }
    }
    return [...map.values()].sort((a, b) => blattTitel(a.blatt).localeCompare(blattTitel(b.blatt), "de", { numeric: true }));
  }, []);

  const q = suche.trim().toLowerCase();
  const wunschIds = useMemo(
    () => new Set(ich ? Object.keys(ich.statuses).filter((id) => ich.statuses[id]?.includes("wish")) : []),
    [ich],
  );

  const gefiltert = useMemo(() => {
    return gruppen
      .map((g) => ({ ...g, text: suchText(g) }))
      .filter((g) => {
        if (nurBlatt && g.blatt.id !== nurBlatt) return false;
        if (groesse && g.blatt.groesse !== groesse) return false;
        if (farbe && g.blatt.farbe !== farbe) return false;
        if (nurWunsch && !wunschIds.has(g.blatt.id)) return false;
        if (q && !g.text.includes(q)) return false;
        return true;
      });
  }, [gruppen, nurBlatt, groesse, farbe, nurWunsch, wunschIds, q]);

  return (
    <div className="space-y-4">
      <Filterleiste
        suche={suche}
        setSuche={(v) => {
          setSuche(v);
          zuruecksetzen();
        }}
        groesse={groesse}
        setGroesse={(v) => {
          setGroesse(v);
          zuruecksetzen();
        }}
        farbe={farbe}
        setFarbe={(v) => {
          setFarbe(v);
          zuruecksetzen();
        }}
        nurWunsch={nurWunsch}
        setNurWunsch={(v) => {
          setNurWunsch(v);
          zuruecksetzen();
        }}
        wunschAnzahl={wunschIds.size}
      />
      {!ich && (
        <p className="card-soft px-4 py-3 text-sm font-semibold text-ink-600">
          Zum Anbieten: <Link href="/konto" className="font-bold text-candy-600 hover:underline">Anmelden</Link>{" "}
          und Blätter in deiner Sammlung als Tausch markieren.
        </p>
      )}
      {gefiltert.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
          <ArrowLeftRight className="h-8 w-8 text-candy-300" />
          <p className="font-display text-lg font-bold">
            {q || groesse || farbe
              ? "Nichts gefunden"
              : nurWunsch
                ? "Deine Wunschblätter sind nicht in der Börse"
                : "Noch keine Tausch-Blätter"}
          </p>
          <p className="text-sm">
            Markiere Blätter in{" "}
            <Link href="/konto" className="font-bold text-candy-600 hover:underline">deiner Sammlung</Link>{" "}
            {nurWunsch
              ? " als „Wunsch“ – die Börse zeigt dir dann, wer sie anbietet."
              : "als „Zum Tauschen“ – dann sehen sie alle in der Börse."}
          </p>
        </div>
      ) : (
        <>
        <p className="text-xs font-bold text-ink-600">
          {gefiltert.length} Blätter werden aktuell getauscht – je Karte kannst du den passenden Anbieter wählen.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {gefiltert.slice(0, sichtbar).map((gruppe) => {
            const auswahl = gewaehlt[gruppe.blattId] ?? gruppe.anbieter[0]?.id;
            const anbieter = gruppe.anbieter.find((a) => a.id === auswahl) ?? gruppe.anbieter[0];
            const istMein = anbieter?.id === ich?.id;
            return (
              <div key={gruppe.blattId} className="card-soft flex flex-col gap-2 p-3">
                <img
                  src={gruppe.blatt.bild}
                  alt={blattTitel(gruppe.blatt)}
                  loading="lazy"
                  className="aspect-square w-full rounded-2xl bg-white object-contain ring-1 ring-candy-100"
                />
                <p className="line-clamp-1 text-center text-xs font-bold text-ink-800" title={blattTitel(gruppe.blatt)}>
                  {blattTitel(gruppe.blatt)}
                </p>
                {gruppe.anbieter.length > 1 ? (
                  <label className="flex flex-col gap-0.5">
                    <span className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-600">
                      <Users className="h-3 w-3" /> {gruppe.anbieter.length} Anbieter
                    </span>
                    <select
                      value={auswahl}
                      onChange={(e) => setGewaehlt((vorher) => ({ ...vorher, [gruppe.blattId]: e.target.value }))}
                      className="rounded-full border border-cream-300 bg-white px-2 py-1 text-[10px] font-bold text-ink-800 outline-none focus:border-candy-400"
                    >
                      {gruppe.anbieter.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.own} eigenen, {a.offer} zu tauschen)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-center text-[10px] font-semibold text-ink-600">
                    von{" "}
                    <Link
                      href={`/sammler?id=${encodeURIComponent(anbieter?.id ?? "")}&name=${encodeURIComponent(anbieter?.name ?? "")}&ht=1`}
                      className="hover:text-candy-600 hover:underline"
                    >
                      {anbieter?.name}
                    </Link>{" "}
                    <span className="text-ink-400">({anbieter?.own} · {anbieter?.offer})</span>
                  </p>
                )}
                {anbieter?.info?.betrag != null && (
                  <p className="text-center text-[10px] font-bold text-candy-700">
                    Wunschbetrag: {formatBetrag(anbieter.info.betrag)}
                  </p>
                )}
                {anbieter?.info?.notiz && (
                  <p className="line-clamp-2 text-center text-[10px] text-ink-600" title={anbieter.info.notiz}>
                    „{anbieter.info.notiz}“
                  </p>
                )}
                <p className="mt-auto">
                  {istMein ? (
                    <Link
                      href="/konto"
                      className="block rounded-full bg-cream-100 py-1.5 text-center text-xs font-bold text-ink-600 hover:bg-cream-200"
                    >
                      Verwalten
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!anbieter) return;
                        setDialog({ blattId: gruppe.blattId, anbieter: { id: anbieter.id, name: anbieter.name } });
                      }}
                      className="w-full rounded-full bg-candy-500 py-1.5 text-xs font-bold text-white hover:bg-candy-600"
                    >
                      Angebot machen
                    </button>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        {gefiltert.length > sichtbar && (
          <button
            type="button"
            onClick={() => setSichtbar((s) => s + 120)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-candy-100 px-5 py-2.5 text-sm font-bold text-candy-700 transition hover:bg-candy-200"
          >
            Mehr Blätter anzeigen ({gefiltert.length - sichtbar} weitere)
          </button>
        )}
        </>
      )}

      {dialog && (
        <TauschDialog
          blattId={dialog.blattId}
          anbieter={dialog.anbieter}
          aufSchliessen={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function Filterleiste({
  suche,
  setSuche,
  groesse,
  setGroesse,
  farbe,
  setFarbe,
  nurWunsch,
  setNurWunsch,
  wunschAnzahl,
}: {
  suche: string;
  setSuche: (v: string) => void;
  groesse: string;
  setGroesse: (v: string) => void;
  farbe: string;
  setFarbe: (v: string) => void;
  nurWunsch: boolean;
  setNurWunsch: (v: boolean) => void;
  wunschAnzahl: number;
}) {
  return (
    <div className="card-soft flex flex-wrap items-center gap-3 p-4">
      <input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Nach Motiv oder Sammler suchen …"
        className="w-full flex-1 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
      />
      <button
        type="button"
        onClick={() => setNurWunsch(!nurWunsch)}
        aria-pressed={nurWunsch}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition-all",
          nurWunsch
            ? "bg-berry-400 text-white shadow-md shadow-berry-300/40"
            : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-berry-300",
        )}
        title={wunschAnzahl === 0 ? "Markiere zuerst Blätter in deiner Sammlung als Wunsch." : undefined}
      >
        <Heart className="h-4 w-4" />
        Meine Wunschblätter
        {wunschAnzahl > 0 && (
          <span className={cn("rounded-full px-1.5 text-xs", nurWunsch ? "bg-white/25" : "bg-berry-100 text-berry-500")}>
            {wunschAnzahl}
          </span>
        )}
      </button>
      <select
        value={groesse}
        onChange={(e) => setGroesse(e.target.value)}
        className="rounded-full border border-cream-300 bg-white px-3 py-2 text-sm font-bold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
      >
        <option value="">Alle Größen</option>
        <option value="Din A4">Din A4</option>
        <option value="Din A5">Din A5</option>
        <option value="Din A6">Din A6</option>
        <option value="Relief">Relief</option>
      </select>
      <select
        value={farbe}
        onChange={(e) => setFarbe(e.target.value)}
        className="rounded-full border border-cream-300 bg-white px-3 py-2 text-sm font-bold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
      >
        <option value="">Alle Farben</option>
        {["Weiß", "Cremig", "Gelb", "Orange", "Rosa", "Rot", "Lila", "Blau", "Türkis", "Grün", "Braun", "Grau", "Bunt"].map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </div>
  );
}
