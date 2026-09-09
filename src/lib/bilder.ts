import { getSession, holSessionToken, speichereBeweisFoto } from "./store";
import { istAdmin } from "./kontakt";
import { getSupabase, rpcAufruf } from "./supabase";

/** Bild-URLs: Die DB-Spalten (news.bild/bild2, beweis_fotos.bild) verstehen
 *  zwei Formate – alte base64-Data-URLs und neue öffentliche Storage-URLs.
 *  Alte App-Versionen zeigen https-URLs ohne Update an; neue zeigen beides. */

export const NEWS_BUCKET = "news-bilder";
export const BEWEIS_BUCKET = "beweis-fotos";

export function istDatenUrl(wert: unknown): wert is string {
  return typeof wert === "string" && wert.startsWith("data:image/");
}

export function istHttpUrl(wert: unknown): wert is string {
  return (
    typeof wert === "string" && (wert.startsWith("https://") || wert.startsWith("http://"))
  );
}

/** Anzeigefähige Bildquelle: Data-URL (alt) und https-URL (neu) direkt;
 *  nackte Storage-Pfade defensiv über getPublicUrl auflösen. */
export function bildUrl(wert: unknown, bucket: string): string {
  if (istDatenUrl(wert) || istHttpUrl(wert)) return wert;
  if (typeof wert !== "string" || !wert) return "";
  try {
    const s = getSupabase();
    const o = s?.storage.from(bucket).getPublicUrl(wert);
    return o?.data?.publicUrl ?? "";
  } catch {
    return "";
  }
}

export type Komprimat = { blob: Blob; endung: "webp" | "jpg" };

/** Bilddatei auf Kantenlänge schrumpfen und als WebP ausgeben (fällt auf
 *  JPEG zurück, wenn der Browser kein WebP schreibt). Weißer Hintergrund,
 *  damit transparente PNGs nicht schwarz werden. */
export function komprimiereBild(datei: Blob, max: number, qualitaet: number): Promise<Komprimat | null> {
  return new Promise((resolve) => {
    const leser = new FileReader();
    leser.onerror = () => resolve(null);
    leser.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const skala = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * skala));
        canvas.height = Math.max(1, Math.round(img.height * skala));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve({ blob: b, endung: "webp" });
              return;
            }
            canvas.toBlob(
              (j) => resolve(j ? { blob: j, endung: "jpg" } : null),
              "image/jpeg",
              qualitaet,
            );
          },
          "image/webp",
          qualitaet,
        );
      };
      img.src = leser.result as string;
    };
    leser.readAsDataURL(datei);
  });
}

export async function datenUrlZuBlob(datenUrl: string): Promise<Blob | null> {
  try {
    const antwort = await fetch(datenUrl);
    const blob = await antwort.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

export function zufallsName(prefix: string, endung: string): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${endung}`;
}

/** Datei in den Storage-Bucket legen, öffentliche https-URL zurück (null bei
 *  Fehler – z. B. SQL/Bucket noch nicht eingerichtet → Aufrufer nimmt dann
 *  den alten Data-URL-Weg, Deploy-Reihenfolge egal). */
export async function ladeBildHoch(bucket: string, pfad: string, blob: Blob): Promise<string | null> {
  try {
    const s = getSupabase();
    if (!s) return null;
    const { error } = await s.storage.from(bucket).upload(pfad, blob, {
      contentType: blob.type || "image/webp",
      upsert: false,
    });
    if (error) return null;
    const { data } = s.storage.from(bucket).getPublicUrl(pfad);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

const MIGRIERT_KEY = "diddlcollect:bildmigriert";

function migriertLesen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const roh = JSON.parse(window.localStorage.getItem(MIGRIERT_KEY) ?? "[]") as unknown;
    return Array.isArray(roh) ? roh.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function migrationVersucht(schluessel: string): boolean {
  return migriertLesen().includes(schluessel);
}

function migrationMerken(schluessel: string) {
  if (typeof window === "undefined") return;
  try {
    const liste = migriertLesen();
    if (liste.includes(schluessel)) return;
    window.localStorage.setItem(MIGRIERT_KEY, JSON.stringify([...liste, schluessel].slice(-500)));
  } catch {
    /* Quota voll – Migration wird später erneut versucht, harmlos. */
  }
}

/** Markierung zurücknehmen (z. B. SQL/Bucket fehlt noch) – nächster Besuch
 *  versucht es erneut statt nie. */
function migrationVergessen(schluessel: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MIGRIERT_KEY,
      JSON.stringify(migriertLesen().filter((x) => x !== schluessel)),
    );
  } catch {
    /* Harmlos – nächster Versuch kommt ohnehin. */
  }
}

/** News-Alt-Bild (data:) still auf Storage umziehen. Lösen nur Admin-Geräte
 *  aus (Server prüft erneut); pro Bild ein Versuch je Gerät. */
export function versucheNewsMigration(
  newsId: number,
  feld: "bild" | "bild2",
  datenUrl: string,
  beiUrl?: (url: string) => void,
): void {
  if (!istDatenUrl(datenUrl)) return;
  const schluessel = `news:${newsId}:${feld}`;
  if (migrationVersucht(schluessel)) return;
  const ich = getSession();
  const token = holSessionToken();
  if (!ich || !token || !istAdmin(ich.name)) return;
  migrationMerken(schluessel);
  void (async () => {
    const roh = await datenUrlZuBlob(datenUrl);
    if (!roh) return;
    const komprimat = await komprimiereBild(roh, 640, 0.7);
    const blob = komprimat?.blob ?? roh;
    const endung = komprimat?.endung ?? "jpg";
    const url = await ladeBildHoch(NEWS_BUCKET, zufallsName("news/", endung), blob);
    if (!url) {
      migrationVergessen(schluessel);
      return;
    }
    const { error } = await rpcAufruf("news_bild_migrieren", {
      p_token: token,
      p_news_id: newsId,
      p_feld: feld,
      p_url: url,
    });
    /* PGRST202 = SQL noch nicht eingespielt → Markierung zurück, später erneut. */
    if (error?.code === "PGRST202" || (error?.message ?? "").includes("not found")) {
      migrationVergessen(schluessel);
      return;
    }
    if (!error && beiUrl) beiUrl(url);
  })();
}

/** Eigenes Beweis-Alt-Bild (data:) still auf Storage umziehen (Besitzer-Token;
 *  beweis_hochladen ersetzt dieselbe Zeile – wie ein erneuter Upload). */
export function versucheBeweisMigration(
  profilId: string,
  blattId: string,
  datenUrl: string,
  beiUrl?: (url: string) => void,
): void {
  if (!istDatenUrl(datenUrl)) return;
  const schluessel = `beweis:${profilId}:${blattId}`;
  if (migrationVersucht(schluessel)) return;
  const ich = getSession();
  if (!ich || ich.id !== profilId || !holSessionToken()) return;
  migrationMerken(schluessel);
  void (async () => {
    const roh = await datenUrlZuBlob(datenUrl);
    if (!roh) return;
    const komprimat = await komprimiereBild(roh, 320, 0.6);
    const blob = komprimat?.blob ?? roh;
    const endung = komprimat?.endung ?? "jpg";
    const url = await ladeBildHoch(
      BEWEIS_BUCKET,
      `${profilId}/${blattId}-${Date.now()}.${endung}`,
      blob,
    );
    if (!url) {
      migrationVergessen(schluessel);
      return;
    }
    await speichereBeweisFoto(blattId, url);
    if (beiUrl) beiUrl(url);
  })();
}
