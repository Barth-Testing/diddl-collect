import type { Benutzer, Status, TauschInfo } from "./types";
import { normalisiereStatuses, remappeBlattSchluessel } from "./types";
import { getSupabase, hashPasswort, rpcAufruf, supabaseKonfiguriert } from "./supabase";

const USERS_KEY = "diddlcollect:benutzer";
const SESSION_KEY = "diddlcollect:session";
const USERID_KEY = "diddlcollect:userid";
const SYNCZEIT_KEY = "diddlcollect:synczeit";
const SYNC_TTL = 12 * 60 * 60 * 1000;

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
  statuses: Record<string, Status | Status[]> | null;
  beweise: Record<string, string | boolean> | null;
  favoriten?: Record<string, boolean> | null;
  tausch?: Record<string, TauschInfo> | null;
  supporter?: boolean | null;
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
          statuses: Record<string, Status[]>;
          beweise: Record<string, string | boolean>;
          favoriten?: Record<string, boolean>;
          tausch?: Record<string, TauschInfo>;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      beweis_fotos: {
        Row: { id: string; profil_id: string; blatt_id: string; bild: string; erstellt_am: string };
        Insert: { profil_id: string; blatt_id: string; bild: string };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, (args: Record<string, unknown>) => PromiseLike<unknown>>;
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
    return ohneDemo.map(
      (u) =>
        ({
          ...u,
          statuses: normalisiereStatuses(u.statuses),
          beweise: remappeBlattSchluessel(u.beweise ?? {}),
          favoriten: remappeBlattSchluessel(u.favoriten ?? {}),
          tausch: remappeBlattSchluessel(u.tausch ?? {}),
          supporter: u.supporter === true,
        }) as Benutzer,
    );
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
    statuses: normalisiereStatuses(zeile.statuses),
    beweise: remappeBlattSchluessel(zeile.beweise ?? {}),
    favoriten: remappeBlattSchluessel(zeile.favoriten ?? {}),
    tausch: remappeBlattSchluessel(zeile.tausch ?? {}),
    supporter: zeile.supporter === true,
  };
}

/* ---------- Session-Token (serverseitig vergeben, 30 Tage gültig) ---------- */

const TOKEN_FORMAT = /^[0-9a-f]{64}$/;

function istToken(wert: string): boolean {
  return TOKEN_FORMAT.test(wert);
}

/** Der aktuelle Session-Token (256-Bit-Zufall) – ersetzt die alte Klartext-User-ID. */
export function holSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  const wert = window.localStorage.getItem(SESSION_KEY) ?? "";
  if (istToken(wert)) return wert;
  /* Migration: früher lag hier die Klartext-User-ID. In "userid" verschieben –
     ohne Token laufen Schreibvorgänge bis zum nächsten Login lokal weiter. */
  if (wert) {
    window.localStorage.setItem(USERID_KEY, wert);
    window.localStorage.removeItem(SESSION_KEY);
  }
  return null;
}

function setzeSession(token: string, userId: string) {
  window.localStorage.setItem(SESSION_KEY, token);
  window.localStorage.setItem(USERID_KEY, userId);
}

function loescheSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(USERID_KEY);
}

function sessionNutzerId(): string | null {
  return window.localStorage.getItem(USERID_KEY);
}

/** 28000 = Session/Passwort serverseitig ungültig → lokale Sitzung verwerfen. */
function istSessionFehler(code?: string) {
  return code === "28000" || code === "42501";
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
  /* Datenvolumen-Sparmodus: frisches Kopien-Cache (letzte 12 h) wird nicht
     erneut heruntergeladen – jede Seite lädt sonst ~1,4 MB Konten-Daten. */
  const letzte = Number(window.localStorage.getItem(SYNCZEIT_KEY) ?? "0");
  if (Date.now() - letzte < SYNC_TTL && window.localStorage.getItem(USERS_KEY)) {
    synchronisiert = true;
    return;
  }
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
    /* Hochladen nur für das EIGENE Konto (Session-Token gehört dem Nutzer);
       bei anderen Konten gibt es keine lokalen Änderungen – nur anfassen,
       wenn sich durch die Server-Daten etwas geändert hat. */
    if (
      zeile.id === sessionNutzerId() &&
      (JSON.stringify(statuses) !== JSON.stringify(lok.statuses) ||
        JSON.stringify(beweise) !== JSON.stringify(lok.beweise) ||
        JSON.stringify(favoriten) !== JSON.stringify(lok.favoriten) ||
        JSON.stringify(tausch) !== JSON.stringify(lok.tausch))
    ) {
      pushProfil(gemergt);
    }
  }

  const sessionId = sessionNutzerId();
  for (const [id, lok] of lokalById) {
    if (serverIds.has(id)) continue;
    /* Nur das eigenen (noch offline angelegte) Konto wieder hochladen –
       Spiegel von gelöschten Server-Konten (z. B. Admin-Eingriff) wären
       sonst wie Zombies bei jedem Sync re-anlegt. */
    if (id !== sessionId) continue;
    ergebnis.set(id, lok);
    geaendert = true;
    if ((await pushProfil(lok)) === false) ergebnis.delete(id);
  }

  if (geaendert) saveUsers([...ergebnis.values()]);
  window.localStorage.setItem(SYNCZEIT_KEY, String(Date.now()));
}

