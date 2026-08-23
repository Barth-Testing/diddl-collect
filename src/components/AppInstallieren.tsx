"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
};

type NavigatorMitStandalone = Navigator & { standalone?: boolean };

export function AppInstallieren({ className }: { className?: string }) {
  const [status, setStatus] = useState<{ ios: boolean; event: InstallEvent | null }>({
    ios: false,
    event: null,
  });
  const [iosHinweis, setIosHinweis] = useState(false);

  useEffect(() => {
    const frag = (e: Event) => {
      e.preventDefault();
      setStatus({ ios: false, event: e as InstallEvent });
    };
    window.addEventListener("beforeinstallprompt", frag);
    const navigatorErweitert = window.navigator as NavigatorMitStandalone;
    const installiert =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorErweitert.standalone === true;
    const ios = !installiert && /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (!ios) return () => window.removeEventListener("beforeinstallprompt", frag);
    const zeit = setTimeout(() => setStatus({ ios: true, event: null }), 0);
    return () => {
      clearTimeout(zeit);
      window.removeEventListener("beforeinstallprompt", frag);
    };
  }, []);

  if (!status.event && !status.ios) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (status.event) void status.event.prompt();
          else setIosHinweis(!iosHinweis);
        }}
        title={status.ios && !status.event ? "Zum Home-Bildschirm hinzufügen" : "App installieren"}
        aria-label="App installieren"
        className={className}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">App</span>
      </button>
      {iosHinweis && (
        <div className="fixed inset-x-3 top-20 z-50 mx-auto max-w-sm rounded-2xl bg-white p-4 shadow-xl ring-2 ring-candy-200">
          <div className="flex items-start gap-2">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-candy-500" />
            <p className="text-sm font-semibold text-ink-700">
              Auf dem iPhone/iPad: In Safari auf <strong>Teilen</strong> tippen und dann{" "}
              <strong>„Zum Home-Bildschirm“</strong> wählen – schon ist die App installiert.
            </p>
            <button
              type="button"
              onClick={() => setIosHinweis(false)}
              aria-label="Schließen"
              className="ml-auto shrink-0 text-ink-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
