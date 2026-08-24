import type { Benutzer, Status, TauschInfo } from "./types";
import { getSupabase, hashPasswort, istHash, supabaseKonfiguriert } from "./supabase";

const USERS_KEY = "diddlcollect:benutzer";
const SESSION_KEY = "diddlcollect:session";

/**
 * Konten liegen dauerhaft in Supabase (Tabelle "profile"). Der localStorage
 * ist nur noch ein Offline-Cache, damit die Seite sofort reagiert und auch
 * ohne Netz benutzbar bleibt. Nach dem Start (oder bei Netz) werden alle
 * Konten mit dem Server abgeglichen – ein gelöschter Browser-Speicher ist
 * damit kein Datenverlust mehr.
 */

type ProfileRow = {
  id: string;
  name: string;
  passwort: string;
  created_at: string;
  statuses: Record<string, Status> | null;
  beweise: Record<string, string> | null;
  favoriten?: Record<string, boolean> | null;
  tausch?: Record<string, TauschInfo> | null;
};

type ProfileDb = {
  public: {
    Tables: {
      profile: {
        Row: ProfileRow;
        Insert: {
          id: string;
          name: string;
          passwort: string;
          statuses: Record<string, Status>;
          beweise: Record<string, string>;
          favoriten?: Record<string, boolean>;
          tausch?: Record<string, TauschInfo>;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

let version = 0;
const listeners = new Set<() => void>();

function emitChange() {
  version++;
  listeners.forEach((l) => l());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("diddlcollect:change"));
  }
}

export function subscribeChange(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("diddlcollect:change", listener);
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("diddlcollect:change", listener);
      window.removeEventListener("storage", listener);
    }
  };
}

export function getVersion() {
  return version;
}

function loadUsers(): Benutzer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const users = JSON.parse(raw) as Array<Benutzer & { demo?: boolean }>;
    const ohneDemo = users.filter((u) => !u.demo);
    if (ohneDemo.length !== users.length) saveUsers(ohneDemo);
    return ohneDemo.map((u) => ({ ...u, favoriten: u.favoriten ?? {}, tausch: u.tausch ?? {} })) as Benutzer[];
  } catch {
    return [];
  }
}

