const number = new Intl.NumberFormat("ru-RU");
const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 0,
});
const shortDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "short", timeZone: "UTC",
});

export const money = (value: number) => currency.format(value);
export const decimal = (value: number) => number.format(value);

export function plural(n: number, one: string, few: string, many: string) {
  if (n % 100 >= 11 && n % 100 <= 14) return many;
  if (n % 10 === 1) return one;
  return n % 10 >= 2 && n % 10 <= 4 ? few : many;
}

export const nightLabel = (n: number) => n + " " + plural(n, "ночь", "ночи", "ночей");
export const guestLabel = (n: number) => n + " " + plural(n, "гость", "гостя", "гостей");
export const bedLabel = (n: number) => n + " " + plural(n, "место", "места", "мест");
export const dayLabel = (iso: string) => shortDate.format(new Date(iso + "T00:00:00Z"));
