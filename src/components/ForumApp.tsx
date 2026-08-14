"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, Loader2, Lock, MessagesSquare, Send, Sparkles, Wifi } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/store";
import { useStoreVersion } from "@/lib/useStoreVersion";
import {
  RAUME,
  chatKonfiguriert,
  chatNachrichten,
  getChatVersion,
  istVerbunden,
  senden,
  subscribeChat,
  verbinde,
} from "@/lib/chat";
import { cn } from "@/lib/utils";

export function ForumApp() {
  const [raum, setRaum] = useState<string>(RAUME[0].id);
  const [version, setVersion] = useState(getChatVersion);

  useStoreVersion();
  const benutzer = getSession();
  const nachrichten = chatNachrichten(raum);
  const konfiguriert = chatKonfiguriert();
  const verbunden = istVerbunden();

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeChat(() => setVersion(getChatVersion())), []);

  useEffect(() => {
    const bereinigen = verbinde(raum, () => setVersion(getChatVersion()));
    return bereinigen;
  }, [raum]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [nachrichten.length, raum]);

  useEffect(() => {
    if (verbunden) return;
    const timer = setInterval(() => setVersion(getChatVersion()), 30_000);
    return () => clearInterval(timer);
  }, [verbunden]);

  const aktiv = RAUME.find((r) => r.id === raum) ?? RAUME[0];

  function abschicken(form: HTMLFormElement) {
    if (!benutzer) return;
    const text = form.querySelector<HTMLInputElement>("input[data-text]")?.value ?? "";
    senden(raum, benutzer.name, text);
    form.querySelector<HTMLInputElement>("input[data-text]")!.value = "";
  }

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4">
      <div className="card-soft flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-candy-100 text-candy-600">
          <MessagesSquare className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="font-display font-bold text-ink-800">Knuddel-Chätsch</h2>
          <p className="text-xs font-semibold text-ink-600">{aktiv.beschreibung}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold">
          {!konfiguriert ? (
            <span className="chip bg-cream-200 px-2 py-1 text-ink-600">
              <CloudOff className="h-3 w-3" /> Noch nicht eingerichtet
            </span>
          ) : verbunden ? (
            <span className="chip bg-mint-100 px-2 py-1 text-emerald-700">
              <Wifi className="h-3 w-3" /> Live
            </span>
          ) : (
            <span className="chip bg-peach-100 px-2 py-1 text-peach-600">
              <Loader2 className="h-3 w-3 animate-spin" /> Offline – wird synchronisiert
            </span>
          )}
        </div>
      </div>

      {!konfiguriert && (
        <div className="card-soft border-peach-300 bg-peach-50 px-4 py-3 text-sm font-semibold text-ink-700">
          Der Chat braucht noch Supabase-Schlüssel: Kopiere{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">.env.local.example</code> nach{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">.env.local</code>, trage URL und
          Anon-Key ein und baue die Seite neu.
        </div>
      )}

      {nachrichten.some((n) => n.offen) && (
        <div className="card-soft flex items-center gap-2 border-mint-200 bg-mint-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
          Wartende Nachrichten werden synchronisiert – kurz Geduld.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {RAUME.map((r) => (
          <button
            key={r.id}
            onClick={() => setRaum(r.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-bold transition-all",
              raum === r.id
                ? "bg-candy-500 text-white shadow-md shadow-candy-300/50"
                : "bg-white text-ink-700 ring-1 ring-cream-300 hover:ring-candy-300",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        className="card-soft h-[420px] space-y-3 overflow-y-auto p-4 sm:h-[480px]"
      >
        {nachrichten.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-ink-600">
            <MessagesSquare className="h-10 w-10 text-candy-300" />
            <p className="font-display text-lg font-bold text-ink-800">Noch ganz still hier.</p>
            <p className="max-w-xs text-sm">
              Schreib die erste Nachricht im Raum {aktiv.label} – Tauschangebote, Fundstücke oder
              einfach Hallo sagen. Mitschnacken dürfen registrierte Sammler.
            </p>
          </div>
        )}
        {nachrichten.map((n) => {
          const ich = n.autor === benutzer?.name;
          return (
            <div
              key={n.id}
              className={cn("flex", ich ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[82%] rounded-3xl px-4 py-2.5 text-sm",
                  ich
                    ? "rounded-br-lg bg-candy-500 text-white"
                    : "rounded-bl-lg bg-white text-ink-800 ring-1 ring-cream-200",
                )}
              >
                {!ich && (
                  <p className={cn("text-xs font-bold", "text-candy-600")}>{n.autor}</p>
                )}
                <p className="break-words whitespace-pre-wrap">{n.text}</p>
                <p
                  className={cn(
                    "mt-0.5 text-right text-[10px] font-semibold",
                    ich ? "text-white/70" : "text-ink-600",
                  )}
                >
                  {n.offen
                    ? `Wartet seit ${formatiereZeit(n.erstelltAm)}`
                    : formatiereZeit(n.erstelltAm)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {benutzer ? (
        <form
          className="card-soft flex items-center gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            abschicken(e.currentTarget);
          }}
        >
          <input
            data-text
            placeholder={`Schreib als ${benutzer.name} in „${aktiv.label}" …`}
            maxLength={500}
            required
            className="min-w-0 flex-1 rounded-full border border-cream-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
          />
          <button
            type="submit"
            aria-label="Nachricht senden"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-candy-500 text-white shadow-md shadow-candy-300/50 transition hover:bg-candy-600"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <div className="card-soft flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-candy-100 text-candy-600">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display font-bold text-ink-800">Nur Sammler schreiben im Chätsch</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-600">
              Du kannst alles mitlesen – zum Mitschnacken brauchst du ein Sammlerkonto. Dauert nur
              eine Minute und bleibt komplett in deinem Browser.
            </p>
          </div>
          <Link
            href="/konto"
            className="rounded-full bg-candy-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-candy-300/50 transition hover:-translate-y-0.5 hover:bg-candy-600"
          >
            Konto anlegen &amp; mitreden
          </Link>
        </div>
      )}

      <p className="text-center text-xs text-ink-600">
        Nachrichten werden in deinem Browser zwischengespeichert und landen bei der nächsten
        Online-Verbindung im Raum. Sei lieb zueinander – Knuddelregeln gelten überall.
      </p>
    </div>
  );
}

function formatiereZeit(zeit: number) {
  return new Date(zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
