"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { kontaktSenden } from "@/lib/kontakt";

type KontaktModus = "seite" | "modal";

export function KontaktFormular({ modus = "seite" }: { modus?: KontaktModus }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [zustand, setZustand] = useState<"idle" | "senden" | "ok" | "fehler">("idle");
  const [meldung, setMeldung] = useState("");

  async function sende(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !text.trim() || zustand === "senden") return;
    setZustand("senden");
    setMeldung("");
    const ergebnis = await kontaktSenden(name.trim(), email.trim(), betreff.trim(), text.trim());
    if (ergebnis.ok) {
      setZustand("ok");
      setMeldung("Danke! Deine Nachricht ist beim Betreiber eingegangen. Wir melden uns so bald wie möglich.");
      setName("");
      setEmail("");
      setBetreff("");
      setText("");
    } else {
      setZustand("fehler");
      setMeldung(ergebnis.fehler ?? "Das hat leider nicht geklappt – bitte versuch es gleich noch einmal.");
    }
  }

  return (
    <form onSubmit={sende} className={`space-y-4 ${modus === "modal" ? "" : "text-sm"}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-600">Dein Name *</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder="z. B. Trixi"
            className="w-full rounded-2xl border border-candy-100 bg-white px-3.5 py-2.5 text-sm text-ink-800 outline-none ring-candy-200 placeholder:text-ink-400 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-600">Deine E-Mail *</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            placeholder="du@beispiel.de"
            className="w-full rounded-2xl border border-candy-100 bg-white px-3.5 py-2.5 text-sm text-ink-800 outline-none ring-candy-200 placeholder:text-ink-400 focus:ring-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold text-ink-600">Betreff (optional)</span>
        <input
          value={betreff}
          onChange={(e) => setBetreff(e.target.value)}
          maxLength={200}
          placeholder="z. B. Frage zu meinem Konto"
          className="w-full rounded-2xl border border-candy-100 bg-white px-3.5 py-2.5 text-sm text-ink-800 outline-none ring-candy-200 placeholder:text-ink-400 focus:ring-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-bold text-ink-600">Deine Nachricht *</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          maxLength={2000}
          rows={modus === "modal" ? 4 : 6}
          placeholder="Womit können wir dir helfen?"
          className="w-full resize-y rounded-2xl border border-candy-100 bg-white px-3.5 py-2.5 text-sm text-ink-800 outline-none ring-candy-200 placeholder:text-ink-400 focus:ring-2"
        />
        <span className="mt-1 block text-right text-[11px] font-semibold text-ink-400">
          {text.length}/2000
        </span>
      </label>

      {meldung && (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            zustand === "fehler" ? "bg-berry-100 text-berry-600" : "bg-mint-100 text-emerald-700"
          }`}
        >
          {meldung}
        </p>
      )}

      <button
        type="submit"
        disabled={zustand === "senden"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-berry-400 px-6 py-3 font-bold text-white shadow-lg shadow-berry-300/40 transition hover:-translate-y-0.5 hover:bg-berry-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {zustand === "senden" ? (
          "Wird gesendet …"
        ) : (
          <>
            <Send className="h-4 w-4" />
            Nachricht senden
          </>
        )}
      </button>

      {modus === "seite" && (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-500">
          <Mail className="h-3.5 w-3.5" />
          Lieber über E-Mail?&nbsp;
          <a
            href="mailto:math.tricks.mail@gmail.com"
            className="text-berry-500 underline decoration-berry-200 underline-offset-2 hover:text-berry-600"
          >
            math.tricks.mail@gmail.com
          </a>
        </p>
      )}
    </form>
  );
}
