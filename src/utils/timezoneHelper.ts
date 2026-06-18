export function getNairobiDateStr(isoStringOrDate: string | Date): string {
  try {
    const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
    if (isNaN(date.getTime())) {
      throw new Error('Invalid Date');
    }
    // Nairobi is UTC+3. Add 3 hours to the UTC timestamp to find local Nairobi time.
    const nairobiTime = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const y = nairobiTime.getUTCFullYear();
    const m = String(nairobiTime.getUTCMonth() + 1).padStart(2, '0');
    const d = String(nairobiTime.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return typeof isoStringOrDate === 'string' ? isoStringOrDate.substring(0, 10) : '';
  }
}

export function getNairobiToday() {
  const now = new Date();
  const todayStr = getNairobiDateStr(now);
  const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
  const nairobiNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return { todayStr, currentMonthStr, nairobiNow };
}
