/** Codici da incollare nei siti (usati anche nel browser per l'anteprima del codice). */

/** Codice da incollare nel sito per un form. */
export function formEmbedCode(baseUrl: string, formId: string) {
  return `<div id="fusion-beauty-form-${formId}"></div>\n<script src="${baseUrl}/api/embed/form/${formId}" async></script>`;
}

/** Codice da incollare nel sito per l'agenda di prenotazione. */
export function bookingEmbedCode(baseUrl: string, slug: string, options: { mode: "inline" | "button" | "popup"; text: string; color: string }) {
  const params = new URLSearchParams();
  if (options.mode !== "inline") params.set("mode", options.mode);
  if (options.mode !== "inline" && options.text) params.set("text", options.text);
  if (options.color) params.set("color", options.color);
  const query = params.toString();
  return `<div id="fusion-beauty-booking-${slug}"></div>\n<script src="${baseUrl}/api/embed/booking/${slug}${query ? `?${query}` : ""}" async></script>`;
}
