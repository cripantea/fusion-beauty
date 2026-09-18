export type PaymentMethodValue = "CASH" | "CARD" | "TRANSFER" | "OTHER";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  CASH: "Contanti",
  CARD: "Carta",
  TRANSFER: "Bonifico",
  OTHER: "Altro",
};
