"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, AtSign, Check, Camera, Egg, Heart, Images, KeyRound, LogIn, PartyPopper, Repeat2, Share2, ShieldCheck, Trash2, UserPlus, UserRound } from "lucide-react";
import { BLAETTER, BLAETTER_NACH_ID, blattTitel, sortiereSammlung, type SammlungSortierung } from "@/lib/blaetter";
import { aenderePasswort, entferneEmail, getSession, holSessionToken, leseEigeneEmail, login, logout, register, setBeweis, setFavorit, setStatus, setzeEmail, setzeTauschInfo, speichereBeweisFoto, zaehle } from "@/lib/store";
import type { Benutzer, Blatt, Status, TauschInfo } from "@/lib/types";
import { useStoreVersion } from "@/lib/useStoreVersion";
import { BlattKarte } from "./BlattKarte";
import { Lupe } from "./Lupe";
import { Punkte } from "./Punkte";
import { SammlerKarussell } from "./SammlerKarussell";
import { SelectBasis } from "./SelectBasis";
import { cn, kopiereText, sammlerLink } from "@/lib/utils";

type Tab = "sammlung" | "wunsch" | "tausch" | "beweise" | "konto";

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
  const [sichtbar, setSichtbar] = useState(150);
  const [kopiert, setKopiert] = useState(false);
  const [teilenFehler, setTeilenFehler] = useState(false);
  const [mailVollstaendig, setMailVollstaendig] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingBeweis = useRef<string | null>(null);

  useEffect(() => {
    if (!benutzer) return;
    let aktiv = true;
    void leseEigeneEmail().then((m) => {
      if (aktiv) setMailVollstaendig(m !== null);
    });
    return () => {
      aktiv = false;
    };
  }, [benutzer?.id ?? null]);

  async function teileGalerie() {
    const name = benutzer!.name;
    const url = sammlerLink(benutzer!.id, name);
    const titel = `Diddl-Collect: ${name}s Sammelgalerie`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titel, url });
      } catch {
        /* Nutzer hat abgebrochen */
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

  const z = useMemo(() => (benutzer ? zaehle(benutzer) : null), [benutzer]);

  const listeAb: Array<{ id: string; status: Status[] }> = useMemo(() => {
    if (!benutzer) return [];
    const eintraege = Object.keys(benutzer.statuses)
      .filter((id) => {
        const s = benutzer.statuses[id] ?? [];
        const gewuenscht = tab === "sammlung" ? s.includes("own") : tab === "wunsch" ? s.includes("wish") : s.includes("offer");
        if (!gewuenscht) return false;
        if (nurUnbewiesen && tab === "sammlung" && benutzer.beweise[id]) return false;
        return true;
      })
      .map((id) => ({ id, status: benutzer.statuses[id], blatt: BLAETTER_NACH_ID.get(id) }))
      .filter((e): e is { id: string; status: Status[]; blatt: Blatt } => e.blatt !== undefined);
    const gefiltert =
      bilderQuelle === "beweise" && tab === "sammlung"
        ? eintraege.filter((e) => benutzer.beweise[e.id])
        : eintraege;
    return sortiereSammlung(gefiltert, sortierung).map(({ id, status }) => ({ id, status }));
  }, [benutzer, tab, nurUnbewiesen, sortierung, bilderQuelle]);

  function anmeldenOderRegistrieren(modus: "login" | "register", form: HTMLFormElement) {
    const name = form.querySelector<HTMLInputElement>("input[data-name]")?.value ?? "";
    const pw = form.querySelector<HTMLInputElement>("input[data-passwort]")?.value ?? "";
    const mail = form.querySelector<HTMLInputElement>("input[data-email]")?.value ?? "";
    setFehler({});
    void (async () => {
      const ergebnis =
        modus === "login" ? await login(name, pw) : await register(name, pw, mail || undefined);
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

  function togglen(blattId: string, s: "own" | "wish" | "offer") {
    const aktiv = !(benutzer!.statuses[blattId] ?? []).includes(s);
    setStatus(blattId, s, aktiv);
    if (s === "offer" && !aktiv) setzeTauschInfo(blattId, null);
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
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const max = 320;
        const skala = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * skala);
        canvas.height = Math.round(img.height * skala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        await speichereBeweisFoto(blattId, canvas.toDataURL("image/jpeg", 0.6));
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
              id="k-mail-reg"
              label="E-Mail (optional)"
              type="email"
              placeholder="Für Notfälle – nur du selbst siehst sie"
              autoComplete="email"
              dataEmail
            />
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
            type="button"
            onClick={() => void teileGalerie()}
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
          <button
            onClick={() => logout()}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-candy-100"
          >
            Abmelden
          </button>
          <p className="max-w-52 text-right text-xs font-semibold text-ink-600">
            Fortschritt: {z.own} von {BLAETTER.length} ({Math.round((z.own / BLAETTER.length) * 100)} %)
          </p>
          {!holSessionToken() && benutzer && (
            <p className="max-w-52 text-right text-xs font-bold text-peach-500">
              Nur lokal gespeichert – bitte einmal neu anmelden, damit alles in der Cloud gesichert wird.
            </p>
          )}
        </div>
      </div>

      {mailVollstaendig === false && (
        <div className="animate-pop card-soft flex items-center gap-3 border-berry-200 bg-berry-50 px-4 py-3 text-sm font-semibold text-ink-800">
          <AtSign className="h-5 w-5 shrink-0 text-berry-400" />
          <span>
            Hinterlege noch eine E-Mail-Adresse – nur du selbst und der Seitenbetreiber können
            sie sehen. Sie dient als Notfall-Erreichbarkeit, falls du dein Passwort vergisst.
          </span>
          <button
            onClick={() => setTab("konto")}
            className="ml-auto shrink-0 rounded-full bg-berry-400 px-4 py-1.5 text-xs font-bold text-white hover:bg-berry-500"
          >
            E-Mail hinterlegen
          </button>
        </div>
      )}

      {z.own > 100 && z.beweise < 100 && (
        <div className="animate-pop card-soft flex items-center gap-3 border-peach-300 bg-peach-50 px-4 py-3 text-sm font-semibold text-ink-800">
          <ShieldCheck className="h-5 w-5 shrink-0 text-peach-500" />
          <span>
            Du hast {z.own} Blätter angesetzt, aber nur {z.beweise} Foto-Beweise hochgeladen.
            Aktuell wirst du mit 100 Punkten gewertet – ab 100 Beweisen zählen alle deine Blätter
            für die Rangliste.
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
            ["konto", "Konto", null, UserRound],
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
                  <img src={b.bild} alt={blattTitel(b)} className="aspect-square w-full rounded-xl object-contain" />
                  <figcaption className="mt-1 truncate text-center text-[10px] font-bold text-ink-700">
                    {blattTitel(b)}
                  </figcaption>
                </figure>
              );
            })}
            {Object.keys(benutzer.beweise).length === 0 && (
              <p className="text-sm font-semibold text-ink-600">Noch keine Beweise hochgeladen.</p>
            )}
          </div>
        </div>
      ) : tab === "konto" ? (
        <KontoEinrichten benutzer={benutzer} />
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
                  ["name", "Jahr–Größe–Nr."],
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
            {listeAb.slice(0, sichtbar).map(({ id, status }) => {
              const b = BLAETTER_NACH_ID.get(id);
              if (!b) return null;
              const props = {
                blatt: b,
                status,
                bewiesen: !!benutzer.beweise[id],
                favorit: !!benutzer.favoriten?.[id],
                aufToggle: (s: "own" | "wish" | "offer") => togglen(id, s),
                aufBild: () => setLupe(id),
                aufBeweis: () => hochladenStarten(id),
                aufFavorit: () => setFavorit(id, !benutzer.favoriten?.[id]),
              };
              if (tab === "tausch") {
                return (
                  <div key={id} className="space-y-2">
                    <BlattKarte {...props} />
                    <TauschInfoEditor
                      blattId={id}
                      key={`${id}-${benutzer.tausch?.[id]?.betrag ?? ""}-${benutzer.tausch?.[id]?.notiz ?? ""}`}
                    />
                  </div>
                );
              }
              return <BlattKarte key={id} {...props} />;
            })}
          </div>
          {listeAb.length > sichtbar && (
            <button
              type="button"
              onClick={() => setSichtbar((s) => s + 150)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-candy-100 px-5 py-2.5 text-sm font-bold text-candy-700 transition hover:bg-candy-200"
            >
              Mehr Blätter anzeigen ({listeAb.length - sichtbar} weitere)
            </button>
          )}
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
          status={benutzer.statuses[lupeBlatt.id] ?? []}
          aufSchliessen={() => setLupe(null)}
          aufToggle={(s) => togglen(lupeBlatt.id, s)}
        />
      )}
    </div>
  );
}

