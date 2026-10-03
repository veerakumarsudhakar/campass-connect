export const approvedStatuses = ['APPROVED', 'CURRENTLY_OUT', 'CLEARED'];
export function filterRequests(records, { status = 'all', department = '', year = '', section = '', hostel = '', role = '' } = {}) {
  return records.filter(r => !r.archived
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
  return (!user.institution || record.institution === user.institution)
    && (!user.department || record.department === user.department)
    && (!user.year || Number(record.year) === Number(user.year))
    && (user.role !== 'Class Advisor' || !user.section || record.section === user.section)
    && (!user.hostel || (record.hostel || hostelForGender(record.gender)) === user.hostel);
}
