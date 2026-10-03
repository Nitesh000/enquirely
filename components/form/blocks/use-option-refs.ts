"use client";

import { useEffect, useRef } from "react";

/**
 * Roving tabindex plumbing for the option-list blocks.
 *
 * The group itself is not focusable: focus sits on exactly one option at a
 * time, which is both the ARIA-correct radiogroup pattern and the only way
 * the focus ring reads as "this option" rather than drawing a box around the
 * whole list. Key handling still lives on the container --- keydown bubbles
 * up from the focused option, so letter accelerators keep working.
 */
export function useOptionRefs(activeIndex: number, autoFocus?: boolean) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[activeIndex]?.focus();
    // Only on mount: re-focusing on every selection change would fight the
    // user's own focus if they are clicking rather than typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  function setRef(index: number) {
    return (element: HTMLButtonElement | null) => {
      refs.current[index] = element;
    };
  }

  function focusAt(index: number) {
    refs.current[index]?.focus();
  }

  return { setRef, focusAt };
}
