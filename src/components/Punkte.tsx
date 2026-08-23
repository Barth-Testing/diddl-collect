import { cn } from "@/lib/utils";

export function Punkte({ label, wert, farbe }: { label: string; wert: number; farbe: string }) {
  return (
    <div className="rounded-2xl bg-cream-50 px-3 py-2 text-center ring-1 ring-cream-200">
      <p className={cn("font-display text-xl font-bold", farbe)}>{wert}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-600">{label}</p>
    </div>
  );
}
