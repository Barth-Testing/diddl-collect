"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BadgeCheck, Megaphone, Plus, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { ladeRanglisteRpc, listBenutzer, zaehle } from "@/lib/store";
import { NEWS_BUCKET, bildUrl, istDatenUrl, istHttpUrl, versucheNewsMigration } from "@/lib/bilder";
import { useStoreVersion } from "@/lib/useStoreVersion";

type NewsReihe = {
  id: number;
  titel: string;
  text: string;
  erstellt_am: string;
  bild?: string | null;
  bild2?: string | null;
  link?: string | null;
};

type ProfilReihe = {
  id: string;
  name: string;
  created_at: string;
  statuses: Record<string, string> | null;
  beweise: Record<string, string | boolean> | null;
};

type Db = {
  public: {
    Tables: {
      news: {
        Row: NewsReihe;
        Insert: { titel: string; text: string };
        Update: never;
        Relationships: [];
      };
      profile: {
        Row: ProfilReihe;
        Insert: {
          id: string;
          name: string;
          passwort: string;
          statuses: Record<string, string>;
          beweise: Record<string, string | boolean>;
        };
        Update: Partial<ProfilReihe>;
        Relationships: [];
      };
      beweis_fotos: {
        Row: { id: number; profil_id: string; blatt_id: string; bild: string; erstellt_am: string };
        Insert: { profil_id: string; blatt_id: string; bild: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

type Gemeinde = {
  sammler: number;
  blaetter: number;
  beweise: number;
  neuestesMitglied: string | null;
};

const NEUIGKEITEN_KEY = "diddlcollect:neuigkeiten";
const NEUIGKEITEN_MS = 5 * 60 * 1000;
const GEMEINDE_MS = 10 * 60 * 1000;

type NeuigkeitenSpiegel = {
  news?: { ts: number; daten: NewsReihe[] };
  gemeinde?: { ts: number; daten: Gemeinde };
};

function leseNeuigkeitenSpiegel(): NeuigkeitenSpiegel {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(NEUIGKEITEN_KEY) ?? "{}") as NeuigkeitenSpiegel;
  } catch {
    return {};
  }
}

function speichereNeuigkeitenSpiegel(spiegel: NeuigkeitenSpiegel) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEUIGKEITEN_KEY, JSON.stringify(spiegel));
  } catch {
    /* Cache voll oder kaputt – Hauptsache kein Absturz */
  }
}

export function loescheNeuigkeitenCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(NEUIGKEITEN_KEY);
}

type NewsBild = {
  bild?: string | null;
  bild2?: string | null;
};

let bilderUnterstuetzt = true;
let linkUnterstuetzt = true;

