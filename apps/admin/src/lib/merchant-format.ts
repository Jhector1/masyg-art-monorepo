/** Pure formatting helpers shared by server routes and client components. */
export function money(value: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100); }
  catch { return `${currency} ${(value / 100).toFixed(2)}`; }
}
export function dateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
}
