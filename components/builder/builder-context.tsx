"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";

import { createBuilderStore, type BuilderState, type BuilderStore } from "@/lib/builder/store";
import type { FormDefinition } from "@/lib/forms/schema";

const BuilderStoreContext = createContext<BuilderStore | null>(null);

/**
 * One store per provider instance, created on first render and held in a
 * ref --- not a module-level singleton. A singleton would leak one form's
 * draft into the next form opened in the same tab (the component unmounts
 * and remounts on navigation, but a module-level store wouldn't).
 */
export function BuilderStoreProvider({
  definition,
  children,
}: {
  definition: FormDefinition;
  children: ReactNode;
}) {
  // Lazy `useState` initializer, not a ref: it runs exactly once and
  // doesn't touch `.current` during render, which React's compiler-era
  // lint rules now flag even for the "only set once" pattern.
  const [store] = useState(() => createBuilderStore(definition));

  return (
    <BuilderStoreContext.Provider value={store}>
      {children}
    </BuilderStoreContext.Provider>
  );
}

export function useBuilderStore<T>(selector: (state: BuilderState) => T): T {
  const store = useContext(BuilderStoreContext);
  if (!store) {
    throw new Error("useBuilderStore must be used within BuilderStoreProvider");
  }
  return useStore(store, selector);
}
