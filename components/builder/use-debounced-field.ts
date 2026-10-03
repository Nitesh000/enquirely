"use client";

import { useRef, useState } from "react";

/**
 * Local, instantly-responsive input state that commits to the store after a
 * pause in typing, not on every keystroke.
 *
 * Without this, editing a title would dispatch an `update_block` per
 * character --- Cmd+Z would undo one letter at a time instead of one edit,
 * and autosave would fire dozens of times mid-sentence. `flush()` forces an
 * immediate commit (wired to `onBlur`) so a change is never lost to a
 * pending timer if the field loses focus before the debounce elapses.
 */
export function useDebouncedField(
  value: string,
  commit: (next: string) => void,
  delay = 500,
) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // An external change --- undo/redo, switching to another block --- wins
  // over whatever is mid-edit locally. Compared during render and committed
  // conditionally rather than in a `useEffect`: React's documented pattern
  // for "adjust state when a prop changes", one render instead of two.
  //
  // No ref tracks "did we cause this change ourselves": if the new `value`
  // equals what the user already typed, `setLocal` below is a harmless
  // no-op write of an identical string, not a visible override.
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  function onChange(next: string) {
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), delay);
  }

  function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (local !== value) commit(local);
  }

  return { value: local, onChange, flush };
}
