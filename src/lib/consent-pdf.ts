import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ConsentPdfInput = {
  recordId: string;
  centerName: string;
  typeLabel: string;
  title: string;
  body: string;
  version: number;
  client: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    dateOfBirth: Date | null;
    taxCode: string | null;
  };
  serviceName: string | null;
  appointmentStart: Date | null;
  /** Solo per i consensi di marketing: esito scelto dalla cliente. */
  marketingChoice: boolean | null;
  anamnesis: string | null;
  signedAt: Date;
  operatorName: string | null;
  ipAddress: string | null;
  signaturePng: Buffer;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TIME_ZONE = "Europe/Rome";

const BLACK = rgb(0.08, 0.08, 0.08);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.85, 0.85, 0.85);

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: TIME_ZONE,
});

/**
 * Le font standard del PDF coprono solo WinAnsi (accenti italiani inclusi):
 * ciò che non è codificabile (emoji, ecc.) diventa "?" invece di far fallire la generazione.
 */
function makeSanitizer(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());

  return (text: string) =>
    Array.from(text.replace(/\t/g, "    ").replace(/\r/g, ""))
      .map((char) => (char === "\n" || supported.has(char.codePointAt(0)!) ? char : "?"))
      .join("");
}

export async function generateConsentPdf(input: ConsentPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const clean = makeSanitizer(regular);

  doc.setTitle(clean(input.title));
  doc.setProducer("Fusion Beauty");
  doc.setCreator("Fusion Beauty");
  doc.setCreationDate(input.signedAt);
  doc.setModificationDate(input.signedAt);

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(height: number) {
    if (y - height < MARGIN + 20) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];

    for (const paragraph of clean(text).split("\n")) {
      if (paragraph.trim() === "") {
        lines.push("");
        continue;
      }

      let current = "";
      for (const word of paragraph.split(" ")) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate;
          continue;
        }

        if (current) lines.push(current);
        current = "";

        // Parola più larga della riga: la spezza per caratteri.
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = "";
          }
          chunk += char;
        }
        current = chunk;
      }
      lines.push(current);
    }

    return lines;
  }

  function drawParagraph(
    text: string,
    options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number } = {}
  ) {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.4;

    for (const line of wrap(text, font, size, CONTENT_WIDTH - indent)) {
      ensureSpace(lineHeight);
      y -= lineHeight;
      if (line) {
        page.drawText(line, { x: MARGIN + indent, y, size, font, color: options.color ?? BLACK });
      }
    }
  }

  function drawRule() {
    ensureSpace(12);
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: LIGHT,
    });
    y -= 4;
  }

  function drawField(label: string, value: string) {
    const labelWidth = 120;
    const size = 10;
    const lineHeight = size * 1.4;
    const lines = wrap(value || "-", regular, size, CONTENT_WIDTH - labelWidth);

    ensureSpace(lineHeight * lines.length);
    lines.forEach((line, index) => {
      y -= lineHeight;
      if (index === 0) {
        page.drawText(clean(label), { x: MARGIN, y, size, font: regular, color: GRAY });
      }
      page.drawText(line, { x: MARGIN + labelWidth, y, size, font: bold, color: BLACK });
    });
  }

  // ---- Intestazione ------------------------------------------------------
  drawParagraph(input.centerName, { font: bold, size: 11, color: GRAY });
  y -= 6;
  drawParagraph(input.title, { font: bold, size: 18 });
  drawParagraph(`${input.typeLabel} - versione ${input.version}`, { size: 10, color: GRAY });
  drawRule();

  // ---- Dati cliente e raccolta ------------------------------------------
  y -= 4;
  drawField("Cliente", `${input.client.firstName} ${input.client.lastName}`);
  if (input.client.dateOfBirth) {
    drawField("Data di nascita", dateFormatter.format(input.client.dateOfBirth));
  }
  if (input.client.taxCode) {
    drawField("Codice fiscale", input.client.taxCode);
  }
  drawField("Telefono", input.client.phone);
  if (input.client.email) {
    drawField("Email", input.client.email);
  }
  if (input.serviceName) {
    drawField("Trattamento", input.serviceName);
  }
  if (input.appointmentStart) {
    drawField("Appuntamento", dateTimeFormatter.format(input.appointmentStart).slice(0, 16));
  }
  drawRule();

  // ---- Testo del consenso -----------------------------------------------
  y -= 6;
  drawParagraph(input.body, { size: 10 });

  if (input.marketingChoice !== null) {
    y -= 8;
    drawParagraph(
      input.marketingChoice
        ? "La cliente ACCONSENTE alle comunicazioni promozionali."
        : "La cliente NON ACCONSENTE alle comunicazioni promozionali.",
      { font: bold, size: 10 }
    );
  }

  if (input.anamnesis) {
    y -= 10;
    drawParagraph("Anamnesi / note dichiarate dalla cliente", { font: bold, size: 10 });
    drawParagraph(input.anamnesis, { size: 10 });
  }

  // ---- Firma --------------------------------------------------------------
  const signature = await doc.embedPng(input.signaturePng);
  const maxSignatureWidth = 220;
  const maxSignatureHeight = 90;
  const scale = Math.min(maxSignatureWidth / signature.width, maxSignatureHeight / signature.height);
  const signatureWidth = signature.width * scale;
  const signatureHeight = signature.height * scale;

  // Firma e dati di raccolta restano sulla stessa pagina.
  y -= 24;
  ensureSpace(signatureHeight + 190);
  drawParagraph("Firma della cliente", { font: bold, size: 10 });
  y -= signatureHeight + 4;
  page.drawImage(signature, { x: MARGIN, y, width: signatureWidth, height: signatureHeight });
  page.drawLine({
    start: { x: MARGIN, y: y - 2 },
    end: { x: MARGIN + maxSignatureWidth, y: y - 2 },
    thickness: 0.7,
    color: BLACK,
  });
  y -= 4;
  drawParagraph(`${input.client.firstName} ${input.client.lastName}`, { size: 9, color: GRAY });

  // ---- Dati di raccolta (tracciabilità) ---------------------------------
  y -= 10;
  drawRule();
  y -= 4;
  drawField("Firmato il", `${dateTimeFormatter.format(input.signedAt)} (ora italiana)`);
  drawField("Raccolto da", input.operatorName ?? "-");
  drawField("Indirizzo IP", input.ipAddress ?? "-");
  drawField("ID consenso", input.recordId);

  // ---- Piè di pagina su ogni pagina -------------------------------------
  const pages = doc.getPages();
  pages.forEach((current, index) => {
    current.drawText(
      clean(`${input.centerName} - ${input.title} - pagina ${index + 1} di ${pages.length}`),
      { x: MARGIN, y: MARGIN - 20, size: 8, font: regular, color: GRAY }
    );
  });

  return Buffer.from(await doc.save());
}
