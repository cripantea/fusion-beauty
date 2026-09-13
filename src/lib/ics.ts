/**
 * Minimal RFC 5545 (iCalendar) builder and parser.
 *
 * Deliberately does not support recurrence rules (RRULE) — only single,
 * concrete VEVENT blocks are read/written, which is all this app needs
 * (individual appointments and imported busy blocks, not repeating series).
 */

function escapeICSText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function unescapeICSText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function formatICSDateUTC(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Folds lines longer than 75 characters per RFC 5545 §3.1. */
function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) {
    return line;
  }

  const chunks: string[] = [];
  let rest = line;
  while (rest.length > maxLen) {
    chunks.push(rest.slice(0, maxLen));
    rest = rest.slice(maxLen);
  }
  chunks.push(rest);

  return chunks.join("\r\n ");
}

export type ICSEventInput = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
};

export function buildICSFeed(calendarName: string, events: ICSEventInput[]): string {
  const now = formatICSDateUTC(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FusionBeauty//Booking Calendar//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${formatICSDateUTC(event.start)}`);
    lines.push(`DTEND:${formatICSDateUTC(event.end)}`);
    lines.push(`SUMMARY:${escapeICSText(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

function unfoldICSLines(text: string): string[] {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function parseICSDate(value: string): Date | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, zulu] = match;
  const y = Number(year);
  const mo = Number(month) - 1;
  const d = Number(day);

  if (hour === undefined) {
    return new Date(y, mo, d, 0, 0, 0);
  }

  const h = Number(hour);
  const mi = Number(minute);
  const s = Number(second);

  return zulu ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
}

export type ParsedICSEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string | null;
};

export function parseICSEvents(icsText: string): ParsedICSEvent[] {
  const lines = unfoldICSLines(icsText);
  const events: ParsedICSEvent[] = [];
  let current: Partial<ParsedICSEvent> | null = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      current = {};
      continue;
    }

    if (line.startsWith("END:VEVENT")) {
      if (current?.uid && current.start && current.end) {
        events.push({
          uid: current.uid,
          start: current.start,
          end: current.end,
          summary: current.summary ?? null,
        });
      }
      current = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const rawKey = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const key = rawKey.split(";")[0]?.toUpperCase();

    if (key === "UID") {
      current.uid = value.trim();
    } else if (key === "DTSTART") {
      const parsed = parseICSDate(value.trim());
      if (parsed) current.start = parsed;
    } else if (key === "DTEND") {
      const parsed = parseICSDate(value.trim());
      if (parsed) current.end = parsed;
    } else if (key === "SUMMARY") {
      current.summary = unescapeICSText(value.trim());
    }
  }

  return events;
}
