import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseKonfiguriert() {
  return Boolean(url && anonKey);
}

let client: SupabaseClient<unknown> | null = null;

export function getSupabase<T>() {
  if (!supabaseKonfiguriert()) return null;
  if (!client) {
    client = createClient<T>(url!, anonKey!, {
      realtime: { params: { eventsPerSecond: 2 } },
    }) as unknown as SupabaseClient<unknown>;
  }
  return client as unknown as SupabaseClient<T>;
}

/** Passwort als SHA-256-Hash (kein Klartext auf dem Server). */
export async function hashPasswort(passwort: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return passwort;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passwort));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function istHash(wert: string) {
  return /^[0-9a-f]{64}$/.test(wert);
}
