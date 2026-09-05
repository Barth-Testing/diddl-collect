import type { Benutzer, Status, TauschInfo } from "./types";
import { normalisiereStatuses, remappeBlattSchluessel } from "./types";
import { getSupabase, hashPasswort, rpcAufruf, supabaseKonfiguriert } from "./supabase";

const USERS_KEY = "diddlcollect:benutzer";
const SESSION_KEY = "diddlcollect:session";
const USERID_KEY = "diddlcollect:userid";
const SYNCZEIT_KEY = "diddlcollect:synczeit";
const DIRTY_KEY = "diddlcollect:dirty";
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
  blocks?: Record<string, boolean> | null;
  anzahl?: Record<string, number> | null;
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
          blocks?: Record<string, boolean>;
          anzahl?: Record<string, number>;
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
          blocks: remappeBlattSchluessel(u.blocks ?? {}),
          anzahl: remappeBlattSchluessel(u.anzahl ?? {}),
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

/* -------- "Dirty"-Tracking (pro Blatt-Schlüssel, Multi-Device-sicher) --------
   Problem: Ein Gerät mit veraltetem Cache darf beim Login/Sync NICHT die
   frischen Markierungen anderer Geräte wegwaschen. Deshalb wird pro Feld
   (statuses/beweise/favoriten/tausch) gemerkt, WELCHE Blatt-Schlüssel lokal
   wirklich geändert (und noch nicht bestätigt hochgeladen) wurden.

   Nur diese "dirty" Schlüssel gewinnen beim Merge über den Server; alle
   übrigen Schlüssel kommen unverändert vom Server. Damit ist es egal, ob ein
   anderes Gerät zwischenzeitlich etwas geändert hat – dessen Änderungen
   bleiben erhalten, nur die eigenen, gezielten Änderungen setzen sich durch. */

type DirtyFeld = "statuses" | "beweise" | "favoriten" | "tausch" | "blocks" | "anzahl";
type DirtyFelder = Record<DirtyFeld, Record<string, true>>;

const LEERES_DIRTY: DirtyFelder = { statuses: {}, beweise: {}, favoriten: {}, tausch: {}, blocks: {}, anzahl: {} };

function leseDirty(): DirtyFelder {
  if (typeof window === "undefined") return { ...LEERES_DIRTY };
  try {
    const raw = window.localStorage.getItem(DIRTY_KEY);
    if (!raw) return { ...LEERES_DIRTY };
    const parsed = JSON.parse(raw) as Partial<DirtyFelder>;
    return {
      statuses: parsed.statuses ?? {},
      beweise: parsed.beweise ?? {},
      favoriten: parsed.favoriten ?? {},
      tausch: parsed.tausch ?? {},
      blocks: parsed.blocks ?? {},
      anzahl: parsed.anzahl ?? {},
    };
  } catch {
    return { ...LEERES_DIRTY };
  }
}

function schreibeDirty(d: DirtyFelder) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DIRTY_KEY, JSON.stringify(d));
}

function markiereDirty(feld: DirtyFeld, blattId: string) {
  if (typeof window === "undefined") return;
  const d = leseDirty();
  d[feld][blattId] = true;
  schreibeDirty(d);
}

function loescheDirty() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DIRTY_KEY);
}

function hatDirty(d: DirtyFelder = leseDirty()): boolean {
  return (
    Object.keys(d.statuses).length > 0 ||
    Object.keys(d.beweise).length > 0 ||
    Object.keys(d.favoriten).length > 0 ||
    Object.keys(d.tausch).length > 0 ||
    Object.keys(d.blocks).length > 0 ||
    Object.keys(d.anzahl).length > 0
  );
}

/** Anzahl lokal geänderter, noch nicht auf den Server hochgeladener
 *  Blatt-Schlüssel – für die Sync-Anzeige (PWA). */
export function ungesicherteAenderungen(): number {
  const d = leseDirty();
  return (
    Object.keys(d.statuses).length +
    Object.keys(d.beweise).length +
    Object.keys(d.favoriten).length +
    Object.keys(d.tausch).length +
    Object.keys(d.blocks).length +
    Object.keys(d.anzahl).length
  );
}

/** Vereint EIN Feld: Server-Stand ist die Basis. Dirty Schlüssel gewinnen
 *  (lokal gesetzt oder gelöscht), alle anderen bleiben Serverseitig. */
