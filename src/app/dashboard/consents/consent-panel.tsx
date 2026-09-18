"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { upsertConsent, type ConsentDTO, type ConsentStatusValue, type ConsentTypeValue } from "./actions";
import { CONSENT_STATUS_LABELS, CONSENT_TYPE_LABELS } from "./constants";

const statusVariants: Record<ConsentStatusValue, "default" | "secondary" | "destructive" | "outline"> = {
  GIVEN: "default",
  REFUSED: "destructive",
  PENDING: "secondary",
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type ConsentPanelProps = {
  clientId: string;
  initialConsents: ConsentDTO[];
};

export function ConsentPanel({ clientId, initialConsents }: ConsentPanelProps) {
  const [consents, setConsents] = useState(initialConsents);
  const [signingType, setSigningType] = useState<ConsentTypeValue | null>(null);
  const [isPending, startTransition] = useTransition();

  const allTypes: ConsentTypeValue[] = ["PRIVACY", "MARKETING", "DATA_PROCESSING", "TREATMENT_SPECIFIC"];

  function getConsent(type: ConsentTypeValue): ConsentDTO | undefined {
    return consents.find((c) => c.type === type);
  }

  function handleSign(type: ConsentTypeValue) {
    startTransition(async () => {
      const result = await upsertConsent({ clientId, type, status: "GIVEN" });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setConsents((prev) => {
        const filtered = prev.filter((c) => c.type !== type);
        return [...filtered, result.consent];
      });
      setSigningType(null);
      toast.success(`Consenso "${CONSENT_TYPE_LABELS[type]}" registrato.`);
    });
  }

  function handleRefuse(type: ConsentTypeValue) {
    startTransition(async () => {
      const result = await upsertConsent({ clientId, type, status: "REFUSED" });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setConsents((prev) => {
        const filtered = prev.filter((c) => c.type !== type);
        return [...filtered, result.consent];
      });
      toast.success(`Consenso "${CONSENT_TYPE_LABELS[type]}" rifiutato registrato.`);
    });
  }

  const missingCount = allTypes.filter((t) => {
    const c = getConsent(t);
    return !c || c.status === "PENDING";
  }).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Consensi</CardTitle>
          {missingCount > 0 ? (
            <Badge variant="destructive">{missingCount} mancant{missingCount === 1 ? "e" : "i"}</Badge>
          ) : (
            <Badge variant="outline" className="border-green-600 text-green-700">Completi</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {allTypes.map((type) => {
          const consent = getConsent(type);
          const status: ConsentStatusValue = consent?.status ?? "PENDING";
          return (
            <div key={type} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={statusVariants[status]} className="shrink-0">
                  {CONSENT_STATUS_LABELS[status]}
                </Badge>
                <div>
                  <div className="font-medium">{CONSENT_TYPE_LABELS[type]}</div>
                  {consent?.signedAt && (
                    <div className="text-xs text-muted-foreground">
                      Firmato il {dateFormatter.format(consent.signedAt)}
                    </div>
                  )}
                </div>
              </div>
              {status !== "GIVEN" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSigningType(type)}
                  disabled={isPending}
                >
                  Firma digitale
                </Button>
              )}
            </div>
          );
        })}

        <Dialog open={signingType !== null} onOpenChange={(open) => { if (!open) setSigningType(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Firma consenso — {signingType ? CONSENT_TYPE_LABELS[signingType] : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                La cliente conferma di aver letto e compreso il documento relativo a:{" "}
                <strong>{signingType ? CONSENT_TYPE_LABELS[signingType] : ""}</strong>.
              </p>
              <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                Firma elettronica semplice ai sensi dell&apos;art. 3 del Reg. UE n. 910/2014 (eIDAS).
                <br />
                Data e ora: {new Date().toLocaleString("it-IT")}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => signingType && handleRefuse(signingType)}
                disabled={isPending}
              >
                Rifiuta
              </Button>
              <Button
                onClick={() => signingType && handleSign(signingType)}
                disabled={isPending}
              >
                {isPending ? "Registrazione..." : "Firma e accetta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
