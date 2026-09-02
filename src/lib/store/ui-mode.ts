import { create } from "zustand";

export type UiMode = "beginner" | "advanced";

const STORAGE_KEY = "bt-ui-mode";

interface UiModeStore {
  mode: UiMode;
  /** True once the persisted value has been read on the client. */
  ready: boolean;
  setMode: (mode: UiMode) => void;
  toggle: () => void;
  /** Read the saved preference from localStorage (call once on mount). */
  init: () => void;
}

/**
 * Simple app-wide Beginner / Advanced preference.
 * Defaults to "beginner" so the first (server + hydration) render is stable;
 * the saved value is applied after mount via init().
 */
export const useUiMode = create<UiModeStore>((set, get) => ({
  mode: "beginner",
  ready: false,

  setMode: (mode) => {
    set({ mode });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* ignore */
      }
    }
  },

  toggle: () => {
    get().setMode(get().mode === "beginner" ? "advanced" : "beginner");
  },

  init: () => {
    if (typeof window === "undefined") return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({
      mode: saved === "advanced" ? "advanced" : "beginner",
      ready: true,
    });
  },
}));
