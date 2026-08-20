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

export function timeAgo(iso: string, nowMs: number = Date.now()): string {
  const diff = nowMs - Date.parse(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** SLA state for the review promise: "due in Xh" / "overdue by Xh". */
export function slaLabel(createdAtIso: string, slaHours: number, nowMs: number = Date.now()): {
  label: string;
  overdue: boolean;
} {
  const dueAt = Date.parse(createdAtIso) + slaHours * 3600 * 1000;
  const diff = dueAt - nowMs;
  if (diff <= 0) {
    const h = Math.ceil(-diff / 3600 / 1000);
    return { label: `overdue ${h}h`, overdue: true };
  }
  const h = Math.ceil(diff / 3600 / 1000);
  return { label: `due in ${h}h`, overdue: false };
}
