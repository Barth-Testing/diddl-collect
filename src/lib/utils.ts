import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Öffentlicher Galerie-Link zu einem Sammlerprofil.
 *  Robust gegen Namen-Kollisionen: Namen, die sich nur durch ein abschließendes
 *  Satzzeichen unterscheiden (z. B. "Alina" vs. "alina."), sind getrennte
 *  Konten und dürfen beim Anzeigen nie verwechselt werden. Deshalb wird die
 *  eindeutige Konten-ID mit übergeben (Lookup bevorzugt sie) und der Name dient
 *  nur als lesbares Anhängen/Fallback. Zusätzlich sitzt der abschließende Punkt
 *  nie am URL-Ende (Trailing-Param), damit ihn kein Messenger als Satzzeichen
 *  abschneidet. */
export function sammlerLink(id: string, name: string): string {
  return `${window.location.origin}/sammler?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&ht=1`;
}

/** Kopiert Text in die Zwischenablage – mit Fallback für Browser ohne
 *  Clipboard-Berechtigung (versteckte Textarea + execCommand). */
export async function kopiereText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}