export const ROLES = {
  STUDENT: 'Student', ADVISOR: 'Class Advisor', HOD: 'HOD', PRINCIPAL: 'Principal',
  WARDEN: 'Year Warden', COUNCILLOR: 'Resident Councillor', SECURITY: 'Security'
};

export const QUEUE_FOR_ROLE = {
  [ROLES.ADVISOR]: 'PENDING_ADVISOR', [ROLES.HOD]: 'PENDING_HOD',
  [ROLES.PRINCIPAL]: 'PENDING_PRINCIPAL', [ROLES.WARDEN]: 'PENDING_WARDEN',
  [ROLES.COUNCILLOR]: 'PENDING_COUNCILLOR'
};

export const STATUS_LABEL = {
  DRAFT: 'Draft', PENDING_ADVISOR: 'Awaiting advisor', PENDING_HOD: 'Awaiting HOD',
  PENDING_PRINCIPAL: 'Awaiting principal', PENDING_WARDEN: 'Awaiting warden',
  PENDING_COUNCILLOR: 'Awaiting councillor', APPROVED: 'Approved for exit',
  CURRENTLY_OUT: 'Currently out', CLEARED: 'Cleared', REJECTED: 'Rejected'
};

export const STEPS = ['Class Advisor', 'HOD', 'Principal', 'Year Warden', 'Resident Councillor'];
export const prettyStatus = (status) => STATUS_LABEL[status] || status?.replaceAll('_', ' ');