function vereinigeFeld<T>(
  lok: Record<string, T> | null | undefined,
  server: Record<string, T> | null | undefined,
  dirty: Record<string, true> | undefined,
): Record<string, T> {
  const out: Record<string, T> = { ...(server ?? {}) };
  const l = lok ?? {};
  for (const [k, v] of Object.entries(l)) {
    if (dirty?.[k]) out[k] = v;
  }
  for (const k of Object.keys(dirty ?? {})) {
    if (!(k in l)) delete out[k];
  }
  return out;
}

/** Eigenes Konto korrekt zusammenführen: Server-Basis + gezielte lokale
 *  (dirty) Änderungen. Ist das Konto lokal unbekannt → reiner Server-Stand.
 *  `dirty` wird explizit übergeben, damit lok & dirty zum selben Zeitpunkt
 *  gelesen werden (kein Auseinanderlaufen bei asynchronen Uploads). */
function mergeEigenesKonto(lok: Benutzer | undefined, server: Benutzer, dirty: DirtyFelder): Benutzer {
  if (!lok) return server;
  return {
    ...server,
    statuses: vereinigeFeld(lok.statuses, server.statuses, dirty.statuses),
    beweise: vereinigeFeld(lok.beweise, server.beweise, dirty.beweise),
    favoriten: vereinigeFeld(lok.favoriten, server.favoriten, dirty.favoriten),
    tausch: vereinigeFeld(lok.tausch, server.tausch, dirty.tausch),
    blocks: vereinigeFeld(lok.blocks, server.blocks, dirty.blocks),
    anzahl: vereinigeFeld(lok.anzahl, server.anzahl, dirty.anzahl),
  };
}

/** Entfernt genau die übergebenen dirty-Schlüssel (nicht neu hinzugekommene),
 *  damit ein während des Uploads gesetzter neuer Eintrag nicht verloren geht. */
