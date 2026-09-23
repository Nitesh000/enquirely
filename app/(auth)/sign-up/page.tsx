import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { githubOAuthEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" githubEnabled={githubOAuthEnabled} />;
}