export function Neuigkeiten() {
  const storeVersion = useStoreVersion();
  const [news, setNews] = useState<NewsReihe[]>([]);
  const [bilder, setBilder] = useState<Record<number, NewsBild>>({});
  const [gemeinde, setGemeinde] = useState<Gemeinde | null>(null);
  const [sichtbar, setSichtbar] = useState(5);

  useEffect(() => {
    let aktiv = true;
    const supabase = getSupabase<Db>();
    if (!supabase) return;
    /* News und Gemeinde-Stats laufen unabhängig – die News erscheinen sofort,
       die Statistik schließt mit den leichten Queries auf. */
    void (async () => {
      const liste = await ladeNews(supabase);
      if (aktiv && liste.length > 0) setNews(liste);
    })();
    void (async () => {
      const stats = await ladeGemeinde(supabase);
      if (aktiv && stats) setGemeinde(stats);
    })();
    return () => {
      aktiv = false;
    };
  }, []);

  useEffect(() => {
    if (!bilderUnterstuetzt) return;
    const ids = news
      .slice(0, sichtbar)
      .map((n) => n.id)
      .filter((id) => !(id in bilder));
    if (ids.length === 0) return;
    const supabase = getSupabase<Db>();
    if (!supabase) return;
    let aktiv = true;
    void ladeBilder(supabase, ids).then((liste) => {
      if (aktiv && Object.keys(liste).length > 0) {
        setBilder((vorher) => ({ ...vorher, ...liste }));
        /* Lazy-Migration: alte Data-URL-Bilder UND übergroße Storage-Bilder
           still auf schlanke Storage-URLs umziehen (nur Admin-Geräte lösen
           aus, max. 2 je Ladung, Server prüft erneut). Anzeige läuft über
           bildUrl – beide Formate, ohne Neuanmeldung. */
        let migriert = 0;
        for (const [id, paar] of Object.entries(liste)) {
          if (migriert >= 2) break;
          const nid = Number(id);
          for (const feld of ["bild", "bild2"] as const) {
            const wert = paar[feld];
            if (!istDatenUrl(wert) && !istHttpUrl(wert)) continue;
            if (migriert >= 2) break;
            migriert++;
            versucheNewsMigration(nid, feld, wert, (url) => {
              if (aktiv) {
                setBilder((vorher) => ({
                  ...vorher,
                  [nid]: { ...vorher[nid], [feld]: url },
                }));
              }
            });
          }
        }
      }
    });
    return () => {
      aktiv = false;
    };
  }, [news, sichtbar, bilder]);

  /* Blatt-Zähler aus der Lean-RPC (derselbe Stand wie Rangliste) – kein
     Full-Table-Download der statuses-Spalte mehr, auch nicht aus dem Cache
     (der seit dem Lean-Boot nur noch Verzeichnis-Spalten enthält). Fallback:
     Summe über den lokalen Cache. */
  const [rangSumme, setRangSumme] = useState<number | null>(null);
  useEffect(() => {
    let aktiv = true;
    void ladeRanglisteRpc().then((zeilen) => {
      if (aktiv && zeilen) setRangSumme(zeilen.reduce((s, z) => s + z.own, 0));
    });
    return () => {
      aktiv = false;
    };
  }, [storeVersion]);
  const blaetterGesamt = rangSumme ?? listBenutzer().reduce((s, u) => s + zaehle(u).own, 0);

  return (
    <div className="card-soft p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-candy-100 text-candy-600">
          <Megaphone className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-ink-800">Neuigkeiten</h2>
          <p className="text-xs font-semibold text-ink-600">
            Neueste Fänge und Infos aus der Sammelgemeinde
          </p>
        </div>
      </div>

      {gemeinde && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GemeindeKarte
            icon={<Users className="h-5 w-5" />}
            wert={String(gemeinde.sammler)}
            label="Sammler dabei"
            farbe="bg-candy-100 text-candy-600"
          />
          <GemeindeKarte
            icon={<Sparkles className="h-5 w-5" />}
            wert={String(blaetterGesamt)}
            label="gehakte Blätter"
            farbe="bg-berry-100 text-berry-400"
          />
          <GemeindeKarte
            icon={<ShieldCheck className="h-5 w-5" />}
            wert={String(gemeinde.beweise)}
            label="Beweise hochgeladen"
            farbe="bg-mint-100 text-emerald-600"
          />
          <GemeindeKarte
            icon={<BadgeCheck className="h-5 w-5" />}
            wert={gemeinde.neuestesMitglied ?? "–"}
            label="Neuestes Mitglied"
            farbe="bg-peach-100 text-peach-500"
          />
        </div>
      )}

      <div className="mt-5 space-y-3">
        {news.length === 0 ? (
          <p className="text-sm font-semibold text-ink-600">
            Noch keine Meldungen – aber die Gemeinde sammelt fleißig weiter. Schau bald wieder vorbei!
          </p>
        ) : (
          news.slice(0, sichtbar).map((n) => (
            <div key={n.id} className="rounded-2xl bg-white p-4 ring-1 ring-cream-200">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display font-bold text-ink-800">{n.titel}</h3>
                <p className="text-xs font-semibold text-ink-600">{formatiereDatum(n.erstellt_am)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{n.text}</p>
              {(bilder[n.id]?.bild || bilder[n.id]?.bild2) && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {bilder[n.id]?.bild && (
                    <Imagelink link={n.link} titel={n.titel}>
                      <img
                        src={bildUrl(bilder[n.id]?.bild, NEWS_BUCKET)}
                        alt={n.titel}
                        loading="lazy"
                        className="max-h-96 w-full rounded-xl object-contain ring-1 ring-cream-200"
                      />
                    </Imagelink>
                  )}
                  {bilder[n.id]?.bild2 && (
                    <Imagelink link={n.link} titel={`${n.titel} (2)`}>
                      <img
                        src={bildUrl(bilder[n.id]?.bild2, NEWS_BUCKET)}
                        alt={`${n.titel} (2)`}
                        loading="lazy"
                        className="max-h-96 w-full rounded-xl object-contain ring-1 ring-cream-200"
                      />
                    </Imagelink>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {news.length > sichtbar && (
          <button
            onClick={() => setSichtbar((s) => s + 5)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-candy-100 px-5 py-2.5 text-sm font-bold text-candy-700 transition hover:bg-candy-200"
          >
            <Plus className="h-4 w-4" />
            Mehr Beiträge anzeigen ({news.length - sichtbar} weitere)
          </button>
        )}
      </div>
    </div>
  );
}

async function ladeNews(supabase: SupabaseClient<Db>): Promise<NewsReihe[]> {
  const spiegel = leseNeuigkeitenSpiegel();
  if (spiegel.news && Date.now() - spiegel.news.ts < NEUIGKEITEN_MS) return spiegel.news.daten;
  if (linkUnterstuetzt) {
    const erste = await supabase
      .from("news")
      .select("id, titel, text, erstellt_am, link")
      .order("erstellt_am", { ascending: false })
      .limit(50);
    if (!erste.error && erste.data) {
      speichereNeuigkeitenSpiegel({ ...leseNeuigkeitenSpiegel(), news: { ts: Date.now(), daten: erste.data } });
      return erste.data;
    }
    if (erste.error?.code !== "PGRST204" && erste.error?.code !== "42703" && erste.error?.code !== "42501") {
      return [];
    }
    linkUnterstuetzt = false;
  }
  const zweite = await supabase
    .from("news")
    .select("id, titel, text, erstellt_am")
    .order("erstellt_am", { ascending: false })
    .limit(50);
  if (!zweite.error && zweite.data) {
    speichereNeuigkeitenSpiegel({ ...leseNeuigkeitenSpiegel(), news: { ts: Date.now(), daten: zweite.data } });
    return zweite.data;
  }
  return [];
}

async function ladeBilder(supabase: SupabaseClient<Db>, ids: number[]): Promise<Record<number, NewsBild>> {
  const { data, error } = await supabase
    .from("news")
    .select("id, bild, bild2")
    .in("id", ids);
  if (error || !data) {
    if (error?.code === "PGRST204" || error?.code === "42703" || error?.code === "42501") {
      bilderUnterstuetzt = false;
    }
    return {};
  }
  const out: Record<number, NewsBild> = {};
  for (const r of data as unknown as { id: number; bild?: string | null; bild2?: string | null }[]) {
    out[r.id] = { bild: r.bild ?? null, bild2: r.bild2 ?? null };
  }
  return out;
}

/** Gemeinde-Statistik ohne die schweren Spalten: Zähler via Count-Head-Queries
 *  (kein Full-Table-Download von statuses/beweise – der Blatt-Zähler kommt
 *  aus dem bereits synchronisierten Cache, siehe blaetterGesamt oben). */
async function ladeGemeinde(supabase: SupabaseClient<Db>): Promise<Gemeinde | null> {
  const spiegel = leseNeuigkeitenSpiegel();
  if (spiegel.gemeinde && Date.now() - spiegel.gemeinde.ts < GEMEINDE_MS) return spiegel.gemeinde.daten;
  const [anzahl, neuestes, fotos] = await Promise.all([
    supabase.from("profile").select("id", { count: "exact", head: true }),
    supabase.from("profile").select("name, created_at").order("created_at", { ascending: false }).limit(1),
    supabase.from("beweis_fotos").select("id", { count: "exact", head: true }),
  ]);
  if (anzahl.error) return null;
  const gemeinde: Gemeinde = {
    sammler: anzahl.count ?? 0,
    blaetter: 0,
    beweise: fotos.count ?? 0,
    neuestesMitglied: neuestes.data?.[0]?.name ?? null,
  };
  speichereNeuigkeitenSpiegel({ ...leseNeuigkeitenSpiegel(), gemeinde: { ts: Date.now(), daten: gemeinde } });
  return gemeinde;
}

function Imagelink({ link, titel, children }: { link?: string | null; titel: string; children: React.ReactNode }) {
  if (!link) return <>{children}</>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group relative block rounded-xl"
      aria-label={`Produkt zu „${titel}“ auf Amazon ansehen`}
    >
      {children}
      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-candy-500/90 px-3 py-1 text-[10px] font-bold text-white opacity-0 shadow-md group-hover:opacity-100">
        Zum Produkt auf Amazon
      </span>
    </a>
  );
}

function GemeindeKarte({
  icon,
  wert,
  label,
  farbe,
}: {
  icon: React.ReactNode;
  wert: string;
  label: string;
  farbe: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-cream-200">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${farbe}`}>{icon}</div>
      <p className="font-display mt-2 truncate text-xl font-bold text-ink-800" title={wert}>
        {wert}
      </p>
      <p className="text-xs font-bold text-ink-600">{label}</p>
    </div>
  );
}

function formatiereDatum(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
