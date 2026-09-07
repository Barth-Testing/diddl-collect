import { getSupabase, rpcAufruf } from "./supabase";
import { holSessionToken, logout } from "./store";

export type Hinweis = {
  text: string;
  link: string | null;
  aktiv: boolean;
};

type HinweisReihe = {
  text: string;
  link: string | null;
  aktiv: boolean;
};

type Db = {
  public: {
    Tables: {
      hinweis: { Row: HinweisReihe };
    };
  };
};

const HINWEIS_KEY = "diddlcollect:hinweis";
const HINWEIS_MS = 10 * 60 * 1000;

type Spiegel = { hinweis: Hinweis | null; ts: number };

let hinweisFehlt = false;

function leseSpiegel(): Spiegel {
  if (typeof window === "undefined") return { hinweis: null, ts: 0 };
  try {
    const roh = JSON.parse(window.localStorage.getItem(HINWEIS_KEY) ?? "{}") as Partial<Spiegel>;
    return {
      hinweis: roh.hinweis && typeof roh.hinweis.text === "string" ? roh.hinweis : null,
      ts: typeof roh.ts === "number" ? roh.ts : 0,
    };
  } catch {
    return { hinweis: null, ts: 0 };
  }
}

function speichereSpiegel(hinweis: Hinweis | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HINWEIS_KEY, JSON.stringify({ hinweis, ts: Date.now() }));
}

function istStrukturFehlt(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    error?.code === "42703" ||
    (error?.message ?? "").includes("not found")
  );
}

export async function ladeHinweis(neu = false): Promise<Hinweis | null> {
  const spiegel = leseSpiegel();
  if (!neu && spiegel.ts > 0 && Date.now() - spiegel.ts < HINWEIS_MS) return spiegel.hinweis;
  if (!neu && hinweisFehlt) return spiegel.hinweis;
  const supabase = getSupabase<Db>();
  if (!supabase) return spiegel.hinweis;
  const { data, error } = await supabase
    .from("hinweis")
    .select("text, link, aktiv")
    .eq("id", 1)
    .maybeSingle();
  if (!error && data) {
    const reihe = data as unknown as HinweisReihe;
    const hinweis: Hinweis = {
      text: String(reihe.text ?? ""),
      link: reihe.link ?? null,
      aktiv: reihe.aktiv === true,
    };
    speichereSpiegel(hinweis);
    return hinweis;
  }
  if (error && istStrukturFehlt(error)) hinweisFehlt = true;
  speichereSpiegel(spiegel.hinweis);
  return spiegel.hinweis;
}

export async function speichereHinweis(
  text: string,
  link: string | null,
  aktiv: boolean,
): Promise<{ ok: boolean; fehler?: string }> {
  const token = holSessionToken();
  if (!token) {
    return { ok: false, fehler: "Bitte einmal neu anmelden, dann klappt das Speichern." };
  }
  const { error } = await rpcAufruf("hinweis_setzen", {
    p_token: token,
    p_text: text,
    p_link: link,
    p_aktiv: aktiv,
  });
  if (!error) {
    const hinweis: Hinweis = { text, link, aktiv };
    speichereSpiegel(hinweis);
    return { ok: true, fehler: undefined };
  }
  if (error.code === "PGRST202") {
    return { ok: false, fehler: "Hinweis ist noch nicht eingerichtet – bitte später erneut versuchen." };
  }
  if (error.code === "28000") {
    logout();
    return { ok: false, fehler: "Sitzung abgelaufen – bitte neu anmelden." };
  }
  return { ok: false, fehler: error.message || "Das hat nicht geklappt." };
}
