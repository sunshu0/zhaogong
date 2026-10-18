// Round 20 (ADR 0023): dates, times, numbers and money in the interface language. Times are always New Zealand's
// (Pacific/Auckland), as before. The formatters are built once per language and options, not on every render.
// Server Components pass `await serverLang()` (./server), client components `useLang()` (./client).
// Wording around the figures ("3 天前", "/小时", "an hour") belongs in the dictionaries, not here.
import { localeTag, type Lang } from "@/i18n/lang";

export const NZ_TIME_ZONE = "Pacific/Auckland";

type When = Date | number | string;
const toDate = (value: When) => (value instanceof Date ? value : new Date(value));

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A shared Intl.DateTimeFormat for the language; New Zealand time unless the options name another zone.
 * zh: 2026年10月18日 / 10月18日 / 15:05 / 周日; en: 18 Oct 2026 / 18 Oct / 3:05 pm / Sun.
 */
export function dateFormat(lang: Lang, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  const key = `${lang} ${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(localeTag(lang), { timeZone: NZ_TIME_ZONE, ...options });
    dateFormats.set(key, format);
  }
  return format;
}

/** A date (by default 2026年10月18日 / 18 Oct 2026); pass Intl options for other shapes. */
export function formatDate(value: When, lang: Lang, options?: Intl.DateTimeFormatOptions): string {
  return dateFormat(lang, options).format(toDate(value));
}

/** The time of day: 15:05 / 3:05 pm. */
export function formatTime(value: When, lang: Lang): string {
  return dateFormat(lang, { hour: "numeric", minute: "2-digit" }).format(toDate(value));
}

const numberFormats = new Map<string, Intl.NumberFormat>();

/** A shared Intl.NumberFormat for the language. */
export function numberFormat(lang: Lang, options: Intl.NumberFormatOptions = {}) {
  const key = `${lang} ${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(localeTag(lang), options);
    numberFormats.set(key, format);
  }
  return format;
}

/** A count or a figure: 12,345.5. */
export function formatNumber(n: number, lang: Lang): string {
  return numberFormat(lang).format(n);
}

/** Whole amounts without cents, others with two digits: 25, 23.95, 24.50. */
const cents = (amount: number) => (Number.isInteger(amount) ? 0 : 2);

/** An amount without its currency, for pay ranges whose symbol comes from the country (formatPay): 25, 24.50. */
export function formatAmount(amount: number, lang: Lang): string {
  const digits = cents(amount);
  return numberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
}

/** Money with its symbol: $25, $23.95 in both languages (the narrow symbol; NZD unless told otherwise). */
export function formatMoney(amount: number, lang: Lang, currency = "NZD"): string {
  const digits = cents(amount);
  return numberFormat(lang, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}
