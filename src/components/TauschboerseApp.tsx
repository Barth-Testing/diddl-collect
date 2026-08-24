"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Lock } from "lucide-react";
import { BLAETTER_NACH_ID, nameOderNummer } from "@/lib/blaetter";
import { getSession } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { alleAngebote, subscribeTausch, tauschBereit, tauschFehlt, tauschKonfiguriert, verbindeTausch } from "@/lib/tausch";
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
  const angebote = alleAngebote()
    .filter((a) => a.status === "offen")
    .map((a) => ({ a, blatt: BLAETTER_NACH_ID.get(a.blattId) }))
    .filter(({ a, blatt }) => {
      if (!blatt) return false;
      if (groesse && blatt.groesse !== groesse) return false;
      if (farbe && blatt.farbe !== farbe) return false;
      if (!q) return true;
      const text = `${blatt.name ?? ""} ${blatt.nummer} ${a.anbieterName} ${a.nachricht ?? ""} ${a.angebotBlaetter.map((id) => BLAETTER_NACH_ID.get(id)?.name ?? "").join(" ")}`.toLowerCase();
      return text.includes(q);
    });

  if (!ich) {
    return (
      <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
        <Lock className="h-8 w-8 text-candy-300" />
        <p className="font-display text-lg font-bold">Nur für angemeldete Sammler</p>
        <p className="text-sm">
          Melde dich über <Link href="/konto" className="font-bold text-candy-600 hover:underline">dein Konto</Link>{" "}
          an, um in der Tauschbörse echte Angebote machen zu können.
        </p>
      </div>
    );
  }
  if (!tauschKonfiguriert()) {
    return <p className="card-soft p-5 text-sm font-semibold text-ink-600">Die Tauschbörse ist noch nicht eingerichtet.</p>;
  }
  if (tauschFehlt()) {
    return (
      <p className="card-soft p-5 text-sm font-semibold text-ink-600">
        Die Tauschbörse startet in Kürze – sobald die neue Datenbank-Struktur angelegt ist.
      </p>
    );
  }
  if (!tauschBereit()) {
    return (
      <p className="card-soft p-5 text-sm font-semibold text-ink-600">
        Die Tauschbörse wird gerade geladen – einen Moment bitte.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-soft flex flex-wrap items-center gap-3 p-4">
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suche nach Motiv, Sammler, Nachricht …"
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

      {angebote.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
          <ArrowLeftRight className="h-8 w-8 text-candy-300" />
          <p className="font-display text-lg font-bold">Keine offenen Angebote</p>
          <p className="text-sm">
            Schau auf einem <Link href="/rangliste" className="font-bold text-candy-600 hover:underline">Sammler-Profil</Link>{" "}
            vorbei – dort sind zum Tauschen markierte Blätter zu sehen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {angebote.map(({ a, blatt }) => {
            const istMein = a.anbieterId === ich.id;
            return (
              <div key={a.id} className="card-soft flex flex-col gap-2 p-3">
                <img
                  src={blatt!.bild}
                  alt={nameOderNummer(blatt!)}
                  loading="lazy"
                  className="aspect-square w-full rounded-2xl bg-white object-contain ring-1 ring-candy-100"
                />
                <p className="line-clamp-1 text-center text-xs font-bold text-ink-800" title={nameOderNummer(blatt!)}>
                  {nameOderNummer(blatt!)}
                </p>
                <p className="text-center text-[10px] font-semibold text-ink-600">
                  von <Link href={`/sammler?name=${encodeURIComponent(a.anbieterName)}`} className="hover:text-candy-600 hover:underline">{a.anbieterName}</Link>
                </p>
                {a.angebotBetrag !== null && (
                  <p className="text-center text-[10px] font-bold text-candy-700">
                    Wunschbetrag: {formatBetrag(a.angebotBetrag)}
                  </p>
                )}
                {a.angebotBlaetter.length > 0 && (
                  <p className="text-center text-[10px] font-semibold text-ink-600">
                    Interessiert an {a.angebotBlaetter.length} {a.angebotBlaetter.length === 1 ? "Blatt" : "Blättern"}
                  </p>
                )}
                {a.nachricht && (
                  <p className="line-clamp-2 text-center text-[10px] text-ink-600" title={a.nachricht}>
                    „{a.nachricht}“
                  </p>
                )}
                {istMein ? (
                  <p className="mt-auto rounded-full bg-cream-100 py-1.5 text-center text-xs font-bold text-ink-600">
                    Dein Angebot
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDialog({ blattId: a.blattId, anbieter: { id: a.anbieterId, name: a.anbieterName } })}
                    className="mt-auto rounded-full bg-candy-500 py-1.5 text-xs font-bold text-white hover:bg-candy-600"
                  >
                    Angebot machen
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
