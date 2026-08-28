"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { BLAETTER_NACH_ID, blattTitel } from "@/lib/blaetter";
import { getSession, listBenutzer } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { subscribeTausch, verbindeTausch } from "@/lib/tausch";
import { TauschDialog } from "./TauschDialog";

function formatBetrag(wert: number | null) {
  return wert === null ? null : wert.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function TauschboerseApp() {
  useStoreVersion();
  const [, setVersion] = useState(0);
  const ich = getSession();
  const [suche, setSuche] = useState("");
  const [groesse, setGroesse] = useState("");
  const [farbe, setFarbe] = useState("");
  const [dialog, setDialog] = useState<{ blattId: string; anbieter: { id: string; name: string } } | null>(null);

  useEffect(() => {
    const cleanup = verbindeTausch();
    const remove = subscribeTausch(() => setVersion((v) => v + 1));
    return () => {
      remove();
      cleanup();
    };
  }, []);

  const q = suche.trim().toLowerCase();
  const karten = listBenutzer()
    .flatMap((u) =>
      Object.keys(u.statuses)
        .filter((id) => u.statuses[id]?.includes("offer"))
        .map((id) => ({
          blattId: id,
          anbieterName: u.name,
          anbieterId: u.id,
          info: u.tausch?.[id],
        })),
    )
    .map((k) => ({ ...k, blatt: BLAETTER_NACH_ID.get(k.blattId) }))
    .filter(({ blatt, anbieterName }) => {
      if (!blatt) return false;
      if (groesse && blatt.groesse !== groesse) return false;
      if (farbe && blatt.farbe !== farbe) return false;
      if (!q) return true;
      const text = `${blattTitel(blatt)} ${blatt.name ?? ""} ${blatt.nummer} ${anbieterName}`.toLowerCase();
      return text.includes(q);
    })
    .sort((a, b) => a.anbieterName.localeCompare(b.anbieterName) || a.blattId.localeCompare(b.blattId));

  if (karten.length === 0) {
    return (
      <div className="space-y-4">
        <Filterleiste
          suche={suche}
          setSuche={setSuche}
          groesse={groesse}
          setGroesse={setGroesse}
          farbe={farbe}
          setFarbe={setFarbe}
        />
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
          <ArrowLeftRight className="h-8 w-8 text-candy-300" />
          <p className="font-display text-lg font-bold">
            {q || groesse || farbe ? "Nichts gefunden" : "Noch keine Tausch-Blätter"}
          </p>
          <p className="text-sm">
            Markiere Blätter in{" "}
            <Link href="/konto" className="font-bold text-candy-600 hover:underline">deiner Sammlung</Link>{" "}
            als „Zum Tauschen“ – dann sehen sie alle in der Börse.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Filterleiste
        suche={suche}
        setSuche={setSuche}
        groesse={groesse}
        setGroesse={setGroesse}
        farbe={farbe}
        setFarbe={setFarbe}
      />
      {!ich && (
        <p className="card-soft px-4 py-3 text-sm font-semibold text-ink-600">
          Zum Anbieten: <Link href="/konto" className="font-bold text-candy-600 hover:underline">Anmelden</Link>{" "}
          und Blätter in deiner Sammlung als Tausch markieren.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {karten.map(({ blattId, anbieterName, anbieterId, info, blatt }) => {
          const istMein = anbieterId === ich?.id;
          return (
            <div key={blattId} className="card-soft flex flex-col gap-2 p-3">
              <img
                src={blatt!.bild}
                alt={blattTitel(blatt!)}
                loading="lazy"
                className="aspect-square w-full rounded-2xl bg-white object-contain ring-1 ring-candy-100"
              />
              <p className="line-clamp-1 text-center text-xs font-bold text-ink-800" title={blattTitel(blatt!)}>
                {blattTitel(blatt!)}
              </p>
              <p className="text-center text-[10px] font-semibold text-ink-600">
                von{" "}
                <Link
                  href={`/sammler?name=${encodeURIComponent(anbieterName)}`}
                  className="hover:text-candy-600 hover:underline"
                >
                  {anbieterName}
                </Link>
              </p>
              {info?.betrag != null && (
                <p className="text-center text-[10px] font-bold text-candy-700">
                  Wunschbetrag: {formatBetrag(info.betrag)}
                </p>
              )}
              {info?.notiz && (
                <p className="line-clamp-2 text-center text-[10px] text-ink-600" title={info.notiz}>
                  „{info.notiz}“
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
                    onClick={() => setDialog({ blattId, anbieter: { id: anbieterId, name: anbieterName } })}
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
}: {
  suche: string;
  setSuche: (v: string) => void;
  groesse: string;
  setGroesse: (v: string) => void;
  farbe: string;
  setFarbe: (v: string) => void;
}) {
  return (
    <div className="card-soft flex flex-wrap items-center gap-3 p-4">
      <input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder="Nach Motiv oder Sammler suchen …"
        className="w-full flex-1 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
      />
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
