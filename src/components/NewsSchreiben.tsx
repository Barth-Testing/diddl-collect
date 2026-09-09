"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Megaphone, Send, X } from "lucide-react";
import { getSession, holSessionToken, logout } from "@/lib/store";
import { rpcAufruf } from "@/lib/supabase";
import { NEWS_BUCKET, komprimiereBild, ladeBildHoch, zufallsName } from "@/lib/bilder";
import { istAdmin } from "@/lib/kontakt";
import { loescheNeuigkeitenCache } from "./Neuigkeiten";
import { cn } from "@/lib/utils";

const TITEL_MAX = 120;
const TEXT_MAX = 1000;

export function NewsSchreiben() {
  const ich = getSession();
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [bild, setBild] = useState<string | null>(null);
  const [datei, setDatei] = useState<File | null>(null);
  const [sendet, setSendet] = useState(false);
  const [erfolg, setErfolg] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);

  if (!ich || !istAdmin(ich.name)) return null;

  function dateiGewaehlt(dateiNeu: File | undefined) {
    setFehler(null);
    if (!dateiNeu) return;
    if (!dateiNeu.type.startsWith("image/")) {
      setFehler("Bitte ein Bild (JPG/PNG) auswählen.");
      return;
    }
    setDatei(dateiNeu);
    const leser = new FileReader();
    leser.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 640;
        const skala = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * skala);
        canvas.height = Math.round(img.height * skala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setBild(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = leser.result as string;
    };
    leser.readAsDataURL(dateiNeu);
  }

  function normalisiereLink(wert: string): string | null {
    const sauber = wert.trim();
    if (!sauber) return null;
    return /:\/\//.test(sauber) ? sauber : `https://${sauber}`;
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (sendet) return;
    setFehler(null);
    setErfolg(false);
    if (titel.trim().length < 1 || titel.trim().length > TITEL_MAX) {
      setFehler(`Der Titel braucht 1 bis ${TITEL_MAX} Zeichen.`);
      return;
    }
    if (text.trim().length < 1 || text.trim().length > TEXT_MAX) {
      setFehler(`Der Text braucht 1 bis ${TEXT_MAX} Zeichen.`);
      return;
    }
    const token = holSessionToken();
    if (!token) {
      setFehler("Bitte einmal neu anmelden, dann klappt das Schreiben.");
      return;
    }
    setSendet(true);
    /* Storage-first: Bild als WebP in den Bucket legen, nur die URL geht in
       die DB (Egress-Diät). Scheitert der Upload (SQL/Bucket fehlt o. ä.),
       fällt der Aufruf still auf die alte Data-URL zurück. */
    let bildWert: string | null = bild;
    if (bild && datei) {
      const komprimat = await komprimiereBild(datei, 640, 0.7);
      if (komprimat) {
        const url = await ladeBildHoch(NEWS_BUCKET, zufallsName("news/", komprimat.endung), komprimat.blob);
        if (url) bildWert = url;
      }
    }
    const { error } = await rpcAufruf("news_schreiben", {
      p_token: token,
      p_titel: titel.trim(),
      p_text: text.trim(),
      p_bild: bildWert,
      p_link: normalisiereLink(link),
    });
    setSendet(false);
    if (!error) {
      setTitel("");
      setText("");
      setLink("");
      setBild(null);
      setDatei(null);
      setErfolg(true);
      loescheNeuigkeitenCache();
      return;
    }
    if (error.code === "PGRST202") {
      setFehler("News-Schreiben ist noch nicht eingerichtet – bitte später erneut versuchen.");
      return;
    }
    if (error.code === "28000") {
      logout();
      setFehler("Sitzung abgelaufen – bitte neu anmelden.");
      return;
    }
    setFehler(error.message || "Das hat nicht geklappt.");
  }

  return (
    <div className="card-soft p-5">
      <h3 className="font-display flex items-center gap-2 text-lg font-bold text-ink-800">
        <Megaphone className="h-5 w-5 text-candy-500" />
        Neuigkeit schreiben
      </h3>
      <p className="mt-1 text-xs font-semibold text-ink-600">
        Erscheint direkt auf der Startseite für die ganze Sammelgemeinde.
      </p>
      <form onSubmit={(e) => void absenden(e)} className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-700">
            Titel ({titel.trim().length}/{TITEL_MAX})
          </span>
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value.slice(0, TITEL_MAX))}
            placeholder="z. B. Neue Blätter im Expert-Markt"
            className="w-full rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-700">
            Text ({text.trim().length}/{TEXT_MAX})
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
            rows={4}
            placeholder="Was gibt es Neues für die Gemeinde?"
            className="w-full resize-y rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-bold text-ink-700">Bild (optional)</span>
          <input
            ref={dateiRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              dateiGewaehlt(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {bild ? (
            <div className="relative w-fit">
              <img
                src={bild}
                alt="Vorschau"
                className="max-h-48 rounded-xl object-contain ring-1 ring-cream-200"
              />
              <button
                type="button"
                onClick={() => {
                  setBild(null);
                  setDatei(null);
                }}
                aria-label="Bild entfernen"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-peach-400 text-white shadow hover:bg-peach-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => dateiRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink-700 ring-1 ring-cream-300 hover:bg-candy-100 hover:ring-candy-300"
            >
              <ImagePlus className="h-4 w-4" />
              Bild auswählen
            </button>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-700">Link (optional)</span>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value.slice(0, 500))}
            placeholder="z. B. diddl-exchange.de …"
            inputMode="url"
            className="w-full rounded-2xl border border-cream-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
          />
        </label>
        {fehler && (
          <p className="rounded-2xl bg-peach-100 px-3.5 py-2.5 text-sm font-bold text-peach-600">{fehler}</p>
        )}
        {erfolg && (
          <p className="rounded-2xl bg-mint-100 px-3.5 py-2.5 text-sm font-bold text-emerald-800">
            Veröffentlicht – die Neuigkeit steht jetzt auf der Startseite.
          </p>
        )}
        <button
          type="submit"
          disabled={sendet}
          className={cn(
            "flex items-center gap-1.5 rounded-full bg-candy-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-candy-600 disabled:opacity-40",
          )}
        >
          {sendet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sendet ? "Wird veröffentlicht …" : "Neuigkeit veröffentlichen"}
        </button>
      </form>
    </div>
  );
}
