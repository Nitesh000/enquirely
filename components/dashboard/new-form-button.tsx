"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function NewFormButton({ variant = "brand" }: { variant?: "brand" | "outline" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleCreate() {
    setPending(true);
    try {
      const response = await fetch("/api/forms", { method: "POST" });
      if (!response.ok) {
        toast.error("Couldn't create the form. Try again.");
        return;
      }
      const { id } = (await response.json()) as { id: string };
      router.push(`/forms/${id}/edit`);
    } catch {
      toast.error("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant={variant} disabled={pending} onClick={handleCreate}>
      {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
      New form
    </Button>
  );
}
