export function manilaDayStartUTC(): number {
  // Manila is UTC+8, no DST. "Today" boundary in the user's clock.
  const manila = new Date(Date.now() + 8 * 3600 * 1000);
  manila.setUTCHours(0, 0, 0, 0);
  return manila.getTime() - 8 * 3600 * 1000;
}

export function isTodayUTC(iso: string): boolean {
  return Date.parse(iso) >= manilaDayStartUTC();
}