/** Die eigene Sammlung serverseitig sichern – via Session-Token (RPC). */
async function pushProfil(benutzer: Benutzer): Promise<boolean> {
  const token = holSessionToken();
  if (!token) return true;
  const { error } = await rpcAufruf("profil_schreiben", {
    p_token: token,
    p_statuses: benutzer.statuses,
    p_beweise: benutzer.beweise,
    p_favoriten: benutzer.favoriten ?? {},
    p_tausch: benutzer.tausch ?? {},
  });
  if (error) {
    if (istSessionFehler(error.code)) {
      loescheSession();
      emitChange();
    }
    return true;
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
  const id = sessionNutzerId();
  if (!id) return null;
  return loadUsers().find((u) => u.id === id) ?? null;
}

type KontoAntwort = {
  ok: boolean;
  token?: string;
  profil?: ProfileRow;
  fehler?: string;
  nurLokal?: boolean;
};

/** Anmelde-Ergebnis in die Ladensicht übernehmen (Token + Profil in Cache). */
function uebernimmAnmeldung(ergebnis: KontoAntwort): { ok: boolean; fehler?: string; nurLokal?: boolean } {
  if (!ergebnis.ok || !ergebnis.token || !ergebnis.profil) {
    return { ok: false, fehler: ergebnis.fehler ?? "Das hat nicht geklappt – schau später noch einmal vorbei." };
  }
  const benutzer = zeileZuBenutzer(ergebnis.profil);
  const vorhanden = loadUsers().find((u) => u.id === benutzer.id);
  if (vorhanden?.supporter) benutzer.supporter = true;
  const rest = loadUsers().filter((u) => u.id !== benutzer.id);
  saveUsers([...rest, benutzer]);
  setzeSession(ergebnis.token, benutzer.id);
  emitChange();
  return { ok: true };
}

/** Netzwerk-/Serverfehler? → Freundliche Meldung, keine falschen Diagnosen. */
function istNetzFehler(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code == null || error.code === "PGRST302" || /Failed to fetch|fetch failed/i.test(error.message ?? "");
}

export async function register(
  name: string,
  passwort: string,
  email?: string,
): Promise<{ ok: boolean; fehler?: string; nurLokal?: boolean }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, fehler: "Der Sammlername braucht mindestens 2 Zeichen." };
  if (passwort.length < 4) return { ok: false, fehler: "Das Passwort braucht mindestens 4 Zeichen." };
  const mail = email?.trim() || null;

  if (supabaseKonfiguriert()) {
    const { data, error } = await rpcAufruf<{ token?: string; profil?: ProfileRow }>("registrieren", {
      p_name: trimmed,
      p_passwort: passwort,
      p_email: mail,
    });
    if (error) {
      if (error.code === "23505")
        return { ok: false, fehler: (error.message ?? "").includes("E-Mail")
          ? "Diese E-Mail-Adresse ist bereits hinterlegt."
          : "Diesen Sammlernamen gibt es schon – versuch einen anderen." };
      if (istNetzFehler(error))
        return { ok: false, fehler: "Keine Verbindung zur Cloud – bitte später noch einmal versuchen." };
      if (error.code === "PGRST202" || (error.message ?? "").includes("not found")) {
        /* Übergangsphase: Cloud-Funktionen noch nicht angelegt → lokales Konto (altes Verhalten). */
        const users = loadUsers();
        if (users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase()))
          return { ok: false, fehler: "Diesen Sammlernamen gibt es schon – versuch einen anderen." };
        const user: Benutzer = {
          id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmed,
          passwort: await hashPasswort(passwort),
          createdAt: Date.now(),
          statuses: {},
          beweise: {},
          favoriten: {},
          tausch: {},
        };
        const supabase = getSupabase<ProfileDb>();
        if (supabase) {
          await (supabase.from("profile") as unknown as {
            insert: (zeile: Record<string, unknown>) => PromiseLike<unknown>;
          }).insert({
            id: user.id,
            name: user.name,
            passwort: user.passwort,
            statuses: {},
            beweise: {},
            ...(favoritenUnterstuetzt ? { favoriten: {} } : {}),
            ...(tauschUnterstuetzt ? { tausch: {} } : {}),
          });
        }
        users.push(user);
        saveUsers(users);
        window.localStorage.setItem(USERID_KEY, user.id);
        emitChange();
        return { ok: true, nurLokal: true };
      }
      return { ok: false, fehler: error.message || "Das hat nicht geklappt." };
    }
    return uebernimmAnmeldung({ ok: true, token: data?.token, profil: data?.profil });
  }

  /* Ohne Supabase-Konfiguration (Demo/Lokal): altes Verhalten. */
  const users = loadUsers();
  if (users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase()))
    return { ok: false, fehler: "Diesen Sammlernamen gibt es schon – versuch einen anderen." };
  const user: Benutzer = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    passwort,
    createdAt: Date.now(),
    statuses: {},
    beweise: {},
    favoriten: {},
    tausch: {},
    supporter: false,
  };
  users.push(user);
  saveUsers(users);
  window.localStorage.setItem(SESSION_KEY, user.id);
  window.localStorage.setItem(USERID_KEY, user.id);
  emitChange();
  return { ok: true };
}