function entferneDirtySchluessel(d: DirtyFelder) {
  const aktuell = leseDirty();
  for (const feld of ["statuses", "beweise", "favoriten", "tausch", "blocks", "anzahl"] as DirtyFeld[]) {
    for (const k of Object.keys(d[feld])) delete aktuell[feld][k];
  }
  if (hatDirty(aktuell)) schreibeDirty(aktuell);
  else loescheDirty();
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
    blocks: remappeBlattSchluessel(zeile.blocks ?? {}),
    anzahl: remappeBlattSchluessel(zeile.anzahl ?? {}),
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
let supporterUnterstuetzt = true;
let blocksUnterstuetzt = true;
let anzahlUnterstuetzt = true;
let profilPatchUnterstuetzt = true;

/** 42501 = Spalte/Grant nicht lesbar (z. B. blocks/anzahl noch gesperrt) –
 *  genauso behandeln wie eine fehlende Spalte: Spalte aus der Abfrage nehmen
 *  und erneut versuchen, statt den ganzen Sync still platzen zu lassen. */
function istSchemaFehler(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST204" || error?.code === "42703" || error?.code === "42501";
}

/** Spaltenliste ohne die optionalen Spalten, die (noch) nicht in der DB existieren. */
function profilSpalten(): string {
  const spalten = ["id", "name", "passwort", "created_at", "statuses", "beweise"];
  if (favoritenUnterstuetzt) spalten.push("favoriten");
  if (tauschUnterstuetzt) spalten.push("tausch");
  if (blocksUnterstuetzt) spalten.push("blocks");
  if (anzahlUnterstuetzt) spalten.push("anzahl");
  if (supporterUnterstuetzt) spalten.push("supporter");
  return spalten.join(", ");
}

async function ladeProfileZeilen(): Promise<ProfileRow[] | null> {
  const supabase = getSupabase<ProfileDb>();
  if (!supabase) return null;
  const erste = await supabase.from("profile").select(profilSpalten());
  if (!erste.error && erste.data) return erste.data as unknown as ProfileRow[];
  if (istSchemaFehler(erste.error)) {
    if (supporterUnterstuetzt) {
      supporterUnterstuetzt = false;
      return ladeProfileZeilen();
    }
    if (anzahlUnterstuetzt) {
      anzahlUnterstuetzt = false;
      return ladeProfileZeilen();
    }
    if (blocksUnterstuetzt) {
      blocksUnterstuetzt = false;
      return ladeProfileZeilen();
    }
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

/** Server-Sync sofort erzwingen (ignoriert den 12h-TTL) – z. B. für die
 *  Rangliste, damit neu registrierte Konten ohne Verzögerung sichtbar sind.
 *  Merge-Logik bleibt identisch zu syncMitServer (lokale Daten gehen nicht
 *  verloren, nur das eigene Konto wird hochgeladen). */
export function erzwingeSync() {
  if (typeof window === "undefined") return;
  if (!supabaseKonfiguriert() || syncLaeuft) return;
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

/* Cross-Device-Sync: Das eigene Konto wird leichtgewichtig (eine Zeile, wenige
   KB) bei Fokus/Sichtbarkeit, bei Netz-Rückkehr und alle 20 s im sichtbaren
   Tab vom Server nachgezogen – Markierungen anderer Geräte erscheinen damit
   fast von selbst. Der schwere Voll-Sync (alle Konten, ~1 MB) bleibt für
   Start/Rangliste reserviert. */
let focusSyncEingerichtet = false;
let letzterEigenSync = 0;
const EIGEN_SYNC_MS = 15000;
function richteFocusSyncEin() {
  if (typeof window === "undefined" || focusSyncEingerichtet) return;
  focusSyncEingerichtet = true;
  const beiSichtbar = () => {
    void syncEigenesKonto(true);
  };
  window.addEventListener("focus", beiSichtbar);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") beiSichtbar();
  });
  window.addEventListener("online", beiSichtbar);
  window.setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void syncEigenesKonto(false);
  }, 20000);
  /* PWA-Handy: vor dem Schließen/Weglegen noch best-effort hochladen – iOS
     friert die App sonst ggf. vor dem nächsten Upload-Zyklus ein. */
  const beiVersteckt = () => {
    void pushProfil();
  };
  window.addEventListener("pagehide", beiVersteckt);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") beiVersteckt();
  });
}
richteFocusSyncEin();
erzwingeSync();
void syncEigenesKonto(true);

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
    /* Eigenes Konto: gezielte (dirty) lokale Änderungen gewinnen, Rest kommt
       vom Server. Andere Konten sind reine Spiegel → Server gewinnt immer. */
    const istEigen = zeile.id === sessionNutzerId();
    const gemergt = istEigen ? mergeEigenesKonto(lok, server, leseDirty()) : server;
    ergebnis.set(zeile.id, gemergt);
    geaendert = true;
    /* Lokale (dirty) Änderungen des eigenen Kontos zum Server nachziehen. */
    if (istEigen && hatDirty()) {
      pushProfil();
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
    if ((await pushProfil()) === false) ergebnis.delete(id);
  }

  if (geaendert) saveUsers([...ergebnis.values()]);
  window.localStorage.setItem(SYNCZEIT_KEY, String(Date.now()));
}

/** Eigene Profil-Zeile frisch vom Server holen (nur dieses Konto, klein). */
async function ladeEigeneZeile(id: string): Promise<ProfileRow | null> {
  const supabase = getSupabase<ProfileDb>();
  if (!supabase) return null;
  const erste = await supabase
    .from("profile")
    .select(profilSpalten())
    .eq("id", id)
    .maybeSingle();
  if (!erste.error && erste.data) return erste.data as unknown as ProfileRow;
  if (istSchemaFehler(erste.error)) {
    if (supporterUnterstuetzt) {
      supporterUnterstuetzt = false;
      return ladeEigeneZeile(id);
    }
    if (anzahlUnterstuetzt) {
      anzahlUnterstuetzt = false;
      return ladeEigeneZeile(id);
    }
    if (blocksUnterstuetzt) {
      blocksUnterstuetzt = false;
      return ladeEigeneZeile(id);
    }
    if (tauschUnterstuetzt) {
      tauschUnterstuetzt = false;
      return ladeEigeneZeile(id);
    }
    if (favoritenUnterstuetzt) {
      favoritenUnterstuetzt = false;
      return ladeEigeneZeile(id);
    }
  }
  return null;
}

/** Uploads serialisieren – nie laufen zwei RPCs mit unterschiedlichen
 *  Snapshots parallel, sodass der neueste lokale Stand gewinnt. */
let uploadKette: Promise<void> = Promise.resolve();

