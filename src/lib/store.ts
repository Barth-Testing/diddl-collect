import { BLAETTER } from "./blaetter";
import type { Benutzer, Status } from "./types";

const USERS_KEY = "diddlcollect:benutzer";
const SESSION_KEY = "diddlcollect:session";

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
    if (!raw) {
      const seeded = seedDemoBenutzer();
      window.localStorage.setItem(USERS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as Benutzer[];
  } catch {
    return [];
  }
}

function saveUsers(users: Benutzer[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  emitChange();
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministische Demo-Sammler, damit die Rangliste lebt. */
function seedDemoBenutzer(): Benutzer[] {
  const demos: Array<{ name: string; ziel: number; beweise: number }> = [
    { name: "KnuddelmausMel", ziel: 248, beweise: 231 },
    { name: "BlattLotte", ziel: 176, beweise: 158 },
    { name: "SammelSvenja", ziel: 241, beweise: 61 },
    { name: "MiaWunschliste", ziel: 143, beweise: 143 },
    { name: "OhrwurmOtto", ziel: 128, beweise: 30 },
    { name: "PfotenPaul", ziel: 96, beweise: 96 },
    { name: "KlecksKathi", ziel: 74, beweise: 74 },
    { name: "HerzchenHanna", ziel: 52, beweise: 52 },
  ];
  return demos.map((d, di) => {
    const h = hashName(d.name);
    const statuses: Record<string, Status> = {};
    let count = 0;
    for (let i = 0; i < BLAETTER.length && count < d.ziel; i++) {
      if ((h * (i + 7) + di * 13) % 53 < 19) {
        statuses[BLAETTER[i].id] = "own";
        count++;
      }
    }
    const beweise: Record<string, string> = {};
    const owned = Object.keys(statuses);
    const versatz = h % Math.max(1, owned.length);
    for (let i = 0; i < Math.min(d.beweise, owned.length); i++) {
      beweise[owned[(i + versatz) % owned.length]] = "demo";
    }
    return {
      id: `demo-${di}`,
      name: d.name,
      passwort: "demo",
      createdAt: Date.now() - di * 86_400_000,
      demo: true,
      statuses,
      beweise,
    };
  });
}

export function listBenutzer(): Benutzer[] {
  return loadUsers();
}

export function getSession(): Benutzer | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return loadUsers().find((u) => u.id === id) ?? null;
}

export function register(name: string, passwort: string): { ok: boolean; fehler?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { ok: false, fehler: "Der Sammlername braucht mindestens 2 Zeichen." };
  if (passwort.length < 4) return { ok: false, fehler: "Das Passwort braucht mindestens 4 Zeichen." };
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
  };
  users.push(user);
  saveUsers(users);
  window.localStorage.setItem(SESSION_KEY, user.id);
  emitChange();
  return { ok: true };
}

export function login(name: string, passwort: string): { ok: boolean; fehler?: string } {
  const users = loadUsers();
  const user = users.find(
    (u) => u.name.toLowerCase() === name.trim().toLowerCase() && u.passwort === passwort,
  );
  if (!user) return { ok: false, fehler: "Name oder Passwort stimmen nicht." };
  window.localStorage.setItem(SESSION_KEY, user.id);
  emitChange();
  return { ok: true };
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
}

export function setBeweis(blattId: string, dataUrl: string | null) {
  const users = loadUsers();
  const id = window.localStorage.getItem(SESSION_KEY);
  const user = users.find((u) => u.id === id);
  if (!user) return;
  if (dataUrl === null) delete user.beweise[blattId];
  else user.beweise[blattId] = dataUrl;
  saveUsers(users);
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
  freigeschaltet: boolean;
  rang: number;
};

/**
 * Rangliste: Wer mehr als 100 eigene Blätter hat, braucht dafür bewiesene
 * Stücke (Foto-Upload), sonst bleibt der Platz hinter Rang 100.
 */
export function berechneRangliste(): RangEintrag[] {
  const users = loadUsers()
    .map((u) => ({ benutzer: u, ...zaehle(u) }))
    .sort((a, b) => b.own - a.own || a.benutzer.name.localeCompare(b.benutzer.name));
  const freigeschaltet: RangEintrag[] = [];
  const blockiert: RangEintrag[] = [];
  users.forEach((u) => {
    const frei = u.own <= 100 || u.beweise >= 100;
    const eintrag: RangEintrag = {
      ...u,
      freigeschaltet: frei,
      rang: 0,
    };
    if (frei) freigeschaltet.push(eintrag);
    else blockiert.push(eintrag);
  });
  return [...freigeschaltet, ...blockiert].map((e, i) => ({ ...e, rang: i + 1 }));
}