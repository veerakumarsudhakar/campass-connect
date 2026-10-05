export const OUTPASS_CATEGORIES = { OUTING: 'Outing', EMERGENCY: 'Emergency', ON_DUTY: 'On duty', HOLIDAY: 'Holiday', LEAVE: 'Leave' };
export const STUDENT_TYPES = { HOSTELLER: 'Hosteller', DAY_SCHOLAR: 'Day scholar' };
export const APPROVAL_STEPS = ['Class Advisor', 'HOD', 'Principal', 'Year Warden', 'Resident Councillor'];
export const APPROVAL_STATUSES = ['PENDING_ADVISOR', 'PENDING_HOD', 'PENDING_PRINCIPAL', 'PENDING_WARDEN', 'PENDING_COUNCILLOR'];
const STATUS_BY_STEP = { 'Class Advisor':'PENDING_ADVISOR', HOD:'PENDING_HOD', Principal:'PENDING_PRINCIPAL', 'Year Warden':'PENDING_WARDEN', 'Resident Councillor':'PENDING_COUNCILLOR' };
export const studentTypeOf = record => record?.studentType || 'HOSTELLER';
export const categoryOf = record => record?.category || 'OUTING';
export const approvalSteps = record => studentTypeOf(record) === 'DAY_SCHOLAR' ? ['Class Advisor', 'HOD'] : APPROVAL_STEPS;
export function approvalRoute(record) {
  const day = studentTypeOf(record) === 'DAY_SCHOLAR';
  return { PENDING_ADVISOR:'PENDING_HOD', PENDING_HOD: day ? 'APPROVED' : 'PENDING_PRINCIPAL', PENDING_PRINCIPAL:'PENDING_WARDEN', PENDING_WARDEN:'PENDING_COUNCILLOR', PENDING_COUNCILLOR:'APPROVED' };
}
export function outpassClassificationError(record) {
  if (!Object.hasOwn(OUTPASS_CATEGORIES, record.category)) return 'Choose Outing, Emergency, On duty, Holiday, or Leave.';
  if (!Object.hasOwn(STUDENT_TYPES, studentTypeOf(record))) return 'Choose Hosteller or Day scholar.';
  return '';
}
export function permissionProgress(record) {
  const steps = approvalSteps(record);
  const index = steps.map(step => STATUS_BY_STEP[step]).indexOf(record.status);
  const completed = steps.filter(role => record.approvals?.some(a => a.role === role && a.decision === 'APPROVED')).length;
  const total = steps.length;
  if (record.status === 'REJECTED') return { label: 'Permission declined', completed, total };
  if (['APPROVED', 'CURRENTLY_OUT', 'CLEARED'].includes(record.status)) return { label: total === APPROVAL_STEPS.length ? 'All permissions granted' : 'Outpass generated', completed: total, total };
  return { label: index >= 0 ? `Level ${index + 1} of ${total} · ${steps[index]}` : 'Awaiting review', completed, total };
}