/** Teilt EIN Feld anhand der dirty-Schlüssel in "setzen" und "löschen".
 *  Nur diese Schlüssel verlassen das Gerät – der Server wendet sie atomar an. */
function teileFeld<T>(lokFeld: Record<string, T> | null | undefined, schluessel: Record<string, true>) {
  const setzen: Record<string, T> = {};
  const loeschen: string[] = [];
  const l = lokFeld ?? {};
  for (const k of Object.keys(schluessel)) {
    if (k in l) setzen[k] = l[k];
    else loeschen.push(k);
  }
  return { setzen, loeschen };
}

/** Server-Stand des eigenen Kontos in den Cache übernehmen (ohne lokale,
 *  noch unbestätigte Änderungen zu verlieren). Schreibt nur bei echter
 *  Änderung, damit Polling keine Render-Schleifen auslöst. */
function schreibeEigenesKontoInCache(server: Benutzer) {
  if (typeof window === "undefined") return;
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === server.id);
  const lokNeu = idx >= 0 ? users[idx] : undefined;
  if (!server.passwort && lokNeu?.passwort) server.passwort = lokNeu.passwort;
  const gemergt = mergeEigenesKonto(lokNeu, server, leseDirty());
  if (lokNeu?.supporter) gemergt.supporter = true;
  if (idx >= 0 && JSON.stringify(users[idx]) === JSON.stringify(gemergt)) return;
  if (idx >= 0) users[idx] = gemergt;
  else users.push(gemergt);
  saveUsers(users);
}

/** Profil-JSON (ohne Passwort, z. B. aus profil_patch/anmelden) mit dem
 *  lokalen Passwort zu einem Benutzer ergänzen. */
function benutzerAusProfilJson(profil: ProfileRow, fallbackPasswort: string, supporterAlt?: boolean): Benutzer {
  const b = zeileZuBenutzer({ ...profil, passwort: fallbackPasswort });
  if (supporterAlt) b.supporter = true;
  return b;
}

/** Die eigene Sammlung serverseitig sichern – via Session-Token (RPC).
 *  Bevorzugt den atomaren Teil-Patch (profil_patch): nur dirty Schlüssel
 *  werden gesendet und serverseitig in EINEM Update angewendet – zwei Geräte
 *  mit unterschiedlichen Schlüsseln überschreiben sich damit nie mehr.
 *  Fehlt die Funktion (SQL noch nicht ausgeführt, PGRST202/42703), fällt der
 *  Upload auf den bisherigen Komplett-Abgleich (profil_schreiben) zurück.
 *  Uploads laufen serialisiert (Mutex). Bei Erfolg wird der Cache auf den
 *  Server-Stand gebracht und dirty zurückgesetzt. */
