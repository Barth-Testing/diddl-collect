import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, rpcAufruf, supabaseKonfiguriert } from "./supabase";
import { holSessionToken } from "./store";

export type TauschAngebotStatus = "offen" | "angenommen" | "abgelehnt" | "storniert";

export type TauschAngebot = {
  id: string;
  blattId: string;
  anbieterId: string;
  anbieterName: string;
  interessentId: string;
  interessentName: string;
  angebotBlaetter: string[];
  angebotBetrag: number | null;
  nachricht: string | null;
  status: TauschAngebotStatus;
  erstelltAm: number;
  aktualisiertAm: number;
};

export type PostNachricht = {
  id: string;
  angebotId: string;
  autor: string;
  text: string;
  erstelltAm: number;
};

type AngebotReihe = {
  id: string;
  blatt_id: string;
  anbieter_id: string;
  anbieter_name: string;
  interessent_id: string;
  interessent_name: string;
  angebot_blatter: string[] | null;
  angebot_betrag: number | null;
  nachricht: string | null;
  status: string;
  erstellt_am: string;
  aktualisiert_am: string;
};

type PostReihe = {
  id: number;
  angebot_id: string;
  autor: string;
  text: string;
  erstellt_am: string;
};

type Db = {
  public: {
    Tables: {
      tauschangebot: {
        Row: AngebotReihe;
        Insert: {
          id: string;
          blatt_id: string;
          anbieter_id: string;
          anbieter_name: string;
          interessent_id: string;
          interessent_name: string;
          angebot_blatter?: string[];
          angebot_betrag?: number | null;
          nachricht?: string | null;
        };
        Update: Partial<AngebotReihe>;
        Relationships: [];
      };
      postnachrichten: {
        Row: PostReihe;
        Insert: { angebot_id: string; autor: string; text: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, (args: Record<string, unknown>) => PromiseLike<unknown>>;
  };
};

type TauschCache = {
  angebote: TauschAngebot[];
  offen: TauschAngebot[];
  post: PostNachricht[];
  postOffen: PostNachricht[];
};

const ANGEBOTE_KEY = "diddlcollect:tauschangebote";
const POST_KEY = "diddlcollect:post";
const GELESEN_KEY = "diddlcollect:postgelesen";
const TAUSCH_KEY = "diddlcollect:tausch";
const FRISCH_KEY = "diddlcollect:tausch:frisch";
const FRISCH_MS = 10 * 60 * 1000;
const MAX_POST = 2000;

export function tauschKonfiguriert() {
  return supabaseKonfiguriert();
}

let tabellenBereit = false;
let tabellenFehlend = false;

export function tauschBereit() {
  return tabellenBereit;
}

export function tauschFehlt() {
  return tabellenFehlend;
}

let version = 0;
const listeners = new Set<() => void>();

export function subscribeTausch(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange() {
  version++;
  listeners.forEach((l) => l());
}

export function getTauschVersion() {
  return version;
}

const leer: TauschCache = { angebote: [], offen: [], post: [], postOffen: [] };

function ladeCache(): TauschCache {
  if (typeof window === "undefined") return leer;
  if (typeof localStorage === "undefined") return { ...leer };
  try {
    const combined = window.localStorage.getItem(TAUSCH_KEY);
    if (combined) {
      const cache = JSON.parse(combined) as Partial<TauschCache>;
      return {
        angebote: Array.isArray(cache.angebote) ? cache.angebote : [],
        offen: Array.isArray(cache.offen) ? cache.offen : [],
        post: Array.isArray(cache.post) ? cache.post : [],
        postOffen: Array.isArray(cache.postOffen) ? cache.postOffen : [],
      };
    }
    /* Migration: alte Einzel-Keys zusammenführen. */
    const alteAngebote = JSON.parse(window.localStorage.getItem(ANGEBOTE_KEY) ?? "{}") as Partial<TauschCache>;
    const altePost = JSON.parse(window.localStorage.getItem(POST_KEY) ?? "{}") as Partial<TauschCache>;
    return {
      angebote: Array.isArray(alteAngebote.angebote) ? alteAngebote.angebote : [],
      offen: Array.isArray(alteAngebote.offen) ? alteAngebote.offen : [],
      post: Array.isArray(altePost.post) ? altePost.post : [],
      postOffen: Array.isArray(altePost.postOffen) ? altePost.postOffen : [],
    };
  } catch {
    return { ...leer };
  }
}

/** Ein gemeinsamer Schlüssel: Speichern ist damit atomar (eine setItem), konkurrierende
 *  Task-Interleavings (Realtime + LadeAlles + Senden) können sich nicht mehr gegenseitig
 *  den Stand wegschreiben. */
function speichereCache(cache: TauschCache) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    TAUSCH_KEY,
    JSON.stringify({
      angebote: cache.angebote.slice(-500),
      offen: cache.offen,
      post: sortierePost(cache.post).slice(-MAX_POST),
      postOffen: cache.postOffen,
    }),
  );
  try {
    window.localStorage.removeItem(ANGEBOTE_KEY);
    window.localStorage.removeItem(POST_KEY);
  } catch {
    /* alte Schlüssel ignorieren – dürfen nie mehr gelesen werden */
  }
  emitChange();
}

/** Serialisiert alle Cache-Mutationen, damit lese-änder-schreibe-Phasen nie
 *  um denselben Snapshot konkurrieren. */
let sperre: Promise<unknown> = Promise.resolve();
function serialisiere<T>(fn: () => T | Promise<T>): Promise<T> {
  const ergebnis = sperre.then(() => fn());
  sperre = ergebnis.catch(() => {});
  return ergebnis;
}

function sortierePost(post: PostNachricht[]) {
  return [...post].sort((a, b) => a.erstelltAm - b.erstelltAm || a.id.localeCompare(b.id));
}

function alsAngebot(reihe: AngebotReihe): TauschAngebot {
  return {
    id: reihe.id,
    blattId: reihe.blatt_id,
    anbieterId: reihe.anbieter_id,
    anbieterName: reihe.anbieter_name,
    interessentId: reihe.interessent_id,
    interessentName: reihe.interessent_name,
    angebotBlaetter: reihe.angebot_blatter ?? [],
    angebotBetrag: reihe.angebot_betrag === null ? null : Number(reihe.angebot_betrag),
    nachricht: reihe.nachricht ?? null,
    status: (reihe.status as TauschAngebotStatus) ?? "offen",
    erstelltAm: new Date(reihe.erstellt_am).getTime(),
    aktualisiertAm: new Date(reihe.aktualisiert_am || reihe.erstellt_am).getTime(),
  };
}

function alsPost(reihe: PostReihe): PostNachricht {
  return {
    id: String(reihe.id),
    angebotId: reihe.angebot_id,
    autor: reihe.autor,
    text: reihe.text,
    erstelltAm: new Date(reihe.erstellt_am).getTime(),
  };
}

function merkeAngebot(angebot: TauschAngebot) {
  const cache = ladeCache();
  const idx = cache.angebote.findIndex((a) => a.id === angebot.id);
  if (idx >= 0) cache.angebote[idx] = angebot;
  else cache.angebote.push(angebot);
  speichereCache(cache);
}

function merkePost(nachricht: PostNachricht) {
  const cache = ladeCache();
  if (cache.post.some((p) => p.id === nachricht.id)) return;
  /* Realtime kann dieselbe Nachricht auch per Ladevorgang bringen -> Duplikat abfangen */
  if (
    cache.post.some(
      (p) => p.angebotId === nachricht.angebotId && p.autor === nachricht.autor && p.text === nachricht.text,
    )
  )
    return;
  cache.post.push(nachricht);
  speichereCache(cache);
}

async function ladeAlles(supabase: ReturnType<typeof getSupabase<Db>>): Promise<boolean> {
  return serialisiere(async () => {
  if (!supabase) return false;
  /* Datensparmodus: frischen Cache (10 Min) nicht erneut komplett laden –
     Realtime liefert neue Einträge ohnehin nach. */
  if (typeof window !== "undefined") {
    const letzte = Number(window.localStorage.getItem(FRISCH_KEY) ?? "0");
    if (Date.now() - letzte < FRISCH_MS && window.localStorage.getItem(TAUSCH_KEY)) {
      tabellenBereit = true;
      tabellenFehlend = false;
      return true;
    }
  }
  const [a, p] = await Promise.all([
    supabase
      .from("tauschangebot")
      .select("*")
      .order("erstellt_am", { ascending: false })
      .limit(500),
    supabase
      .from("postnachrichten")
      .select("id, angebot_id, autor, text, erstellt_am")
      .order("id", { ascending: false })
      .limit(MAX_POST),
  ]);
  if ((a.error || !a.data) && (p.error || !p.data)) {
    const schemaFehlend =
      (a.error?.code === "PGRST205" || a.error?.code === "42703") &&
      (p.error?.code === "PGRST205" || p.error?.code === "42703");
    if (schemaFehlend) tabellenFehlend = true;
    return false;
  }
  tabellenBereit = true;
  tabellenFehlend = false;
  const cache = ladeCache();
  if (!a.error && a.data) {
    const bekannt = new Map(cache.angebote.map((x) => [x.id, x]));
    for (const reihe of a.data as AngebotReihe[]) bekannt.set(reihe.id, alsAngebot(reihe));
    cache.angebote = [...bekannt.values()];
  }
  if (!p.error && p.data) {
    const bekannt = new Set(cache.post.map((x) => x.id));
    for (const reihe of p.data as PostReihe[]) {
      const n = alsPost(reihe);
      if (!bekannt.has(n.id)) {
        cache.post.push(n);
        bekannt.add(n.id);
      }
    }
  }
  speichereCache(cache);
  if (typeof window !== "undefined") window.localStorage.setItem(FRISCH_KEY, String(Date.now()));
  await flushQueueInnere();
  return true;
  });
}

/** Wartende Angebote/Nachrichten (Offline-Zeit) hochladen. */
async function flushQueue() {
  return serialisiere(async () => {
    await flushQueueInnere();
  });
}

async function flushQueueInnere() {
  const token = holSessionToken();
  if (!token) return;
  const cache = ladeCache();
  for (const a of [...cache.offen]) {
    const { data, error } = await rpcAufruf<AngebotReihe>("angebot_anlegen", {
      p_token: token,
      p_id: a.id,
      p_blatt_id: a.blattId,
      p_anbieter_id: a.anbieterId,
      p_anbieter_name: a.anbieterName,
      p_angebot_blatter: a.angebotBlaetter,
      p_angebot_betrag: a.angebotBetrag,
      p_nachricht: a.nachricht,
    });
    if (!error && data) {
      const frisch = ladeCache();
      frisch.offen = frisch.offen.filter((x) => x.id !== a.id);
      speichereCache(frisch);
      merkeAngebot(alsAngebot(data as unknown as AngebotReihe));
    } else if (error) break;
  }
  for (const m of [...cache.postOffen]) {
    const { data, error } = await rpcAufruf<PostReihe>("post_senden", {
      p_token: token,
      p_angebot_id: m.angebotId,
      p_text: m.text,
    });
    if (!error && data) {
      const frisch = ladeCache();
      frisch.post = frisch.post.filter((x) => x.id !== m.id);
      frisch.postOffen = frisch.postOffen.filter((x) => x.id !== m.id);
      speichereCache(frisch);
      merkePost(alsPost(data as unknown as PostReihe));
    } else if (error) break;
  }
}

let kanal: RealtimeChannel | null = null;
let gestartet = false;
let verbunden = false;

export function tauschVerbunden() {
  return verbunden;
}

export function verbindeTausch(onAenderung?: () => void) {
  const supabase = getSupabase<Db>();
  if (!supabase) return () => {};

  if (!gestartet) {
    gestartet = true;
    void ladeAlles(supabase).then((ok) => {
      emitChange();
      onAenderung?.();
      if (!ok) setTimeout(() => void ladeAlles(supabase).then(() => emitChange()), 15_000);
    });
  }

  if (kanal) kanal.unsubscribe();
  const eigenerKanal = supabase
    .channel("tausch")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "tauschangebot" },
      (payload) => {
        const temp = ladeCache().offen.find((a) => a.id === (payload.new as AngebotReihe).id);
        merkeAngebot(alsAngebot(payload.new as AngebotReihe));
        if (temp) {
          const cache = ladeCache();
          cache.offen = cache.offen.filter((x) => x.id !== temp.id);
          speichereCache(cache);
        }
        onAenderung?.();
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tauschangebot" },
      (payload) => {
        merkeAngebot(alsAngebot(payload.new as AngebotReihe));
        onAenderung?.();
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "postnachrichten" },
      (payload) => {
        const cache = ladeCache();
        const reihe = payload.new as PostReihe;
        const doppelt = cache.postOffen.find(
          (m) => m.angebotId === reihe.angebot_id && m.autor === reihe.autor && m.text === reihe.text,
        );
        merkePost(alsPost(reihe));
        if (doppelt) {
          const frisch = ladeCache();
          frisch.postOffen = frisch.postOffen.filter((x) => x.id !== doppelt.id);
          speichereCache(frisch);
        }
        onAenderung?.();
      },
    )
    .subscribe((status) => {
      verbunden = status === "SUBSCRIBED";
      if (verbunden) void flushQueue();
      emitChange();
      onAenderung?.();
    });
  kanal = eigenerKanal;

  return () => {
    if (kanal === eigenerKanal) {
      kanal = null;
      verbunden = false;
      eigenerKanal.unsubscribe();
    }
  };
}

export function alleAngebote(): TauschAngebot[] {
  return ladeCache().angebote.sort((a, b) => b.erstelltAm - a.erstelltAm);
}

export function allePost(): PostNachricht[] {
  return sortierePost(ladeCache().post);
}

export function postZu(angebotId: string): PostNachricht[] {
  return allePost().filter((m) => m.angebotId === angebotId);
}

export function meineAngebote(ich: { id: string; name: string }): TauschAngebot[] {
  return alleAngebote().filter(
    (a) => a.anbieterId === ich.id || a.interessentId === ich.id,
  );
}

export async function erstelleAngebot(eingabe: {
  blattId: string;
  anbieter: { id: string; name: string };
  ich: { id: string; name: string };
  eigeneBlatter: string[];
  betrag: number | null;
  nachricht: string | null;
}): Promise<TauschAngebot> {
  return serialisiere(async () => {
  const angebot: TauschAngebot = {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    blattId: eingabe.blattId,
    anbieterId: eingabe.anbieter.id,
    anbieterName: eingabe.anbieter.name,
    interessentId: eingabe.ich.id,
    interessentName: eingabe.ich.name,
    angebotBlaetter: eingabe.eigeneBlatter,
    angebotBetrag: eingabe.betrag,
    nachricht: eingabe.nachricht,
    status: "offen",
    erstelltAm: Date.now(),
    aktualisiertAm: Date.now(),
  };
  merkeAngebot({ ...angebot, status: "offen" });
  const cache = ladeCache();
  cache.offen.push(angebot);
  speichereCache(cache);

  const token = holSessionToken();
  const { data, error } = token
    ? await rpcAufruf<AngebotReihe>("angebot_anlegen", {
        p_token: token,
        p_id: angebot.id,
        p_blatt_id: angebot.blattId,
        p_anbieter_id: angebot.anbieterId,
        p_anbieter_name: angebot.anbieterName,
        p_angebot_blatter: angebot.angebotBlaetter,
        p_angebot_betrag: angebot.angebotBetrag,
        p_nachricht: angebot.nachricht,
      })
    : { data: null, error: null };
  if (!error && data) {
    const frisch = ladeCache();
    frisch.offen = frisch.offen.filter((x) => x.id !== angebot.id);
    speichereCache(frisch);
    merkeAngebot(alsAngebot(data as unknown as AngebotReihe));
    tabellenBereit = true;
  }
  return angebot;
  });
}

export async function setzeAngebotStatus(id: string, status: TauschAngebotStatus) {
  return serialisiere(async () => {
  const jetzt = Date.now();
  const cache = ladeCache();
  const idx = cache.angebote.findIndex((a) => a.id === id);
  if (idx >= 0) {
    cache.angebote[idx] = { ...cache.angebote[idx], status, aktualisiertAm: jetzt };
    speichereCache(cache);
  }
  const token = holSessionToken();
  if (!token) return;
  const { error } = await rpcAufruf("angebot_status", {
    p_token: token,
    p_angebot_id: id,
    p_status: status,
  });
  if (!error) tabellenBereit = true;
  });
}

export async function sendePost(angebotId: string, autor: string, text: string) {
  return serialisiere(async () => {
  const sauber = text.trim();
  if (!sauber) return false;
  const nachricht: PostNachricht = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    angebotId,
    autor: autor.trim() || "Anonyme Knuddelmaus",
    text: sauber.slice(0, 500),
    erstelltAm: Date.now(),
  };
  const cache = ladeCache();
  cache.postOffen.push(nachricht);
  cache.post.push(nachricht);
  speichereCache(cache);

  const token = holSessionToken();
  if (!token) return true;
  const { data, error } = await rpcAufruf<PostReihe>("post_senden", {
    p_token: token,
    p_angebot_id: angebotId,
    p_text: nachricht.text,
  });
  if (!error && data) {
    const frisch = ladeCache();
    frisch.post = frisch.post.filter((x) => x.id !== nachricht.id);
    frisch.postOffen = frisch.postOffen.filter((x) => x.id !== nachricht.id);
    speichereCache(frisch);
    merkePost(alsPost(data as PostReihe));
    tabellenBereit = true;
  }
  return true;
  });
}