function saveUsers(users: Benutzer[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  emitChange();
}

function zeileZuBenutzer(zeile: ProfileRow): Benutzer {
  return {
    id: zeile.id,
    name: zeile.name,
    passwort: zeile.passwort,
    createdAt: new Date(zeile.created_at).getTime(),
    statuses: zeile.statuses ?? {},
    beweise: zeile.beweise ?? {},
    favoriten: zeile.favoriten ?? {},
    tausch: zeile.tausch ?? {},
  };
}

let synchronisiert = false;
let syncLaeuft = false;
let syncErneut = false;
let favoritenUnterstuetzt = true;
let tauschUnterstuetzt = true;

function istSchemaFehler(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST204" || error?.code === "42703";
}

/** Spaltenliste ohne die optionalen Spalten, die (noch) nicht in der DB existieren. */
function profilSpalten(): string {
  const spalten = ["id", "name", "passwort", "created_at", "statuses", "beweise"];
  if (favoritenUnterstuetzt) spalten.push("favoriten");
  if (tauschUnterstuetzt) spalten.push("tausch");
  return spalten.join(", ");
}

async function ladeProfileZeilen(): Promise<ProfileRow[] | null> {
  const supabase = getSupabase<ProfileDb>();
  if (!supabase) return null;
  const erste = await supabase.from("profile").select(profilSpalten());
  if (!erste.error && erste.data) return erste.data as unknown as ProfileRow[];
  if (istSchemaFehler(erste.error)) {
    if (tauschUnterstuetzt) {
      tauschUnterstuetzt = false;
      return ladeProfileZeilen();
    }
    if (favoritenUnterstuetzt) {
      favoritenUnterstuetzt = false;
      return ladeProfileZeilen();
    }
  }
  return null;
}

function starteSync() {
  if (typeof window === "undefined") return;
  if (!supabaseKonfiguriert() || synchronisiert || syncLaeuft) return;
  syncLaeuft = true;
  syncMitServer()
    .catch(() => {})
    .finally(() => {
      syncLaeuft = false;
      if (syncErneut) {
        syncErneut = false;
        starteSync();
      }
    });
}

/** Server-Konten in den Cache laden, lokale Änderungen hochladen. */
async function syncMitServer() {
  const data = await ladeProfileZeilen();
  if (!data) return;
  synchronisiert = true;

  const lokal = loadUsers();
  const lokalById = new Map(lokal.map((u) => [u.id, u]));
  const ergebnis = new Map<string, Benutzer>();
  const serverIds = new Set<string>();
  let geaendert = false;

  for (const zeile of data) {
    serverIds.add(zeile.id);
    const server = zeileZuBenutzer(zeile);
    const lok = lokalById.get(zeile.id);
    if (!lok) {
      ergebnis.set(zeile.id, server);
      geaendert = true;
      continue;
    }
    const statuses = { ...lok.statuses, ...server.statuses };
    const beweise = { ...lok.beweise, ...server.beweise };
    const favoriten = { ...lok.favoriten, ...server.favoriten };
    const tausch = { ...lok.tausch, ...server.tausch };
    const gemergt: Benutzer = { ...server, statuses, beweise, favoriten, tausch };
    ergebnis.set(zeile.id, gemergt);
    if (
      JSON.stringify(statuses) !== JSON.stringify(lok.statuses) ||
      JSON.stringify(beweise) !== JSON.stringify(lok.beweise) ||
      JSON.stringify(favoriten) !== JSON.stringify(lok.favoriten) ||
      JSON.stringify(tausch) !== JSON.stringify(lok.tausch)
    ) {
      pushProfil(gemergt);
    }
  }

  for (const [id, lok] of lokalById) {
    if (serverIds.has(id)) continue;
    ergebnis.set(id, lok);
    geaendert = true;
    if ((await pushProfil(lok)) === false) ergebnis.delete(id);
  }

  if (geaendert) saveUsers([...ergebnis.values()]);
}

/** Ein Konto (komplett) auf den Server schreiben – Klartext-Passwörter werden vorher gehasht. */
async function pushProfil(benutzer: Benutzer): Promise<boolean> {
  const supabase = getSupabase<ProfileDb>();
  if (!supabase) return true;
  const passwort = istHash(benutzer.passwort)
    ? benutzer.passwort
    : await hashPasswort(benutzer.passwort);
  function daten(): ProfileDb["public"]["Tables"]["profile"]["Insert"] {
    return {
      id: benutzer.id,
      name: benutzer.name,
      passwort,
      statuses: benutzer.statuses,
      beweise: benutzer.beweise,
      ...(favoritenUnterstuetzt ? { favoriten: benutzer.favoriten ?? {} } : {}),
      ...(tauschUnterstuetzt ? { tausch: benutzer.tausch ?? {} } : {}),
    };
  }
  let ergebnis = await supabase.from("profile").upsert(daten(), { onConflict: "id" });
  if (ergebnis.error && istSchemaFehler(ergebnis.error)) {
    if (tauschUnterstuetzt) {
      tauschUnterstuetzt = false;
      ergebnis = await supabase.from("profile").upsert(daten(), { onConflict: "id" });
    } else if (favoritenUnterstuetzt) {
      favoritenUnterstuetzt = false;
      ergebnis = await supabase.from("profile").upsert(daten(), { onConflict: "id" });
    }
  }
  const { error } = ergebnis;
  if (error) {
    if (error.code === "23505") {
      const sessionId = window.localStorage.getItem(SESSION_KEY);
      const users = loadUsers().filter((u) => u.id !== benutzer.id);
      saveUsers(users);
      if (sessionId === benutzer.id) window.localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  }
  if (passwort !== benutzer.passwort) {
    const users = loadUsers();
    const gefunden = users.find((u) => u.id === benutzer.id);
    if (gefunden) {
      gefunden.passwort = passwort;
      saveUsers(users);
    }
  }
  return true;
}

export function listBenutzer(): Benutzer[] {
  starteSync();
  return loadUsers();
}

export function getSession(): Benutzer | null {
  if (typeof window === "undefined") return null;
  starteSync();
  const id = window.localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return loadUsers().find((u) => u.id === id) ?? null;
}

export async function register(
  name: string,
  passwort: string,
): Promise<{ ok: boolean; fehler?: string; nurLokal?: boolean }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, fehler: "Der Sammlername braucht mindestens 2 Zeichen." };
  if (passwort.length < 4) return { ok: false, fehler: "Das Passwort braucht mindestens 4 Zeichen." };
  const users = loadUsers();
  if (users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase()))
    return { ok: false, fehler: "Diesen Sammlernamen gibt es schon – versuch einen anderen." };
  const user: Benutzer = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    passwort: "",
    createdAt: Date.now(),
    statuses: {},
    beweise: {},
    favoriten: {},
    tausch: {},
  };
  if (supabaseKonfiguriert()) {
    user.passwort = await hashPasswort(passwort);
    const supabase = getSupabase<ProfileDb>();
    function daten(): ProfileDb["public"]["Tables"]["profile"]["Insert"] {
      return {
        id: user.id,
        name: user.name,
        passwort: user.passwort,
        statuses: {},
        beweise: {},
        ...(favoritenUnterstuetzt ? { favoriten: {} } : {}),
        ...(tauschUnterstuetzt ? { tausch: {} } : {}),
      };
    }
    let ergebnis = await supabase!.from("profile").insert(daten());
    if (ergebnis.error && istSchemaFehler(ergebnis.error)) {
      if (tauschUnterstuetzt) {
        tauschUnterstuetzt = false;
        ergebnis = await supabase!.from("profile").insert(daten());
      } else if (favoritenUnterstuetzt) {
        favoritenUnterstuetzt = false;
        ergebnis = await supabase!.from("profile").insert(daten());
      }
    }
    const error = ergebnis.error;
    if (error) {
      if (error.code === "23505")
        return { ok: false, fehler: "Diesen Sammlernamen gibt es schon – versuch einen anderen." };
      /* Kein Netz oder Serverproblem: Konto vorerst nur lokal – der nächste Sync holt es hoch. */
      users.push(user);
      saveUsers(users);
      window.localStorage.setItem(SESSION_KEY, user.id);
      emitChange();
      return { ok: true, nurLokal: true };
    }
  } else {
    user.passwort = passwort;
  }
  users.push(user);
  saveUsers(users);
  window.localStorage.setItem(SESSION_KEY, user.id);
  emitChange();
  return { ok: true };
}

