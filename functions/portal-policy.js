export const ROLES = { STUDENT: 'Student', ADVISOR: 'Class Advisor', HOD: 'HOD', PRINCIPAL: 'Principal', WARDEN: 'Year Warden', COUNCILLOR: 'Resident Councillor', SECURITY: 'Security', ADMIN: 'Admin' };
import { canonicalDepartment, isCommonFirstYear, isEngineering, isScienceAndHumanities } from './academic-policy.js';
import { STUDENT_TYPES, studentTypeOf } from './outpass-policy.js';

export function roleFields(role) {
  return {
    institution: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.HOD, ROLES.PRINCIPAL].includes(role),
    department: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.HOD].includes(role),
    year: [ROLES.STUDENT, ROLES.ADVISOR, ROLES.WARDEN].includes(role),
    section: [ROLES.STUDENT, ROLES.ADVISOR].includes(role),
    hostel: [ROLES.WARDEN, ROLES.COUNCILLOR].includes(role),
    position: role === ROLES.ADMIN,
  };
}

export const phoneDigits = value => String(value || '').replace(/\D/g, '').replace(/^(?:0091|91)(?=\d{10}$)/, '');
export const validPhone = value => /^[6-9]\d{9}$/.test(phoneDigits(value));
export const samePhone = (a, b) => !!phoneDigits(a) && phoneDigits(a) === phoneDigits(b);

export function contactError(studentPhone, parentPhone) {
  if (!validPhone(studentPhone) || !validPhone(parentPhone)) return 'Enter valid 10-digit Indian student and parent mobile numbers.';
  if (samePhone(studentPhone, parentPhone)) return 'Student and parent mobile numbers must be different.';
  return '';
}

export function profileForRole(form, role) {
  const fields = roleFields(role);
  return {
    institution: fields.institution ? form.institution || '' : '',
    department: fields.department ? canonicalDepartment(form.department) : '',
    year: isCommonFirstYear({...form,role}) ? 1 : fields.year ? Number(form.year) || null : null,
    section: fields.section ? String(form.section || '').trim() : '',
    hostel: fields.hostel ? form.hostel || '' : '',
    position: fields.position ? String(form.position || '').trim() : '',
    gender: role === ROLES.STUDENT ? form.gender || '' : '',
    studentType: role === ROLES.STUDENT ? studentTypeOf(form) : '',
    studentPhone: role === ROLES.STUDENT ? phoneDigits(form.studentPhone) : '',
    parentPhone: role === ROLES.STUDENT ? phoneDigits(form.parentPhone) : '',
    phone: role === ROLES.STUDENT ? '' : phoneDigits(form.phone),
  };
}

export function profileError(form, role) {
  const fields = roleFields(role), common = isCommonFirstYear({...form,role});
  if (!Object.values(ROLES).includes(role)) return 'Choose a valid role.';
  if (common && !isEngineering(form.institution)) return 'S&H common-year coverage requires an Engineering institution.';
  for (const key of ['institution', 'department', 'year', 'section', 'hostel', 'position']) {
    if (fields[key] && !(common && ['year','section'].includes(key)) && !String(form[key] || '').trim()) return `Please provide ${key}.`;
  }
  if (fields.year && !common && (!Number.isInteger(Number(form.year)) || Number(form.year)<1 || Number(form.year)>8)) return 'Choose a year from 1 to 8.';
  if (role === ROLES.STUDENT && isScienceAndHumanities(form.department) && (!isEngineering(form.institution) || Number(form.year) !== 1)) return 'Science and Humanities is the common first-year Engineering department.';
  if (role === ROLES.STUDENT) return !Object.hasOwn(STUDENT_TYPES, studentTypeOf(form)) ? 'Choose Hosteller or Day scholar.' : !form.gender ? 'Choose gender.' : contactError(form.studentPhone, form.parentPhone);
  return validPhone(form.phone) ? '' : 'Enter a valid 10-digit official mobile number.';
}

export function gateError(record, now = new Date()) {
  if (!record || !['APPROVED', 'CURRENTLY_OUT'].includes(record.status) || record.archived) return 'This pass is not eligible for gate movement.';
  if (record.status === 'CURRENTLY_OUT') return '';
  const parse = value => value?.toDate ? value.toDate() : new Date(value);
  const out = parse(record.outAtTimestamp || record.outAt), back = parse(record.returnAtTimestamp || record.returnAt);
  if (!Number.isFinite(out.getTime()) || !Number.isFinite(back.getTime()) || back <= out) return 'This pass has invalid travel dates.';
  if (now < out) return 'Exit is locked until the approved out time.';
  if (now >= back) return 'This pass has expired and cannot be used for exit.';
  return '';
}