export async function login(
  name: string,
  passwort: string,
): Promise<{ ok: boolean; fehler?: string }> {
  const trimmed = name.trim();

  if (supabaseKonfiguriert()) {
    const { data, error } = await rpcAufruf<{ token?: string; profil?: ProfileRow }>("anmelden", {
      p_name: trimmed,
      p_passwort: passwort,
    });
    if (error) {
      if (error.code === "28000") return { ok: false, fehler: "Name oder Passwort stimmen nicht." };
      if (istNetzFehler(error))
        return { ok: false, fehler: "Keine Verbindung zur Cloud – bitte später noch einmal versuchen." };
      if (error.code === "PGRST202" || (error.message ?? "").includes("not found")) {
        /* Übergangsphase: Cloud-Funktionen noch nicht angelegt → alter Weg. */
        const lokal = lokalerLogin(trimmed, passwort);
        if (lokal) return { ok: true };
        return { ok: false, fehler: "Name oder Passwort stimmen nicht." };
      }
      return { ok: false, fehler: error.message || "Das hat nicht geklappt." };
    }
    const ergebnis = uebernimmAnmeldung({ ok: true, token: data?.token, profil: data?.profil });
    return ergebnis.ok ? { ok: true } : { ok: false, fehler: ergebnis.fehler };
  }

  /* Ohne Supabase-Konfiguration (Demo/Lokal): altes Verhalten. */
  return lokalerLogin(trimmed, passwort)
    ? { ok: true }
    : { ok: false, fehler: "Name oder Passwort stimmen nicht." };
}

/** Login gegen die lokale Konto-Kopie (Offline/Demo/Übergangsphase ohne Cloud-Funktionen). */
function lokalerLogin(name: string, passwort: string): boolean {
  const users = loadUsers();
  for (const u of users) {
    if (u.name.toLowerCase() !== name.toLowerCase()) continue;
    if (u.passwort === passwort) {
      window.localStorage.setItem(USERID_KEY, u.id);
      emitChange();
      return true;
    }
    return false;
  }
  return false;
}

export function logout() {
  const token = holSessionToken();
  if (token) {
    rpcAufruf("abmelden", { p_token: token }).then(() => {});
  }
  loescheSession();
  emitChange();
}

/** Eigene E-Mail lesen (Spalte ist privat – nur der Besitzer via Token). */
export async function leseEigeneEmail(): Promise<string | null> {
  const token = holSessionToken();
  if (!token) return null;
  const { data, error } = await rpcAufruf<{ email?: string } | string>("lese_eigene_email", { p_token: token });
  if (error) return null;
  if (typeof data === "string") return data;
  return data?.email ?? null;
}

