import { ROLES } from '../functions/portal-policy.js';
import { APPROVAL_STEPS } from '../functions/outpass-policy.js';
export { ROLES };

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

export const STEPS = APPROVAL_STEPS;
export const prettyStatus = (status) => STATUS_LABEL[status] || status?.replaceAll('_', ' ');
