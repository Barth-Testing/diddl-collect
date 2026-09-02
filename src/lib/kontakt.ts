import { getSupabase, rpcAufruf, supabaseKonfiguriert } from "./supabase";

export const ADMIN_NAME = "malarky";

export type KontaktReihe = {
  id: number;
  name: string;
  email: string | null;
  betreff: string | null;
  text: string;
  erstellt_am: string;
};

type Db = {
  public: {
    Tables: {
      kontakt: { Row: KontaktReihe };
    };
  };
};

export function kontaktKonfiguriert() {
  return supabaseKonfiguriert();
}

/** Nachricht an den Betreiber senden (kein Login nötig). */
export async function kontaktSenden(
  name: string,
  email: string,
  betreff: string,
  text: string,
): Promise<{ ok: boolean; fehler?: string }> {
  const { error } = await rpcAufruf("kontakt_senden", {
    p_name: name,
    p_email: email,
    p_betreff: betreff || null,
    p_text: text,
  });
  if (error) {
    if (error.code === "PGRST202") {
      return { ok: false, fehler: "Kontakt ist noch nicht eingerichtet." };
    }
    return { ok: false, fehler: error.message ?? "Das hat nicht geklappt." };
  }
  return { ok: true, fehler: undefined };
}

/** Eingehende Kontaktanfragen laden (nur Betreiber nutzt das). */
export async function ladeKontakt(): Promise<KontaktReihe[]> {
  const supabase = getSupabase<Db>();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("kontakt")
    .select("id, name, email, betreff, text, erstellt_am")
    .order("erstellt_am", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data as KontaktReihe[]) ?? [];
}

/** Kontaktanfrage löschen (Betreiber). */
export async function kontaktLoeschen(id: number): Promise<void> {
  await rpcAufruf("kontakt_loeschen", { p_id: id });
}
