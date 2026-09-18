export type ConsentTypeValue = "PRIVACY" | "MARKETING" | "DATA_PROCESSING" | "TREATMENT_SPECIFIC";
export type ConsentStatusValue = "GIVEN" | "REFUSED" | "PENDING";

export const CONSENT_TYPE_LABELS: Record<ConsentTypeValue, string> = {
  PRIVACY: "Privacy (GDPR)",
  MARKETING: "Marketing",
  DATA_PROCESSING: "Trattamento dati",
  TREATMENT_SPECIFIC: "Liberatoria trattamento",
};

export const CONSENT_STATUS_LABELS: Record<ConsentStatusValue, string> = {
  GIVEN: "Firmato",
  REFUSED: "Rifiutato",
  PENDING: "Mancante",
};
