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

export async function ladeBeweisFotos(profilId: string): Promise<Record<string, string>> {
  const supabase = getSupabase<Db>();
  if (!supabase) return {};
  return ladeVia(supabase, profilId);
}

async function ladeVia(supabase: SupabaseClient<Db>, profilId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("beweis_fotos")
    .select("blatt_id, bild")
    .eq("profil_id", profilId);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const reihe of data) out[reihe.blatt_id] = reihe.bild;
  return out;
}
