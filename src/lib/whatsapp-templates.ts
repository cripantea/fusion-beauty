/**
 * Aiuti per i template WhatsApp usati nel browser (costruttore automazioni,
 * campagne, impostazioni): testo con {{nome}} → testo Meta con {{1}}…
 */

export const EXAMPLE_VALUES: Record<string, string> = {
  nome: "Giulia",
  cognome: "Rossi",
  centro: "Centro Estetico",
  trattamento: "Pulizia viso",
  data: "martedì 12 novembre",
  ora: "15:30",
  operatrice: "Sara",
  prenota: "https://beauty.fusionsoft.it/embed/centro",
  link: "https://beauty.fusionsoft.it/q/abc",
};

/** "Ciao {{nome}}…" → testo Meta con {{1}}, {{2}}… più i valori di esempio e i parametri da salvare. */
export function toMetaTemplate(text: string) {
  const params: string[] = [];
  const body = text.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (_, key: string) => {
    params.push(`{{${key.toLowerCase()}}}`);
    return `{{${params.length}}}`;
  });
  const examples = params.map((p) => EXAMPLE_VALUES[p.slice(2, -2)] ?? "esempio");
  return { body, params, examples };
}

/** Nome valido per Meta a partire da un titolo ("Promemoria del giorno prima" → promemoria_del_giorno_prima). */
export function templateNameFrom(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "messaggio"
  );
}

export const TEMPLATE_STATUS: Record<string, { label: string; tone: "mint" | "amber" | "wine" | "slate" }> = {
  APPROVED: { label: "Approvato", tone: "mint" },
  PENDING: { label: "In revisione Meta", tone: "amber" },
  REJECTED: { label: "Rifiutato", tone: "wine" },
  PAUSED: { label: "In pausa", tone: "slate" },
  DISABLED: { label: "Disattivato", tone: "slate" },
};
