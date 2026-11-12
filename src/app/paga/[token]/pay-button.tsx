"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { startPayment } from "./actions";

export function PayButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        className="h-12 w-full text-base font-semibold"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await startPayment(token);
            if (result?.error) setError(result.error);
          })
        }
      >
        {isPending ? "Apertura del pagamento…" : "Paga ora"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </>
  );
}