/* ---------- Ungelesen-Markierung ---------- */

function leseGelesen(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(GELESEN_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function markiereGelesen(angebotId: string) {
  if (typeof window === "undefined") return;
  const gelesen = leseGelesen();
  const stand = gelesen[angebotId] ?? 0;
  const jetzt = Date.now();
  /* Nur bei echten Änderungen senden – sonst entsteht eine Endlos-Render-Schleife
     (PostfachApp re-rendert bei jedem emitChange und ruft markiereGelesen erneut). */
  if (jetzt - stand < 5000) return;
  gelesen[angebotId] = jetzt;
  window.localStorage.setItem(GELESEN_KEY, JSON.stringify(gelesen));
  emitChange();
}

export function ungeleseneThreads(ich: { id: string }): number {
  const gelesen = leseGelesen();
  const cache = ladeCache();
  const meine = cache.angebote.filter(
    (a) =>
      (a.anbieterId === ich.id || a.interessentId === ich.id) &&
      a.status !== "storniert" &&
      a.status !== "abgelehnt",
  );
  let count = 0;
  for (const a of meine) {
    const stand = gelesen[a.id] ?? 0;
    const fremde = cache.post.some(
      (m) =>
        m.angebotId === a.id &&
        m.autor !== "" &&
        m.erstelltAm > stand &&
        m.autor !== meinNameFuer(a, ich.id),
    );
    if (fremde) count++;
  }
  return count;
}

/**
 * Wer hat geschrieben? Im Thread schreibt der Anbieter mit seinem Namen und der
 * Interessent mit seinem – ein Name kann theoretisch doppelt vorkommen, dann
 * zählt die ID-Zuordnung.
 */
function meinNameFuer(angebot: TauschAngebot, ichId: string): string | undefined {
  if (angebot.anbieterId === ichId) return angebot.anbieterName;
  if (angebot.interessentId === ichId) return angebot.interessentName;
  return undefined;
}