export async function login(
  name: string,
  passwort: string,
): Promise<{ ok: boolean; fehler?: string }> {
  const fehler = { ok: false as const, fehler: "Name oder Passwort stimmen nicht." };
  const trimmed = name.trim();
  const users = loadUsers();
  for (const u of users) {
    if (u.name.toLowerCase() !== trimmed.toLowerCase()) continue;
    const passt =
      u.passwort === passwort ||
      (istHash(u.passwort) && u.passwort === (await hashPasswort(passwort)));
    if (passt) {
      window.localStorage.setItem(SESSION_KEY, u.id);
      emitChange();
      return { ok: true };
    }
    return fehler;
  }
  const supabase = getSupabase<ProfileDb>();
  if (supabase) {
    let { data } = await supabase.from("profile").select("*").eq("name", trimmed);
    if (!data || data.length === 0) {
      ({ data } = await supabase.from("profile").select("*").ilike("name", trimmed));
    }
    const hash = await hashPasswort(passwort);
    const zeile = data?.find((z) => z.passwort === hash);
    if (zeile) {
      const benutzer = zeileZuBenutzer(zeile);
      const rest = loadUsers().filter((u) => u.id !== zeile.id);
      saveUsers([...rest, benutzer]);
      window.localStorage.setItem(SESSION_KEY, zeile.id);
      emitChange();
      return { ok: true };
    }
  }
  return fehler;
}

export function logout() {
  window.localStorage.removeItem(SESSION_KEY);
  emitChange();
}

export function setStatus(blattId: string, status: Status | null) {
  const users = loadUsers();
  const id = window.localStorage.getItem(SESSION_KEY);
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (status === null) delete user.statuses[blattId];
  else user.statuses[blattId] = status;
  saveUsers(users);
  pushProfil(user);
}

export function setBeweis(blattId: string, dataUrl: string | null) {
  const users = loadUsers();
  const id = window.localStorage.getItem(SESSION_KEY);
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (dataUrl === null) delete user.beweise[blattId];
  else user.beweise[blattId] = dataUrl;
  saveUsers(users);
  pushProfil(user);
}

export function setFavorit(blattId: string, istFavorit: boolean) {
  const users = loadUsers();
  const id = window.localStorage.getItem(SESSION_KEY);
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (istFavorit) user.favoriten[blattId] = true;
  else delete user.favoriten[blattId];
  saveUsers(users);
  pushProfil(user);
}

export function setzeTauschInfo(blattId: string, info: TauschInfo | null) {
  const users = loadUsers();
  const id = window.localStorage.getItem(SESSION_KEY);
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (!user.tausch) user.tausch = {};
  if (info === null || (!info.betrag && !info.notiz)) delete user.tausch[blattId];
  else user.tausch[blattId] = info;
  saveUsers(users);
  pushProfil(user);
}

export function zaehle(user: Benutzer) {
  let own = 0;
  let wish = 0;
  let offer = 0;
  for (const s of Object.values(user.statuses)) {
    if (s === "own") own++;
    else if (s === "wish") wish++;
    else offer++;
  }
  return { own, wish, offer, beweise: Object.keys(user.beweise ?? {}).length };
}

export type RangEintrag = {
  benutzer: Benutzer;
  own: number;
  wish: number;
  offer: number;
  beweise: number;
  punkte: number;
  freigeschaltet: boolean;
  rang: number;
};

/**
 * Rangliste: Wer mehr als 100 eigene Blätter hat, aber weniger als 100 davon
 * per Foto belegt, wird vorläufig mit 100 Punkten gewertet und normal im
 * Feld mitgereiht. Erst ab 100 Beweisen zählen alle Punkte.
 */
export function berechneRangliste(): RangEintrag[] {
  starteSync();
  const users = loadUsers()
    .map((u) => ({ benutzer: u, ...zaehle(u) }))
    .map((u) => ({ ...u, punkte: u.own > 100 && u.beweise < 100 ? 100 : u.own }))
    .sort((a, b) => b.punkte - a.punkte || a.benutzer.name.localeCompare(b.benutzer.name));
  return users
    .map((u) => ({
      benutzer: u.benutzer,
      own: u.own,
      wish: u.wish,
      offer: u.offer,
      beweise: u.beweise,
      punkte: u.punkte,
      freigeschaltet: u.own <= 100 || u.beweise >= 100,
      rang: 0,
    }))
    .map((e, i) => ({ ...e, rang: i + 1 }));
}