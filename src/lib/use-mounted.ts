"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Returns false during SSR and the first client render, then true after mount.
 * Use it to defer client-only/runtime-dependent UI (e.g. attributes derived from
 * live connection state) so the server and first client render agree and no
 * hydration mismatch occurs. Avoids the set-state-in-effect pattern.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
