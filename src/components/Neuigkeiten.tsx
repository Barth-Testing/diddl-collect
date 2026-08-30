"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BadgeCheck, Megaphone, Plus, ShieldCheck, Sparkles, Users } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { listBenutzer, zaehle } from "@/lib/store";

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

export function Neuigkeiten() {
  const [news, setNews] = useState<NewsReihe[]>([]);
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
            wert={String(gemeinde.blaetter)}
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
              {(n.bild || n.bild2) && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {n.bild && (
                    <Imagelink link={n.link} titel={n.titel}>
                      <img
                        src={n.bild}
                        alt={n.titel}
                        loading="lazy"
                        className="max-h-96 w-full rounded-xl object-contain ring-1 ring-cream-200"
                      />
                    </Imagelink>
                  )}
                  {n.bild2 && (
                    <Imagelink link={n.link} titel={`${n.titel} (2)`}>
                      <img
                        src={n.bild2}
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
  const erste = await supabase
    .from("news")
    .select("id, titel, text, erstellt_am, bild, bild2, link")
    .order("erstellt_am", { ascending: false })
    .limit(50);
  if (!erste.error && erste.data) return erste.data;
  const zweite = await supabase
    .from("news")
    .select("id, titel, text, erstellt_am, bild, bild2")
    .order("erstellt_am", { ascending: false })
    .limit(50);
  if (!zweite.error && zweite.data) return zweite.data;
  const dritte = await supabase
    .from("news")
    .select("id, titel, text, erstellt_am, bild")
    .order("erstellt_am", { ascending: false })
    .limit(50);
  if (!dritte.error && dritte.data) return dritte.data;
  const vierte = await supabase
    .from("news")
    .select("id, titel, text, erstellt_am")
    .order("erstellt_am", { ascending: false })
    .limit(50);
  if (!vierte.error && vierte.data) return vierte.data;
  return [];
}

/** Gemeinde-Statistik ohne die schweren Spalten: Zähler via Count-Head-Queries,
 *  Blatt-Zähler aus dem bereits synchronisierten Cache (derselbe Stand wie Rangliste).
 *  Nur bei leerem Cache (Erstbesuch) wird als Fallback die statuses-Spalte geladen. */
async function ladeGemeinde(supabase: SupabaseClient<Db>): Promise<Gemeinde | null> {
  const [anzahl, neuestes, fotos] = await Promise.all([
    supabase.from("profile").select("id", { count: "exact", head: true }),
    supabase.from("profile").select("name, created_at").order("created_at", { ascending: false }).limit(1),
    supabase.from("beweis_fotos").select("id", { count: "exact", head: true }),
  ]);
  if (anzahl.error) return null;
  let beweise = 0;
  if (!fotos.error) {
    beweise = fotos.count ?? 0;
  } else {
    /* Tabelle existiert noch nicht -> alte Zählweise (nur Anzahl, nichts speichern). */
    const alt = await supabase.from("profile").select("beweise");
    if (!alt.error && alt.data) {
      for (const r of alt.data) beweise += Object.keys(r.beweise ?? {}).length;
    }
  }
  let blaetter = 0;
  const cache = listBenutzer();
  if (cache.length >= 5) {
    for (const u of cache) blaetter += zaehle(u).own;
  } else {
    const statuses = await supabase.from("profile").select("statuses");
    if (!statuses.error && statuses.data) {
      for (const r of statuses.data) {
        for (const s of Object.values(r.statuses ?? {})) {
          if (s === "own" || (Array.isArray(s) && s.includes("own"))) blaetter++;
        }
      }
    }
  }
  return {
    sammler: anzahl.count ?? 0,
    blaetter,
    beweise,
    neuestesMitglied: neuestes.data?.[0]?.name ?? null,
  };
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
