import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/db/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
