import {
  AllKeysExhaustedError,
  classifyFailure,
  fingerprintKey,
  selectKey,
} from "./rotation";
import type { KeyLimitStore } from "./store";

export type RotatingFetchDeps = {
  /** Keys in priority order: the first is drained before the second is used. */
  keys: readonly string[];
  store: KeyLimitStore;
  /** Injected so tests never touch the network. */
  fetchImpl?: typeof fetch;
  onPark?: (info: {
    fingerprint: string;
    reason: string;
    remaining: number;
    total: number;
  }) => void;
};

/**
 * A `fetch` that attaches a live Groq key per request and rotates past
 * spent ones.
 *
 * Hooking in at fetch rather than at model construction matters: one graph
 * run makes several calls across its nodes, and a key can run dry halfway
 * through. If a key were bound to the model object, that would fail the
 * whole generation instead of quietly continuing on the next key.
 *
 * Dependencies are injected rather than imported so this — the part most
 * likely to be subtly wrong — is testable without a key, a server or Redis.
 */
export function createRotatingFetch({
  keys,
  store,
  fetchImpl = fetch,
  onPark,
}: RotatingFetchDeps): typeof fetch {
  return async function rotatingFetch(
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> {
    if (keys.length === 0) {
      throw new AllKeysExhaustedError(60);
    }

    const fingerprints = keys.map(fingerprintKey);
    const exhausted = new Set(await store.getExhausted(fingerprints));

    // At most one attempt per key. Every pass either succeeds, fails for a
    // reason rotation cannot fix, or parks a key and moves to the next.
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const selected = selectKey(keys, exhausted);
      if (!selected) break;

      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${selected.key}`);

      const response = await fetchImpl(input, { ...init, headers });
      if (response.ok) return response;

      // Clone before reading: a body can only be consumed once and the SDK
      // still needs to read the original.
      const body = await response.clone().text();
      const verdict = classifyFailure({
        status: response.status,
        body,
        headers: response.headers,
      });

      // Per-minute throttling, a 400, a 500 --- nothing rotation can fix.
      // Hand it back and let the SDK deal with it.
      if (!verdict.exhausted) return response;

      await store.markExhausted(
        selected.fingerprint,
        verdict.reason,
        verdict.resetSeconds,
      );
      exhausted.add(selected.fingerprint);

      onPark?.({
        fingerprint: selected.fingerprint,
        reason: verdict.reason,
        remaining: keys.length - exhausted.size,
        total: keys.length,
      });
    }

    throw new AllKeysExhaustedError(
      await store.soonestResetSeconds(fingerprints),
    );
  } as typeof fetch;
}
