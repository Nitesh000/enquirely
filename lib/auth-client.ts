"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth. Same-origin, so no baseURL needed.
 *
 * Prefer `getSession()` from `lib/session.ts` in server components; this
 * client exists for sign-in/sign-up forms and the sign-out button.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