function pushProfil(): Promise<boolean> {
  const token = holSessionToken();
  if (!token) return Promise.resolve(true);
  const id = sessionNutzerId();
  if (!id) return Promise.resolve(true);
  const letzter = uploadKette.then(async () => {
    const lok = loadUsers().find((u) => u.id === id);
    if (!lok) return;
    /* lok UND dirty zum selben Zeitpunkt lesen – so bleibt der Upload auch bei
       parallel eintreffenden neuen Markierungen konsistent. */
    const dirty = leseDirty();
    const dirtyLeer =
      Object.keys(dirty.statuses).length === 0 &&
      Object.keys(dirty.beweise).length === 0 &&
      Object.keys(dirty.favoriten).length === 0 &&
      Object.keys(dirty.tausch).length === 0 &&
      Object.keys(dirty.blocks).length === 0 &&
      Object.keys(dirty.anzahl).length === 0;
    if (dirtyLeer) return;
    if (profilPatchUnterstuetzt) {
      const s = teileFeld(lok.statuses, dirty.statuses);
      const bw = teileFeld(lok.beweise, dirty.beweise);
      const f = teileFeld(lok.favoriten, dirty.favoriten);
      const t = teileFeld(lok.tausch, dirty.tausch);
      const bl = teileFeld(lok.blocks, dirty.blocks);
      const az = teileFeld(lok.anzahl, dirty.anzahl);
      for (let versuch = 0; versuch < 3; versuch++) {
        const { data, error } = await rpcAufruf<{ profil?: ProfileRow }>("profil_patch", {
          p_token: token,
          p_statuses: s.setzen,
          p_statuses_loesch: s.loeschen,
          p_beweise: bw.setzen,
          p_beweise_loesch: bw.loeschen,
          p_favoriten: f.setzen,
          p_favoriten_loesch: f.loeschen,
          p_tausch: t.setzen,
          p_tausch_loesch: t.loeschen,
          p_blocks: bl.setzen,
          p_blocks_loesch: bl.loeschen,
          p_anzahl: az.setzen,
          p_anzahl_loesch: az.loeschen,
        });
        if (!error) {
          entferneDirtySchluessel(dirty);
          if (data?.profil) {
            schreibeEigenesKontoInCache(
              benutzerAusProfilJson(data.profil, lok.passwort, lok.supporter === true),
            );
          }
          return;
        }
        if (istSessionFehler(error.code)) {
          loescheSession();
          emitChange();
          return;
        }
        if (error.code === "PGRST202" || error.code === "42703" || (error.message ?? "").includes("not found")) {
          profilPatchUnterstuetzt = false;
          break;
        }
        if (versuch < 2) await new Promise((r) => setTimeout(r, 800));
      }
      if (profilPatchUnterstuetzt) return;
    }
    const server = await ladeEigeneZeile(id);
    const senden: Benutzer = server ? mergeEigenesKonto(lok, zeileZuBenutzer(server), dirty) : lok;
    /* Neuere Spalten erst senden, wenn die SQL-Funktion sie kennt – sonst
       PGRST202 und Fallback auf die alte Signatur. */
    const mitZusatz = blocksUnterstuetzt && anzahlUnterstuetzt;
    for (let versuch = 0; versuch < 3; versuch++) {
      const { error } = await rpcAufruf("profil_schreiben", {
        p_token: token,
        p_statuses: senden.statuses,
        p_beweise: senden.beweise,
        p_favoriten: senden.favoriten,
        p_tausch: senden.tausch,
        ...(mitZusatz ? { p_blocks: senden.blocks, p_anzahl: senden.anzahl } : {}),
      });
      if (!error) {
        entferneDirtySchluessel(dirty);
        schreibeEigenesKontoInCache(senden);
        return;
      }
      if (istSessionFehler(error.code)) {
        loescheSession();
        emitChange();
        return;
      }
      if ((error.code === "PGRST202" || (error.message ?? "").includes("not found")) && mitZusatz) {
        blocksUnterstuetzt = false;
        anzahlUnterstuetzt = false;
        continue;
      }
      if (versuch < 2) await new Promise((r) => setTimeout(r, 800));
    }
  });
  uploadKette = letzter.catch(() => {});
  return letzter.then(() => true);
}

/** Leichtgewichtiger Eigen-Sync (eine Zeile, wenige KB): erst anstehende
 *  eigene Änderungen hochladen, dann den Server-Stand des eigenen Kontos
 *  nachziehen. Wird bei Fokus/Sichtbarkeit, Netz-Rückkehr und alle 20 s im
 *  sichtbaren Tab aufgerufen – fremde Geräte-Änderungen erscheinen damit
 *  automatisch, ohne manuellen Refresh oder Neuanmeldung. */
async function syncEigenesKonto(erzwingen = false): Promise<void> {
  if (typeof window === "undefined") return;
  const id = sessionNutzerId();
  const token = holSessionToken();
  if (!id || !token || !supabaseKonfiguriert()) return;
  if (!erzwingen && Date.now() - letzterEigenSync < EIGEN_SYNC_MS) return;
  letzterEigenSync = Date.now();
  try {
    if (hatDirty()) await pushProfil();
    const zeile = await ladeEigeneZeile(id);
    if (!zeile) return;
    schreibeEigenesKontoInCache(zeileZuBenutzer(zeile));
  } catch {
    /* Best-effort – der nächste Zyklus versucht es erneut. */
  }
}

export function listBenutzer(): Benutzer[] {
  starteSync();
  return loadUsers();
}

/** Leichter Supporter-Abgleich (~200 Bytes): holt nur die Spender-Markierungen
 *  und merkt sie im Cache – unabhängig vom 12h-Sync-Fenster. No-op, solange
 *  die Spalte (noch) nicht existiert. */
