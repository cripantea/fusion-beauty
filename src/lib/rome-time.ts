/**
 * Giorni in ora italiana: il server gira in UTC, ma "oggi" per il centro va
 * dalla mezzanotte alla mezzanotte di Roma (ora legale compresa).
 */
const TIME_ZONE = "Europe/Rome";

export function romeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Istante della mezzanotte italiana di quel giorno (month 1-12; day può sforare, come Date.UTC). */
export function romeMidnight(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const got = romeParts(guess);
  const offsetMinutes = got.hour * 60 + got.minute;
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

/** Inizio e fine (inclusa) del giorno italiano di `date`, spostato di `offsetDays`. */
export function romeDayRange(date: Date = new Date(), offsetDays = 0): { start: Date; end: Date } {
  const { year, month, day } = romeParts(date);
  const start = romeMidnight(year, month, day + offsetDays);
  const end = new Date(romeMidnight(year, month, day + offsetDays + 1).getTime() - 1);
  return { start, end };
}
