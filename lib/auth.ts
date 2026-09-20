import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";
import { accounts, sessions, users, verifications } from "@/lib/db/schema";
import { env, githubOAuthEnabled } from "@/lib/env";
import { createPersonalWorkspace } from "@/lib/workspaces";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: "pg",
    // Better Auth's model names on the left, our Drizzle tables on the right.
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No mail provider wired up yet, so verification would lock people out.
    requireEmailVerification: false,
  },

  socialProviders: githubOAuthEnabled
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID!,
          clientSecret: env.GITHUB_CLIENT_SECRET!,
        },
      }
    : {},

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh at most daily
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Every user needs somewhere to put their forms before they see the
        // dashboard. Runs inside signup for both email and OAuth.
        after: async (user) => {
          await createPersonalWorkspace({
            userId: user.id,
            name: user.name,
            email: user.email,
          });
        },
      },
    },
  },

  // Must stay last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