export async function aktualisiereSupporter(): Promise<void> {
  const supabase = getSupabase<ProfileDb>();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("profile")
    .select("id, supporter")
    .eq("supporter", true);
  if (error || !data || data.length === 0) return;
  const users = loadUsers();
  const vorhanden = new Map(users.map((u) => [u.id, u]));
  let geaendert = false;
  for (const reihe of data as unknown as { id: string }[]) {
    const user = vorhanden.get(reihe.id);
    if (user && !user.supporter) {
      user.supporter = true;
      geaendert = true;
    }
  }
  if (geaendert) saveUsers(users);
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

/** Anmelde-Ergebnis in die Ladensicht übernehmen (Token + Profil in Cache).
 *  WICHTIG: Der Server-Stand ersetzt den lokalen Cache NICHT blind. Lokale
 *  Änderungen, die mangels Session noch nicht auf den Server gelangt sind
 *  (z. B. vor einer Abmeldung gesammelte Blätter), werden mit dem Server-Stand
 *  gemergt und danach wieder hochgeladen – sonst geht eine offline gepflegte
 *  Galerie bei erneutem Login verloren. */
function uebernimmAnmeldung(ergebnis: KontoAntwort): { ok: boolean; fehler?: string; nurLokal?: boolean } {
  if (!ergebnis.ok || !ergebnis.token || !ergebnis.profil) {
    return { ok: false, fehler: ergebnis.fehler ?? "Das hat nicht geklappt – schau später noch einmal vorbei." };
  }
  const server = zeileZuBenutzer(ergebnis.profil);
  const lok = loadUsers().find((u) => u.id === server.id);
  /* Server ist die Basis; nur gezielte lokale (dirty) Änderungen gewinnen.
     Ein veralteter Cache verliert dagegen korrekt gegen den Server – sonst
     wäscht ein zweites Gerät beim Login frische Markierungen weg. */
  const benutzer: Benutzer = mergeEigenesKonto(lok, server, leseDirty());
  if (lok?.supporter) benutzer.supporter = true;
  const rest = loadUsers().filter((u) => u.id !== benutzer.id);
  saveUsers([...rest, benutzer]);
  setzeSession(ergebnis.token, benutzer.id);
  /* Nur hochladen, wenn es wirklich lokale (dirty) Änderungen nachzuziehen
     gibt; ansonsten ist der Server-Stand bereits die Quelle der Wahrheit. */
  if (hatDirty()) void pushProfil();
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
  if (!/[\p{L}\p{N}]$/u.test(trimmed))
    return { ok: false, fehler: "Der Sammlername darf nicht mit einem Sonderzeichen enden." };
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
        if (users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase() || u.name.toLowerCase().replace(/\.+$/, "") === trimmed.toLowerCase().replace(/\.+$/, "")))
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
          blocks: {},
          anzahl: {},
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
            ...(blocksUnterstuetzt ? { blocks: {} } : {}),
            ...(anzahlUnterstuetzt ? { anzahl: {} } : {}),
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
  if (users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase() || u.name.toLowerCase().replace(/\.+$/, "") === trimmed.toLowerCase().replace(/\.+$/, "")))
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
    blocks: {},
    anzahl: {},
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
  markiereDirty("statuses", blattId);
  pushProfil();
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
  markiereDirty("beweise", blattId);
  pushProfil();
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
  markiereDirty("favoriten", blattId);
  pushProfil();
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
  markiereDirty("tausch", blattId);
  pushProfil();
}

/** "Block besessen" je Blatt setzen/entfernen (besonderer Rahmen in der Karte). */
export function setBlock(blattId: string, hatBlock: boolean) {
  const users = loadUsers();
  const id = sessionNutzerId();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (!user.blocks) user.blocks = {};
  if (hatBlock) user.blocks[blattId] = true;
  else delete user.blocks[blattId];
  saveUsers(users);
  markiereDirty("blocks", blattId);
  pushProfil();
}

/** Stückzahl je Blatt erhöhen/verringern (Minimum 1 = kein Eintrag nötig). */
export function setAnzahlDelta(blattId: string, delta: number) {
  const users = loadUsers();
  const id = sessionNutzerId();
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (!user.anzahl) user.anzahl = {};
  const bisher = user.anzahl[blattId] ?? 1;
  const neu = Math.max(1, Math.min(99, bisher + delta));
  if (neu <= 1) delete user.anzahl[blattId];
  else user.anzahl[blattId] = neu;
  saveUsers(users);
  markiereDirty("anzahl", blattId);
  pushProfil();
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