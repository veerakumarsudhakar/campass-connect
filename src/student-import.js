import { contactError } from './profile-policy.js';
import { matchesScope } from './portal-filters.js';
import { STUDENT_TYPES } from '../functions/outpass-policy.js';

export function parseStudentCsv(text, user) {
  const rows = [];
  let row = [], value = '', quoted = false;
  const input = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { value += '"'; i++; }
      else if (!quoted && value.trim()) throw new Error('Unexpected quote in CSV.');
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(value.trim()); value = '';
      if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (c === '\r' && input[i + 1] === '\n') i++; }
    } else value += c;
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  const [headers, ...data] = rows;
  const required = ['registerNumber', 'displayName', 'institution', 'department', 'year', 'section', 'gender', 'studentPhone', 'parentPhone'];
  if (!headers || required.some(key => !headers.includes(key))) throw new Error(`CSV must include: ${required.join(', ')}.`);
  if (new Set(headers).size !== headers.length) throw new Error('CSV column names must be unique.');
  if (!data.length || data.length > 500) throw new Error('Upload between 1 and 500 student rows.');
  const seen = new Set();
  return data.map((cells, i) => {
    if (cells.length !== headers.length) throw new Error(`Row ${i + 2} has the wrong number of columns.`);
    const record = Object.fromEntries(required.map(key => [key, cells[headers.indexOf(key)]]));
    record.studentType = headers.includes('studentType') ? cells[headers.indexOf('studentType')] : 'HOSTELLER';
    if (!Object.hasOwn(STUDENT_TYPES, record.studentType)) throw new Error(`Row ${i + 2}: studentType must be HOSTELLER or DAY_SCHOLAR.`);
    record.registerNumber = record.registerNumber.toUpperCase(); record.year = Number(record.year);
    const error = contactError(record.studentPhone, record.parentPhone);
    if (required.some(key => !record[key]) || ![1, 2, 3, 4].includes(record.year) || !['Female', 'Male', 'Other'].includes(record.gender) || error) throw new Error(`Row ${i + 2}: ${error || 'Complete all student fields with a valid year and gender.'}`);
    if (!/^[A-Z0-9_-]+$/.test(record.registerNumber)) throw new Error(`Row ${i + 2}: Invalid register number.`);
    if (seen.has(record.registerNumber)) throw new Error(`Row ${i + 2}: Duplicate register number ${record.registerNumber}.`);
    if (user && !matchesScope(record, user)) throw new Error(`Row ${i + 2} is outside your assigned coverage.`);
    seen.add(record.registerNumber);
    return record;
  });
}