/** E-Mail hinterlegen/ändern – bleibt privat und ist nicht verpflichtend. */
export async function setzeEmail(email: string): Promise<{ ok: boolean; fehler?: string }> {
  const token = holSessionToken();
  if (!token) return { ok: false, fehler: "Bitte erst anmelden." };
  const { error } = await rpcAufruf("email_setzen", { p_token: token, p_email: email.trim() });
  if (error) {
    if (error.code === "23505") return { ok: false, fehler: "Diese E-Mail-Adresse ist bereits hinterlegt." };
    if (error.code === "23514") return { ok: false, fehler: "Bitte eine gültige E-Mail-Adresse angeben." };
    if (istSessionFehler(error.code)) {
      loescheSession();
      emitChange();
      return { ok: false, fehler: "Sitzung abgelaufen – bitte neu anmelden." };
    }
    return { ok: false, fehler: error.message || "Das hat nicht geklappt." };
  }
  return { ok: true };
}

/** E-Mail entfernen (optionales Feld). */
export async function entferneEmail(): Promise<boolean> {
  const token = holSessionToken();
  if (!token) return false;
  const { error } = await rpcAufruf("email_entfernen", { p_token: token });
  return !error;
}

/** Passwort ändern: Benutzername + altes Passwort + neues Passwort (min. 4 Zeichen). */
export async function aenderePasswort(
  name: string,
  altes: string,
  neues: string,
): Promise<{ ok: boolean; fehler?: string }> {
  const token = holSessionToken();
  if (!token) return { ok: false, fehler: "Bitte erst anmelden." };
  const { error } = await rpcAufruf("passwort_aendern", {
    p_token: token,
    p_name: name.trim(),
    p_altes_passwort: altes,
    p_neues_passwort: neues,
  });
  if (error) {
    if (error.code === "28000") return { ok: false, fehler: "Das alte Passwort stimmt nicht." };
    if (error.code === "42501") return { ok: false, fehler: "Der Benutzername passt nicht zum angemeldeten Konto." };
    if (error.code === "23514") return { ok: false, fehler: "Das neue Passwort braucht mindestens 4 Zeichen." };
    if (istSessionFehler(error.code)) {
      loescheSession();
      emitChange();
      return { ok: false, fehler: "Sitzung abgelaufen – bitte neu anmelden." };
    }
    return { ok: false, fehler: error.message || "Das hat nicht geklappt." };
  }
  return { ok: true };
}

export function setStatus(blattId: string, status: Status, aktiv: boolean) {
  const users = loadUsers();
  const id = sessionNutzerId();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  const statuses = normalisiereStatuses(user.statuses);
  const eintrag = statuses[blattId] ?? [];
  const neu = aktiv
    ? [...new Set([...eintrag, status])]
    : eintrag.filter((s) => s !== status);
  if (neu.length > 0) statuses[blattId] = neu;
  else delete statuses[blattId];
  user.statuses = statuses;
  saveUsers(users);
  pushProfil(user);
}

export function setBeweis(blattId: string, wert: string | boolean | null) {
  const users = loadUsers();
  const id = sessionNutzerId();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (wert === null) {
    delete user.beweise[blattId];
    const token = holSessionToken();
    if (token) {
      rpcAufruf("beweis_loeschen", { p_token: token, p_blatt_id: blattId }).then(() => {});
    }
  } else {
    user.beweise[blattId] = wert;
  }
  saveUsers(users);
  pushProfil(user);
}

/** Speichert ein Beweisfoto in der eigenen Tabelle und setzt den dünnen Zähler-Wert.
 *  Fällt bei fehlender Tabelle (noch keine Migration) auf das alte Inline-Verhalten zurück. */
export async function speichereBeweisFoto(blattId: string, dataUrl: string) {
  const token = holSessionToken();
  if (token) {
    const { error } = await rpcAufruf("beweis_hochladen", { p_token: token, p_blatt_id: blattId, p_bild: dataUrl });
    if (!error) {
      setBeweis(blattId, true);
      return;
    }
    if (istSessionFehler(error.code)) {
      loescheSession();
      emitChange();
      return;
    }
  }
  setBeweis(blattId, dataUrl);
}

export function setFavorit(blattId: string, istFavorit: boolean) {
  const users = loadUsers();
  const id = sessionNutzerId();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (istFavorit) user.favoriten[blattId] = true;
  else delete user.favoriten[blattId];
  saveUsers(users);
  pushProfil(user);
}

export function setzeTauschInfo(blattId: string, info: TauschInfo | null) {
  const users = loadUsers();
  const id = sessionNutzerId();
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
    if (s.includes("own")) own++;
    if (s.includes("wish")) wish++;
    if (s.includes("offer")) offer++;
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