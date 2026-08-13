"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getVersion, subscribeChange } from "@/lib/store";

/**
 * Liefert eine Versionsnummer, die sich bei jeder Änderung des
 * localStorage-Stores erhöht. Der initiale "Kick" passiert nach der
 * Hydration per Event-Dispatch – so gibt es keine Hydration-Mismatches.
 */
export function useStoreVersion() {
  const version = useSyncExternalStore(subscribeChange, getVersion, () => 0);
  useEffect(() => {
    window.dispatchEvent(new Event("diddlcollect:change"));
  }, []);
  return version;
}