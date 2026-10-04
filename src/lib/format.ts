/**
 * Formattazione manuale ("€ 1.480,00"): Intl produce separatori diversi tra Node e browser
 * per i numeri a 4 cifre e causerebbe errori di hydration.
 */
function formatAmount(value: number, decimals: number) {
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  return `€ ${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export function formatEuro(value: number) {
  return formatAmount(value, 2);
}

/** Importo senza decimali (es. "€ 86") per i riepiloghi. */
export function formatEuroRound(value: number) {
  return formatAmount(value, 0);
}

export function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

/** Numero in formato internazionale senza "+" (default Italia), come richiesto da wa.me. */
export function normalizePhoneForWhatsapp(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (!digits.startsWith("39") || digits.length <= 10) digits = `39${digits.replace(/^0+(?=3)/, "")}`;
  return digits;
}

export function whatsappUrl(phone: string, text?: string) {
  const base = `https://wa.me/${normalizePhoneForWhatsapp(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
