export { roleFields, phoneDigits, validPhone, samePhone, contactError, profileForRole, profileError, gateError } from '../functions/portal-policy.js';

export const toDate = value => value?.toDate ? value.toDate() : new Date(value);
export function dateKey(value) {
  if (!value) return '';
  const date = toDate(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function formatDateTime(value) {
  if (!value) return '—';
  const date = toDate(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(date);
  const part = type => parts.find(p => p.type === type)?.value;
  return `${part('day')}/${part('month')}/${part('year')} · ${part('hour')}:${part('minute')} ${part('dayPeriod')}`;
}
