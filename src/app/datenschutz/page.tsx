import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Diddl-Collect",
  description:
    "Datenschutzerklärung von Diddl-Collect: Informationen über Cookies, Google AdSense, Google Analytics und die Verarbeitung deiner Daten.",
  alternates: { canonical: "/datenschutz" },
};

export default function DatenschutzSeite() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-800">
        <span className="text-candy-500">Datenschutz</span>
      </h1>
      <p className="mt-2 text-sm text-ink-600">Stand: September 2026</p>

      <section className="mt-8 space-y-8">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">1. Verantwortlicher</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Verantwortlich für die Datenverarbeitung auf diesen Seiten ist der im{" "}
            <Link href="/impressum" className="text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700">
              Impressum
            </Link>{" "}
            genannte Betreiber.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">2. Datenerfassung auf dieser Website</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Diese Website ist als statische Seite gehostet. Die technischen Infrastruktur-Anbieter
            (Hosting, Content-Delivery-Netzwerk) verarbeiten automatisch Verbindungsdaten (z. B.
            IP-Adresse, aufgerufene Seiten, Zeitpunkt, Browsertyp), soweit dies für den Betrieb und
            die Auslieferung der Website erforderlich ist. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
            DSGVO (berechtigtes Interesse an der Bereitstellung und Sicherheit der Website).
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">
            3. Google AdSense (Werbung)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Diese Website nutzt Google AdSense. Google AdSense ist ein Dienst von Google Ireland
            Limited (Google Building Gordon House, 4 Barrow St, Dublin, D04 E5W5, Irland) zur
            Einbindung von Werbeanzeigen. Dabei werden Daten (z. B. IP-Adresse, Cookie-Kennungen,
            Interaktionen mit Anzeigen) an Google übertragen und dort möglicherweise auch in den USA
            verarbeitet. Google kann diese Daten mit anderen Informationen kombinieren, die über
            andere Google-Dienste erhoben werden.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-700">
            Google verwendet Cookies und/oder vergleichbare Technologien, um für dich relevante
            Anzeigen auszuliefern. Weitere Informationen findest du in der{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700"
            >
              Datenschutzerklärung von Google
            </a>{" "}
            und den{" "}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700"
            >
              Informationen zu Werbeanzeigen bei Google
            </a>
            . Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), sofern du diese
            über einen Einwilligungs-Dialog erteilst.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-700">
            Google AdSense verwendet nach dem{" "}
            <a
              href="https://business.safety.google/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700"
            >
              zusätzlichen Einwilligungsmodus
            </a>{" "}
            ggf. Daten, um zu entscheiden, ob Anzeigen ohne Cookies ausgeliefert werden können.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">
            4. Google Analytics
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Diese Website nutzt Google Analytics (Google Inc., 1600 Amphitheatre Parkway, Mountain
            View, CA 94043, USA) mit dem Kürzel „gtag.js“, um die Nutzung der Website zu analysieren
            und zu verbessern. Dabei werden pseudonymisierte Nutzungsdaten wie Besucherzahl,
            Herkunft, besuchte Seiten und Verweildauer erfasst. Die dabei erzeugten Informationen
            über die Nutzung dieser Website werden in der Regel an einen Server von Google in den USA
            übertragen und dort gespeichert. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1
            lit. a DSGVO), sofern du diese erteilst.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-700">
            Du kannst die Speicherung der Cookies durch eine entsprechende Einstellung deiner
            Browser-Software verhindern. Nähere Informationen zu Googles Umgang mit Daten findest du
            unter{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-candy-600 underline decoration-candy-200 underline-offset-2 hover:text-candy-700"
            >
              https://policies.google.com/privacy
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">5. Lokale Speicherung in deinem Browser</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Für die Kernfunktionen (deine Sammlung, Häkchen, Wunschliste, Tauschangebote) speichert
            diese Website deine persönlichen Daten überwiegend lokal in deinem Browser
            (localStorage). Diese Daten verlassen deinen Browser nur dann, wenn du dich mit einem
            Konto anmeldest und eine Synchronisierung mit dem Server stattfindet. Du kannst den
            lokalen Speicher jederzeit über die Einstellungen deines Browsers löschen.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">6. Amazon-Partnerprogramm</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Als Amazon-Partner verdient diese Website an qualifizierten Käufen über die verlinkten
            Amazon-Produkte. Dabei wird über einen Affiliate-Parameter im Link erkannt, dass du über
            diese Website zu Amazon gelangt bist. Mit dem Klick auf den Affiliate-Link werden Daten
            an Amazon übertragen (Zuständigkeit hierfür liegt bei Amazon).
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">7. Deine Rechte</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Du hast das Recht, Auskunft über die dich betreffenden personenbezogenen Daten zu
            erhalten, sowie das Recht auf Berichtigung, Löschung, Einschränkung der Verarbeitung,
            Datenübertragbarkeit und Widerspruch. Zur Ausübung dieser Rechte wende dich an den im
            Impressum genannten Betreiber. Du hast außerdem das Recht, dich bei einer
            Datenschutz-Aufsichtsbehörde zu beschweren.
          </p>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-ink-800">8. Änderungen</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Wir können diese Datenschutzerklärung anpassen, um sie an geänderte rechtliche oder
            technische Gegebenheiten anzupassen. Die jeweils aktuelle Fassung findest du auf dieser
            Seite.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Link
          href="/"
          className="chip gap-1.5 bg-white px-5 py-2.5 text-candy-600 ring-2 ring-candy-200 transition hover:bg-candy-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
