import { createStore } from "zustand/vanilla";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
};

export type ConfirmState = {
  pending: PendingConfirm | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
};

export const confirmStore = createStore<ConfirmState>((set, get) => ({
  pending: null,

  ask(options) {
    get().pending?.resolve(false);

    return new Promise<boolean>((resolve) => {
      set({ pending: { options, resolve } });
    });
  },

  settle(confirmed) {
    const pending = get().pending;
    if (!pending) return;

    set({ pending: null });
    pending.resolve(confirmed);
  },
}));

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return confirmStore.getState().ask(options);
}
