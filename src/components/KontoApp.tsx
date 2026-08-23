"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDownUp, Check, Camera, Egg, Heart, Images, LogIn, PartyPopper, Repeat2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { BLAETTER_NACH_ID, nameOderNummer, sortiereSammlung, type SammlungSortierung } from "@/lib/blaetter";
import { getSession, login, logout, register, setBeweis, setFavorit, setStatus, zaehle } from "@/lib/store";
import type { Blatt } from "@/lib/types";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { BlattKarte } from "./BlattKarte";
import { Lupe } from "./Lupe";
import { Punkte } from "./Punkte";
import { SammlerKarussell } from "./SammlerKarussell";
import { SelectBasis } from "./SelectBasis";
import { cn } from "@/lib/utils";

type Tab = "sammlung" | "wunsch" | "tausch" | "beweise";

export function KontoApp() {
  useStoreVersion();
  const benutzer = getSession();
  const [tab, setTab] = useState<Tab>("sammlung");
  const [infos, setInfos] = useState<string | null>(null);
  const [fehler, setFehler] = useState<{ login?: string; register?: string }>({});
  const [lupe, setLupe] = useState<string | null>(null);
  const [nurUnbewiesen, setNurUnbewiesen] = useState(false);
  const [sortierung, setSortierung] = useState<SammlungSortierung>("id");
  const [bilderQuelle, setBilderQuelle] = useState<"vorlagen" | "beweise">("vorlagen");
  const [karussellAn, setKarussellAn] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingBeweis = useRef<string | null>(null);

  const z = useMemo(() => (benutzer ? zaehle(benutzer) : null), [benutzer]);

  const listeAb: Array<{ id: string; status: "own" | "wish" | "offer" }> = useMemo(() => {
    if (!benutzer) return [];
    const eintraege = Object.keys(benutzer.statuses)
      .filter((id) => {
        const s = benutzer.statuses[id];
        const gewuenscht = tab === "sammlung" ? s === "own" : tab === "wunsch" ? s === "wish" : s === "offer";
        if (!gewuenscht) return false;
        if (nurUnbewiesen && tab === "sammlung" && benutzer.beweise[id]) return false;
        return true;
      })
      .map((id) => ({ id, status: benutzer.statuses[id], blatt: BLAETTER_NACH_ID.get(id) }))
      .filter((e): e is { id: string; status: "own" | "wish" | "offer"; blatt: Blatt } => e.blatt !== undefined);
    const gefiltert =
      bilderQuelle === "beweise" && tab === "sammlung"
        ? eintraege.filter((e) => benutzer.beweise[e.id])
        : eintraege;
    return sortiereSammlung(gefiltert, sortierung).map(({ id, status }) => ({ id, status }));
  }, [benutzer, tab, nurUnbewiesen, sortierung, bilderQuelle]);

  function anmeldenOderRegistrieren(modus: "login" | "register", form: HTMLFormElement) {
    const name = form.querySelector<HTMLInputElement>("input[data-name]")?.value ?? "";
    const pw = form.querySelector<HTMLInputElement>("input[data-passwort]")?.value ?? "";
    setFehler({});
    void (async () => {
      const ergebnis = modus === "login" ? await login(name, pw) : await register(name, pw);
      if (!ergebnis.ok) {
        setFehler({ [modus]: ergebnis.fehler ?? "Das hat nicht geklappt." });
        return;
      }
      const nurLokal = "nurLokal" in ergebnis ? ergebnis.nurLokal : false;
      setInfos(
        modus === "login"
          ? `Willkommen zurück, ${name.trim()}!`
          : `Willkommen in der Sammelstube, ${name.trim()}!` +
              (nurLokal
                ? " Hinweis: Keine Verbindung zur Cloud – dein Konto ist vorerst nur auf diesem Gerät gespeichert."
                : ""),
      );
    })();
    /* Store event räumt auf */
  }

  function hochladenStarten(blattId: string) {
    pendingBeweis.current = blattId;
    fileRef.current?.click();
  }

  function dateiGewaehlt(datei: File | undefined) {
    const blattId = pendingBeweis.current;
    pendingBeweis.current = null;
    if (!datei || !blattId || !benutzer) return;
    if (!datei.type.startsWith("image/")) {
      setInfos("Bitte ein Bild (JPG/PNG) auswählen.");
      return;
    }
    const leser = new FileReader();
    leser.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 400;
        const skala = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * skala);
        canvas.height = Math.round(img.height * skala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setBeweis(blattId, canvas.toDataURL("image/jpeg", 0.7));
        setInfos("Beweis gespeichert – schön belegt!");
      };
      img.src = leser.result as string;
    };
    leser.readAsDataURL(datei);
  }

  if (!benutzer || !z) {
    return (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form
          className="card-soft p-6"
          onSubmit={(e) => {
            e.preventDefault();
            anmeldenOderRegistrieren("register", e.currentTarget);
          }}
        >
          <h2 className="font-display flex items-center gap-2 text-xl font-bold text-ink-800">
            <UserPlus className="h-5 w-5 text-candy-500" /> Neu hier? Sammlerkonto anlegen
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Nur Name und Passwort – dein Konto wird sicher gespeichert und ist auf jedem Gerät da.
          </p>
          <div className="mt-4 space-y-3">
            <Feld id="k-name-reg" label="Sammlername" placeholder="z. B. BlattLotte" autoComplete="username" />
            <Feld
              id="k-pw-reg"
              label="Passwort"
              type="password"
              placeholder="Mindestens 4 Zeichen"
              autoComplete="new-password"
            />
          </div>
          {fehler.register && <FehlerText>{fehler.register}</FehlerText>}
          <button className="mt-4 w-full rounded-full bg-candy-500 px-5 py-2.5 font-bold text-white shadow-md shadow-candy-300/50 hover:bg-candy-600">
            Konto anlegen
          </button>
        </form>

        <form
          className="card-soft p-6"
          onSubmit={(e) => {
            e.preventDefault();
            anmeldenOderRegistrieren("login", e.currentTarget);
          }}
        >
          <h2 className="font-display flex items-center gap-2 text-xl font-bold text-ink-800">
            <LogIn className="h-5 w-5 text-peach-500" /> Zurück im Knuddelkeller
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Schon registriert? Dann logge dich ein und weiter geht&apos;s mit Häkchen.
          </p>
          <div className="mt-4 space-y-3">
            <Feld id="k-name-login" label="Sammlername" placeholder="Dein Name" autoComplete="username" />
            <Feld id="k-pw-login" label="Passwort" type="password" placeholder="Dein Passwort" autoComplete="current-password" />
          </div>
          {fehler.login && <FehlerText>{fehler.login}</FehlerText>}
          <button className="mt-4 w-full rounded-full bg-peach-400 px-5 py-2.5 font-bold text-white shadow-md shadow-peach-300/50 hover:bg-peach-500">
            Anmelden
          </button>
        </form>
      </div>
    );
  }

  const lupeBlatt = lupe ? BLAETTER_NACH_ID.get(lupe) : undefined;
  const hatBeweise = Object.keys(benutzer.beweise).length > 0;

  return (
    <div className="mt-6 space-y-5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          dateiGewaehlt(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {infos && (
        <div className="animate-pop card-soft flex items-center gap-2 border-mint-200 bg-mint-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <PartyPopper className="h-4 w-4" /> {infos}
          <button onClick={() => setInfos(null)} className="ml-auto text-emerald-700" aria-label="Schließen">
            ×
          </button>
        </div>
      )}

      <div className="card-soft flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-candy-400 font-display text-2xl font-black text-white">
            {benutzer.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="font-display text-xl font-bold text-ink-800">{benutzer.name}</p>
            <p className="text-xs font-semibold text-ink-600">
              Sammler seit{" "}
              {new Date(benutzer.createdAt).toLocaleDateString("de-DE")}
            </p>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          <Punkte label="Deine Punkte" wert={z.own} farbe="text-candy-500" />
          <Punkte label="Wunschliste" wert={z.wish} farbe="text-berry-400" />
          <Punkte label="Zum Tauschen" wert={z.offer} farbe="text-peach-500" />
          <Punkte label="Bewiesen" wert={z.beweise} farbe="text-emerald-600" />
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            onClick={() => logout()}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-candy-100"
          >
            Abmelden
          </button>
          <p className="max-w-52 text-right text-xs font-semibold text-ink-600">
            Fortschritt: {z.own} von 855 ({Math.round((z.own / 855) * 100)} %)
          </p>
        </div>
      </div>

      {z.own > 100 && z.beweise < 100 && (
        <div className="animate-pop card-soft flex items-center gap-3 border-peach-300 bg-peach-50 px-4 py-3 text-sm font-semibold text-ink-800">
          <ShieldCheck className="h-5 w-5 shrink-0 text-peach-500" />
          <span>
            Du hast {z.own} Blätter angesetzt, aber nur {z.beweise} Foto-Beweise hochgeladen. Für
            Plätze über Rang 100 brauchst du mindestens 100 bewiesene Blätter.
          </span>
          <label className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-bold text-candy-600">
            <input
              type="checkbox"
              checked={nurUnbewiesen}
              onChange={(e) => setNurUnbewiesen(e.target.checked)}
              className="accent-candy-500"
            />
            Nur unbewiesene zeigen
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["sammlung", "Hab ich", z.own, Check],
            ["wunsch", "Wunschliste", z.wish, Heart],
            ["tausch", "Zum Tauschen", z.offer, Repeat2],
            ["beweise", "Beweise & Regeln", z.beweise, ShieldCheck],
          ] as const
        ).map(([key, label, anzahl, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all",
              tab === key ? "bg-candy-500 text-white shadow-md shadow-candy-300/50" : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className={cn("rounded-full px-1.5 text-xs", tab === key ? "bg-white/20" : "bg-candy-100 text-candy-700")}>
              {anzahl}
            </span>
          </button>
        ))}
      </div>

      {tab === "beweise" ? (
        <div className="space-y-4">
          <div className="card-soft p-5 text-sm text-ink-600">
            <h2 className="font-display mb-1 font-bold text-ink-800">So funktioniert die Beweis-Pflicht</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Jedes Blatt in deiner Sammlung gibt dir genau einen Punkt.</li>
              <li>Ranglisten-Plätze bis Rang 100 sind ohne Beweise möglich.</li>
              <li>Ab mehr als 100 eigenen Blättern zählst du für bessere Plätze nur noch mit, wenn mindestens 100 Blätter per Foto belegt sind.</li>
              <li>Ein Klick auf die Kamera lädt das Foto – es wird sicher auf deinem Konto gespeichert.</li>
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {Object.keys(benutzer.beweise).map((id) => {
              const b = BLAETTER_NACH_ID.get(id);
              if (!b) return null;
              return (
                <figure key={id} className="card-soft overflow-hidden p-2">
                  <img src={b.bild} alt={nameOderNummer(b)} className="aspect-square w-full rounded-xl object-contain" />
                  <figcaption className="mt-1 truncate text-center text-[10px] font-bold text-ink-700">
                    {nameOderNummer(b)}
                  </figcaption>
                </figure>
              );
            })}
            {Object.keys(benutzer.beweise).length === 0 && (
              <p className="text-sm font-semibold text-ink-600">Noch keine Beweise hochgeladen.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="card-soft flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-600">
                <ArrowDownUp className="h-3.5 w-3.5" /> Sortieren
              </span>
              <SelectBasis
                value={sortierung}
                onChange={(v) => setSortierung(v as SammlungSortierung)}
                optionen={[
                  ["id", "Nummer (A4–A6)"],
                  ["nummer", "Blattnummer"],
                  ["name", "Motiv (A–Z)"],
                  ["jahr-auf", "Jahr (alt → neu)"],
                  ["jahr-ab", "Jahr (neu → alt)"],
                  ["groesse", "Größe"],
                  ["farbe", "Farbe"],
                  ["zuletzt", "Zuletzt hinzugefügt"],
                ]}
              />
            </div>
            {tab === "sammlung" && (
              <>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-600">
                    <Camera className="h-3.5 w-3.5" /> Bilder
                  </span>
                  <div className="flex overflow-hidden rounded-full ring-1 ring-cream-300">
                    <button
                      type="button"
                      onClick={() => setBilderQuelle("vorlagen")}
                      aria-pressed={bilderQuelle === "vorlagen"}
                      className={cn(
                        "px-3 py-1.5 text-sm font-bold transition-colors",
                        bilderQuelle === "vorlagen"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white text-ink-600 hover:bg-mint-100",
                      )}
                    >
                      Vorlagen
                    </button>
                    <button
                      type="button"
                      onClick={() => setBilderQuelle("beweise")}
                      disabled={!hatBeweise}
                      title={hatBeweise ? undefined : "Erst Foto-Beweise hochladen"}
                      aria-pressed={bilderQuelle === "beweise"}
                      className={cn(
                        "px-3 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        bilderQuelle === "beweise"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white text-ink-600 hover:bg-mint-100",
                      )}
                    >
                      Beweisfotos
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setKarussellAn(!karussellAn)}
                  aria-pressed={karussellAn}
                  className={cn(
                    "ml-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all",
                    karussellAn
                      ? "bg-candy-500 text-white shadow-md shadow-candy-300/50"
                      : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
                  )}
                >
                  <Images className="h-4 w-4" /> Karussell
                </button>
              </>
            )}
          </div>
          {karussellAn && tab === "sammlung" && (
            <SammlerKarussell benutzer={benutzer} titel="Deine Lieblingsblätter" />
          )}
          {listeAb.length === 0 && (
            <div className="card-soft flex flex-col items-center gap-2 p-10 text-center text-ink-600">
              <Egg className="h-8 w-8 text-candy-300" />
              <p className="font-display text-lg font-bold">Hier ist es noch leer.</p>
              <p className="text-sm">
                Geh in den <a href="/katalog" className="font-bold text-candy-600 hover:underline">Katalog</a> und
                setze deine ersten Häkchen!
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {listeAb.map(({ id, status }) => {
              const b = BLAETTER_NACH_ID.get(id);
              if (!b) return null;
              return (
                <BlattKarte
                  key={id}
                  blatt={b}
                  status={status}
                  bewiesen={!!benutzer.beweise[id]}
                  favorit={!!benutzer.favoriten?.[id]}
                  aufToggle={(s) => {
                    setStatus(id, s);
                  }}
                  aufBild={() => setLupe(id)}
                  aufBeweis={() => hochladenStarten(id)}
                  aufFavorit={() => setFavorit(id, !benutzer.favoriten?.[id])}
                />
              );
            })}
          </div>
          {listeAb.length > 0 && (
            <button
              onClick={() => {
                const bewiesen = Object.keys(benutzer.beweise).length;
                const fehlend = z.own - bewiesen;
                if (!window.confirm(`Wirklich alle ${fehlend} Beweise dieses Kontos löschen?`)) return;
                for (const id of Object.keys(benutzer.beweise)) setBeweis(id, null);
              }}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-cream-300 hover:text-candy-700 hover:ring-candy-300"
            >
              <Trash2 className="h-4 w-4" /> Alle Beweise löschen
            </button>
          )}
        </>
      )}

      {lupeBlatt && (
        <Lupe
          blatt={lupeBlatt}
          status={benutzer.statuses[lupeBlatt.id] ?? null}
          aufSchliessen={() => setLupe(null)}
          aufToggle={(s) => {
            setStatus(lupeBlatt.id, s);
          }}
        />
      )}
    </div>
  );
}

function Feld({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-600">{label}</span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        data-name={id.includes("name") ? "" : undefined}
        data-passwort={id.includes("pw") ? "" : undefined}
        required
        className="mt-1 w-full rounded-2xl border border-cream-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
      />
    </label>
  );
}

function FehlerText({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{children}</p>;
}