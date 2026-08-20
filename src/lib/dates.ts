// Manila clock helpers. `now` is injectable for deterministic tests.
export function manilaDayStartUTC(nowMs: number = Date.now()): number {
  const manila = new Date(nowMs + 8 * 3600 * 1000);
  manila.setUTCHours(0, 0, 0, 0);
  return manila.getTime() - 8 * 3600 * 1000;
}

export function isTodayUTC(iso: string, nowMs: number = Date.now()): boolean {
  const start = manilaDayStartUTC(nowMs);
  const ts = Date.parse(iso);
  return ts >= start && ts < start + 24 * 3600 * 1000;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function manilaParts(ms: number) {
  const d = new Date(ms + 8 * 3600 * 1000);
  return {
    day: DAYS[d.getUTCDay()],
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

/**
 * Design C4: a hard deadline, humanized — "by tomorrow 10:19 AM".
 * Always in Manila time (UTC+8, no DST).
 */
export function formatDeadline(ms: number, nowMs: number = Date.now()): string {
  const { day, hours, minutes } = manilaParts(ms);
  const { day: today } = manilaParts(nowMs);
  const { day: tomorrow } = manilaParts(nowMs + 24 * 3600 * 1000);

  const when = day === today ? "today" : day === tomorrow ? "tomorrow" : `on ${day}`;
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const ampm = hours < 12 ? "AM" : "PM";
  const mm = String(minutes).padStart(2, "0");
  return `by ${when} ${h12}:${mm} ${ampm}`;
}
