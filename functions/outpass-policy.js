export const OUTPASS_CATEGORIES = { OUTING: 'Outing', EMERGENCY: 'Emergency', ON_DUTY: 'On duty' };
export const STUDENT_TYPES = { HOSTELLER: 'Hosteller', DAY_SCHOLAR: 'Day scholar' };
export const APPROVAL_STEPS = ['Class Advisor', 'HOD', 'Principal', 'Year Warden', 'Resident Councillor'];
export const APPROVAL_STATUSES = ['PENDING_ADVISOR', 'PENDING_HOD', 'PENDING_PRINCIPAL', 'PENDING_WARDEN', 'PENDING_COUNCILLOR'];
export const studentTypeOf = record => record?.studentType || 'HOSTELLER';
export const categoryOf = record => record?.category || 'OUTING';
export function outpassClassificationError(record) {
  if (!Object.hasOwn(OUTPASS_CATEGORIES, record.category)) return 'Choose Outing, Emergency, or On duty.';
  if (!Object.hasOwn(STUDENT_TYPES, studentTypeOf(record))) return 'Choose Hosteller or Day scholar.';
  return '';
}
export function permissionProgress(record) {
  const index = APPROVAL_STATUSES.indexOf(record.status);
  const completed = APPROVAL_STEPS.filter(role => record.approvals?.some(a => a.role === role && a.decision === 'APPROVED')).length;
  if (record.status === 'REJECTED') return { label: 'Permission declined', completed, total: 5 };
  if (['APPROVED', 'CURRENTLY_OUT', 'CLEARED'].includes(record.status)) return { label: 'All permissions granted', completed: 5, total: 5 };
  return { label: index >= 0 ? `Level ${index + 1} of 5 · ${APPROVAL_STEPS[index]}` : 'Awaiting review', completed, total: 5 };
}
