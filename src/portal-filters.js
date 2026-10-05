export const approvedStatuses = ['APPROVED', 'CURRENTLY_OUT', 'CLEARED'];
import { dateKey, roleFields } from './profile-policy.js';
import { categoryOf, studentTypeOf } from '../functions/outpass-policy.js';
export function filterRequests(records, { status = 'all', institution = '', department = '', year = '', section = '', hostel = '', date = '', category = '', studentType = '', role = '' } = {}) {
  return records.filter(r => !r.archived
    && (!institution || r.institution === institution)
    && (!date || dateKey(r.outAt) === date)
    && (!category || categoryOf(r) === category)
    && (!studentType || studentTypeOf(r) === studentType)
    && (!department || r.department === department)
    && (!year || String(r.year) === String(year))
    && (!section || r.section === section)
    && (!hostel || (r.hostel || hostelForGender(r.gender)) === hostel)
    && (status === 'all' || (status === 'approved' ? (role ? r.approvals?.some(a=>a.role===role&&a.decision==='APPROVED') : approvedStatuses.includes(r.status))
      : status === 'rejected' ? (role ? r.approvals?.some(a=>a.role===role&&a.decision==='REJECTED') : r.status === 'REJECTED')
      : status === 'progress' ? r.status?.startsWith('PENDING_') : r.status === status)));
}
export function hostelForGender(gender) {
  return gender === 'Male' ? 'Boys hostel' : gender === 'Female' ? 'Girls hostel' : 'Hostel assignment required';
}
export function matchesScope(record, user) {
  const fields = user.role ? roleFields(user.role) : { institution: true, department: true, year: true, section: false, hostel: true };
  return (!fields.institution || !user.institution || record.institution === user.institution)
    && (!fields.department || !user.department || record.department === user.department)
    && (!fields.year || !user.year || Number(record.year) === Number(user.year))
    && (!fields.section || !user.section || record.section === user.section)
    && (!fields.hostel || !user.hostel || (record.hostel || hostelForGender(record.gender)) === user.hostel);
}