function TauschInfoEditor({ blattId, info }: { blattId: string; info?: TauschInfo }) {
  const [betrag, setBetrag] = useState(info?.betrag != null ? String(info.betrag) : "");
  const [notiz, setNotiz] = useState(info?.notiz ?? "");
  const [offen, setOffen] = useState(!!(info?.betrag || info?.notiz));
  const wert = betrag.trim() === "" ? null : Number(betrag.replace(",", "."));
  const passend = (wert === null || (!Number.isNaN(wert) && wert > 0)) && notiz.length <= 200;
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-candy-100">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-600">
        <Repeat2 className="h-3 w-3 text-peach-400" /> Tausch-Info
        <button
          type="button"
          onClick={() => setOffen(!offen)}
          aria-pressed={offen}
          aria-label={offen ? "Tausch-Info schließen" : "Tausch-Info öffnen"}
          className="ml-auto text-xs font-bold text-candy-600"
        >
          {offen ? "Weniger" : "Mehr"}
        </button>
      </p>
      {offen && (
        <div className="space-y-1.5">
          <input
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
            type="number"
            min="0"
            step="0.5"
            placeholder="Wunschbetrag € (optional)"
            className="w-full rounded-full border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:border-candy-400"
          />
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value.slice(0, 200))}
            placeholder="Notiz / Wunsch (optional)"
            className="w-full rounded-full border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:border-candy-400"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={!passend}
              onClick={() => setzeTauschInfo(blattId, { betrag: wert ?? undefined, notiz: notiz.trim() || undefined })}
              className="rounded-full bg-mint-200 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-mint-300 disabled:opacity-40"
            >
              Speichern
            </button>
            {(info?.betrag !== undefined || info?.notiz) && (
              <button
                type="button"
                onClick={() => setzeTauschInfo(blattId, null)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-cream-100"
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KontoEinrichten({ benutzer }: { benutzer: Benutzer }) {
  const [mail, setMail] = useState("");
  const [mailAktuell, setMailAktuell] = useState<string | null>(null);
  const [mailInfo, setMailInfo] = useState<string | null>(null);
  const [mailFehler, setMailFehler] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const [neu2, setNeu2] = useState("");
  const [pwInfo, setPwInfo] = useState<string | null>(null);
  const [pwFehler, setPwFehler] = useState<string | null>(null);
  const [keinServer, setKeinServer] = useState(false);

  useEffect(() => {
    let aktiv = true;
    void leseEigeneEmail().then((m) => {
      if (aktiv) setMailAktuell(m);
    });
    return () => {
      aktiv = false;
    };
  }, [mailInfo]);

  function maskiere(m: string) {
    const [local, domain] = m.split("@");
    if (!domain) return m;
    const zeichen = local.slice(0, 2);
    return `${zeichen}•••@${domain}`;
  }

  async function speichereMail() {
    setMailInfo(null);
    setMailFehler(null);
    const ergebnis = await setzeEmail(mail);
    if (ergebnis.ok) {
      setMail("");
      setMailInfo("E-Mail gespeichert – nur du und der Seitenbetreiber sehen sie.");
      setMailAktuell(mail.trim());
    } else {
      setMailFehler(ergebnis.fehler ?? "Das hat nicht geklappt.");
    }
  }

  async function entferne() {
    setMailInfo(null);
    setMailFehler(null);
    const ok = await entferneEmail();
    if (ok) {
      setMailAktuell(null);
      setMailInfo("E-Mail entfernt.");
    } else {
      setMailFehler("Das hat nicht geklappt – bitte neu anmelden und erneut versuchen.");
      setKeinServer(true);
    }
  }

  async function aenderePw() {
    setPwInfo(null);
    setPwFehler(null);
    if (neu.length < 4) {
      setPwFehler("Das neue Passwort braucht mindestens 4 Zeichen.");
      return;
    }
    if (neu !== neu2) {
      setPwFehler("Die Wiederholung passt nicht zum neuen Passwort.");
      return;
    }
    const ergebnis = await aenderePasswort(benutzer.name, alt, neu);
    if (ergebnis.ok) {
      setAlt("");
      setNeu("");
      setNeu2("");
      setPwInfo("Passwort geändert – andere Geräte wurden abgemeldet.");
    } else {
      setPwFehler(ergebnis.fehler ?? "Das hat nicht geklappt.");
    }
  }

  return (
    <div className="space-y-4">
      {keinServer && (
        <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Keine Verbindung zur Cloud – Änderungen werden nicht gespeichert.
        </p>
      )}
      <div className="card-soft p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
          <UserRound className="h-5 w-5 text-candy-500" /> Dein Konto
        </h2>
        <p className="mt-1 text-sm font-semibold text-ink-600">
          Angemeldet als <span className="font-bold text-candy-600">{benutzer.name}</span> – seit{" "}
          {new Date(benutzer.createdAt).toLocaleDateString("de-DE")}. Alles hier ist nur für dich
          sichtbar.
        </p>
      </div>

      <div className="card-soft p-5">
        <h3 className="font-display flex items-center gap-2 font-bold text-ink-800">
          <AtSign className="h-4 w-4 text-berry-400" /> E-Mail-Adresse
        </h3>
        <p className="mt-1 text-xs font-semibold text-ink-600">
          Optional: Sie bleibt privat (nur du + der Seitenbetreiber) und dient als
          Notfall-Erreichbarkeit, z. B. wenn du dein Passwort vergisst.
        </p>
        {mailAktuell !== null && (
          <p className="mt-2 rounded-2xl bg-mint-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-mint-200">
            Hinterlegt: {maskiere(mailAktuell)}
            <button
              onClick={() => void entferne()}
              className="ml-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-600 ring-1 ring-cream-300 hover:bg-cream-100"
            >
              Entfernen
            </button>
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            type="email"
            placeholder="z. B. name@beispiel.de"
            className="flex-1 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
          />
          <button
            disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim())}
            onClick={() => void speichereMail()}
            className="rounded-full bg-candy-500 px-5 py-2 text-sm font-bold text-white hover:bg-candy-600 disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
        {mailInfo && <p className="mt-2 text-xs font-bold text-emerald-700">{mailInfo}</p>}
        {mailFehler && <p className="mt-2 text-xs font-bold text-red-700">{mailFehler}</p>}
      </div>

      <div className="card-soft p-5">
        <h3 className="font-display flex items-center gap-2 font-bold text-ink-800">
          <KeyRound className="h-4 w-4 text-peach-400" /> Passwort ändern
        </h3>
        <p className="mt-1 text-xs font-semibold text-ink-600">
          Das alte Passwort wird geprüft; danach werden alle anderen Geräte abgemeldet.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-600">Benutzername</span>
            <input
              value={benutzer.name}
              readOnly
              className="mt-1 w-full rounded-2xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm font-bold text-ink-800"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-600">Altes Passwort</span>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-2xl border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-600">Neues Passwort</span>
            <input
              value={neu}
              onChange={(e) => setNeu(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="Min. 4 Zeichen"
              className="mt-1 w-full rounded-2xl border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-600">Neues Passwort wiederholen</span>
            <input
              value={neu2}
              onChange={(e) => setNeu2(e.target.value)}
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-2xl border border-cream-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
            />
          </label>
        </div>
        <button
          onClick={() => void aenderePw()}
          disabled={!alt || !neu || !neu2}
          className="mt-3 rounded-full bg-peach-400 px-5 py-2 text-sm font-bold text-white hover:bg-peach-500 disabled:opacity-40"
        >
          Passwort ändern
        </button>
        {pwInfo && <p className="mt-2 text-xs font-bold text-emerald-700">{pwInfo}</p>}
        {pwFehler && <p className="mt-2 text-xs font-bold text-red-700">{pwFehler}</p>}
      </div>
    </div>
  );
}

function Feld({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  dataEmail,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  dataEmail?: boolean;
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
        data-email={dataEmail ? "" : undefined}
        required
        className="mt-1 w-full rounded-2xl border border-cream-300 bg-white px-3 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
      />
    </label>
  );
}

function FehlerText({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{children}</p>;
}