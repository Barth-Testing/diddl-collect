import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, rpcAufruf, supabaseKonfiguriert } from "./supabase";
import { holSessionToken } from "./store";

export const RAUME = [
  { id: "allgemein", label: "Allgemein", beschreibung: "Erzähl von deinen Schätzen, stell dich vor." },
  { id: "tausch", label: "Tausch & Handel", beschreibung: "Doppelte anbieten oder Wünsche finden." },
  { id: "hilfe", label: "Fragen & Hilfe", beschreibung: "Katalog, Punkte, Beweise – hier wird geholfen." },
] as const;

export type ChatNachricht = {
  id: string;
  raum: string;
  autor: string;
  text: string;
  erstelltAm: number;
  offen?: boolean;
};

const CHAT_KEY = "diddlcollect:chat";
const MAX_NACHRICHTEN = 300;

type NachrichtReihe = {
  id: number;
  raum: string;
  autor: string;
  text: string;
  erstellt_am: string;
};

type Db = {
  public: {
    Tables: {
      nachrichten: {
        Row: NachrichtReihe;
        Insert: { raum: string; autor: string; text: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, (args: Record<string, unknown>) => PromiseLike<unknown>>;
  };
};

export function chatKonfiguriert() {
  return supabaseKonfiguriert();
}

let version = 0;
const listeners = new Set<() => void>();

export function subscribeChat(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange() {
  version++;
  listeners.forEach((l) => l());
}

export function getChatVersion() {
  return version;
}

function ladeCache(): { nachrichten: ChatNachricht[]; offen: ChatNachricht[] } {
  if (typeof window === "undefined") return { nachrichten: [], offen: [] };
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    if (!raw) return { nachrichten: [], offen: [] };
    const cache = JSON.parse(raw) as { nachrichten: ChatNachricht[]; offen: ChatNachricht[] };
    return {
      nachrichten: Array.isArray(cache.nachrichten) ? cache.nachrichten : [],
      offen: Array.isArray(cache.offen) ? cache.offen : [],
    };
  } catch {
    return { nachrichten: [], offen: [] };
  }
}

function speichereCache(cache: { nachrichten: ChatNachricht[]; offen: ChatNachricht[] }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(cache));
  emitChange();
}

function alsNachricht(reihe: NachrichtReihe): ChatNachricht {
  return {
    id: String(reihe.id),
    raum: reihe.raum,
    autor: reihe.autor,
    text: reihe.text,
    erstelltAm: new Date(reihe.erstellt_am).getTime(),
  };
}

function fuerRaum(raum: string): ChatNachricht[] {
  const cache = ladeCache();
  const alle = [...cache.offen, ...cache.nachrichten]
    .filter((m) => m.raum === raum)
    .sort((a, b) => a.erstelltAm - b.erstelltAm);
  return alle.slice(-MAX_NACHRICHTEN);
}

function merkeAusSupabase(reihen: NachrichtReihe[]) {
  const cache = ladeCache();
  const bekannt = new Set(cache.nachrichten.map((m) => m.id));
  let neu = 0;
  for (const reihe of reihen) {
    if (bekannt.has(String(reihe.id))) continue;
    cache.nachrichten.push(alsNachricht(reihe));
    bekannt.add(String(reihe.id));
    neu++;
  }
  if (!neu) return;
  cache.nachrichten = cache.nachrichten.sort((a, b) => a.erstelltAm - b.erstelltAm).slice(-MAX_NACHRICHTEN);
  speichereCache(cache);
}

function entferneNachricht(id: string): boolean {
  const cache = ladeCache();
  const vorher = cache.nachrichten.length;
  cache.nachrichten = cache.nachrichten.filter((m) => m.id !== id);
  if (cache.nachrichten.length === vorher) return false;
  speichereCache(cache);
  return true;
}

function entferneOffene(tempId: string, ersatz?: ChatNachricht) {
  const cache = ladeCache();
  const vorher = cache.offen.length;
  cache.offen = cache.offen.filter((m) => m.id !== tempId);
  if (ersatz) {
    cache.nachrichten.push(ersatz);
    cache.nachrichten = cache.nachrichten.sort((a, b) => a.erstelltAm - b.erstelltAm).slice(-MAX_NACHRICHTEN);
  }
  if (cache.offen.length !== vorher || ersatz) speichereCache(cache);
}

function istOfflineDuplikat(reihe: { raum: string; autor: string; text: string }) {
  const cache = ladeCache();
  const treffer = cache.offen.find(
    (m) => m.raum === reihe.raum && m.autor === reihe.autor && m.text === reihe.text,
  );
  if (treffer) entferneOffene(treffer.id);
  return Boolean(treffer);
}

async function syncQueue() {
  const token = holSessionToken();
  if (!token) return;
  const cache = ladeCache();
  const wartend = [...cache.offen];
  for (const m of wartend) {
    const { data, error } = await rpcAufruf<NachrichtReihe>("forum_posten", {
      p_token: token,
      p_raum: m.raum,
      p_text: m.text,
    });
    if (!error && data) {
      entferneOffene(m.id, alsNachricht(data));
    }
  }
}

let kanal: RealtimeChannel | null = null;
let raeumeGestartet = false;
let verbindungsVersuche = 0;
let verbunden = false;

export function istVerbunden() {
  return verbunden;
}

async function ladeRaeume(
  supabase: SupabaseClient<Db>,
  raum: string,
  onNachricht: () => void,
) {
  const erfolge = await Promise.all(RAUME.map((r) => ladeRaum(supabase, r.id)));
  const index = RAUME.findIndex((r) => r.id === raum);
  if (erfolge[index]) onNachricht();
  if (erfolge.some(Boolean) || verbindungsVersuche >= 3) return;
  verbindungsVersuche++;
  setTimeout(() => ladeRaeume(supabase, raum, onNachricht), 10_000);
}

export function verbinde(raum: string, onNachricht: () => void) {
  const supabase = getSupabase<Db>();
  if (!supabase) return () => {};

  if (!raeumeGestartet) {
    raeumeGestartet = true;
    ladeRaeume(supabase, raum, onNachricht);
  }

  if (kanal) kanal.unsubscribe();
  const eigenerKanal = supabase
    .channel("nachrichten")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "nachrichten" },
      (payload) => {
        const reihe = payload.new as NachrichtReihe;
        if (istOfflineDuplikat(reihe)) return;
        merkeAusSupabase([reihe]);
        onNachricht();
      },
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "nachrichten" },
      (payload) => {
        const id = String((payload.old as { id: number }).id);
        if (entferneNachricht(id)) onNachricht();
      },
    )
    .subscribe((status) => {
      verbunden = status === "SUBSCRIBED";
      if (verbunden) syncQueue();
      emitChange();
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

async function ladeRaum(
  supabase: SupabaseClient<Db>,
  raum: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("nachrichten")
    .select("id, raum, autor, text, erstellt_am")
    .eq("raum", raum)
    .order("id", { ascending: false })
    .limit(MAX_NACHRICHTEN);
  if (!error && data) {
    merkeAusSupabase(data);
    const { data: ids } = await supabase
      .from("nachrichten")
      .select("id")
      .eq("raum", raum);
    if (ids) {
      const vorhanden = new Set(ids.map((r: { id: number }) => String(r.id)));
      const cache = ladeCache();
      const vorher = cache.nachrichten.length;
      cache.nachrichten = cache.nachrichten.filter(
        (m) => m.raum !== raum || vorhanden.has(m.id),
      );
      if (cache.nachrichten.length !== vorher) speichereCache(cache);
    }
    return true;
  }
  return false;
}

export function chatNachrichten(raum: string): ChatNachricht[] {
  return fuerRaum(raum);
}

export function senden(raum: string, autor: string, text: string): boolean {
  const sauber = text.trim();
  if (!sauber) return false;
  const cache = ladeCache();
  const temp: ChatNachricht = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    raum,
    autor: autor.trim() || "Anonyme Knuddelmaus",
    text: sauber.slice(0, 500),
    erstelltAm: Date.now(),
    offen: true,
  };
  cache.offen.push(temp);
  speichereCache(cache);

  const token = holSessionToken();
  if (!token) return true;
  rpcAufruf<NachrichtReihe>("forum_posten", { p_token: token, p_raum: temp.raum, p_text: temp.text }).then(({ data, error }) => {
      if (!error && data) entferneOffene(temp.id, alsNachricht(data));
      else if (verbunden) syncQueue();
    });
  return true;
}