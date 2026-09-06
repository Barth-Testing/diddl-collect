import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

type BeweisFotoReihe = {
  profil_id: string;
  blatt_id: string;
  bild: string;
};

type Db = {
  public: {
    Tables: {
      beweis_fotos: {
        Row: BeweisFotoReihe;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

/** Beweisfotos NACH BEDARF laden (nur die übergebenen Blatt-IDs, max. ~60 pro
 *  Abruf) – ein Profil mit vielen Beweisen lädt nicht mehr beim Öffnen mehrere
 *  MB, sondern erst, wenn der „Beweise“-Tab angesehen wird. */
export async function ladeBeweisFotos(
  profilId: string,
  blattIds?: string[],
): Promise<Record<string, string>> {
  const supabase = getSupabase<Db>();
  if (!supabase) return {};
  return ladeVia(supabase, profilId, blattIds);
}

async function ladeVia(
  supabase: SupabaseClient<Db>,
  profilId: string,
  blattIds?: string[],
): Promise<Record<string, string>> {
  let abfrage = supabase.from("beweis_fotos").select("blatt_id, bild").eq("profil_id", profilId);
  if (blattIds && blattIds.length > 0) {
    abfrage = abfrage.in("blatt_id", blattIds);
  }
  const { data, error } = await abfrage;
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const reihe of data) out[reihe.blatt_id] = reihe.bild;
  return out;
}
