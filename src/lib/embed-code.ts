/** Codici da incollare nei siti (usati anche nel browser per l'anteprima del codice). */

/** Codice da incollare nel sito per un form. */
export function formEmbedCode(baseUrl: string, formId: string) {
  return `<div id="fusion-beauty-form-${formId}"></div>\n<script src="${baseUrl}/api/embed/form/${formId}" async></script>`;
}

/** Codice da incollare nel sito per l'agenda di prenotazione. */
export function bookingEmbedCode(
  baseUrl: string,
  slug: string,
  options: { mode: "inline" | "button" | "popup" | "link"; text: string; color: string; services?: string[]; tint?: boolean; header?: boolean }
) {
  const params = new URLSearchParams();
  if (options.mode !== "inline") params.set("mode", options.mode);
  if ((options.mode === "button" || options.mode === "popup") && options.text) params.set("text", options.text);
  if (options.color) params.set("color", options.color);
  if (options.services?.length) params.set("servizi", options.services.join(","));
  if (options.tint) params.set("tinta", "1");
  if (options.header === false) params.set("intestazione", "0");
  const query = params.toString();
  return `<div id="fusion-beauty-booking-${slug}"></div>\n<script src="${baseUrl}/api/embed/booking/${slug}${query ? `?${query}` : ""}" async></script>`;
}

/** Link diretto dell'agenda (Google Business, Instagram, WhatsApp…). */
export function bookingPageUrl(baseUrl: string, slug: string, options: { services?: string[]; color?: string } = {}) {
  const params = new URLSearchParams();
  if (options.services?.length) params.set("servizi", options.services.join(","));
  if (options.color) params.set("colore", options.color);
  const query = params.toString();
  return `${baseUrl}/embed/${slug}${query ? `?${query}` : ""}`;
}
