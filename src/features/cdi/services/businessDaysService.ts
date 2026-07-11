/**
 * businessDaysService — estimativa e cálculo de dias úteis.
 * Não inclui calendário de feriados locais; apenas nacionais fixos + móveis simplificados.
 * Se calendário for insuficiente, consumidor deve avisar limitação.
 */

const BUSINESS_DAYS_PER_YEAR = 252;
const BUSINESS_DAYS_PER_MONTH = 21; // aproximação documentada

/** Feriados nacionais fixos (mês-dia). Móveis (Páscoa, Carnaval, Corpus) omitidos por simplicidade. */
const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1],   // Confraternização
  [4, 21],  // Tiradentes
  [5, 1],   // Trabalho
  [9, 7],   // Independência
  [10, 12], // N. Sra. Aparecida
  [11, 2],  // Finados
  [11, 15], // Proclamação
  [12, 25], // Natal
];

export function estimateBusinessDaysFromMonths(months: number): number {
  if (!Number.isFinite(months) || months < 0) return 0;
  return Math.round(months * BUSINESS_DAYS_PER_MONTH);
}

export function estimateBusinessDaysFromYears(years: number): number {
  if (!Number.isFinite(years) || years < 0) return 0;
  return Math.round(years * BUSINESS_DAYS_PER_YEAR);
}

function isFixedHoliday(d: Date): boolean {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return FIXED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === day);
}

/** Conta dias úteis reais entre duas datas (exclusive endDate se igual). Retorna null se inválido. */
export function countBusinessDaysBetween(start: Date, end: Date): number | null {
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() < start.getTime()) return null;
  let count = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() < stop.getTime()) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6 && !isFixedHoliday(cursor)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/** Dias corridos entre duas datas. */
export function countCalendarDaysBetween(start: Date, end: Date): number | null {
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - start.getTime();
  if (diff < 0) return null;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export const BUSINESS_DAYS_CONSTANTS = {
  BUSINESS_DAYS_PER_YEAR,
  BUSINESS_DAYS_PER_MONTH,
};