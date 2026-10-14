const dateOf = value => value?.toDate ? value.toDate() : new Date(value);

export function returnTiming(record, now = new Date()) {
  const expected = dateOf(record?.returnAtTimestamp || record?.returnAt);
  if (!Number.isFinite(expected.getTime())) return { late: false, minutesLate: 0, known: false };
  const minutesLate = Math.max(0, Math.ceil((now.getTime() - expected.getTime()) / 60000));
  return { late: now > expected, minutesLate, known: true };
}

export function returnRemarkError(record, remark, now = new Date()) {
  return returnTiming(record, now).late && !String(remark || '').trim()
    ? 'This student is late. Enter a return remark before recording arrival.'
    : '';
}

export function returnClassification(record) {
  if (!record?.entryAt) return 'unverified';
  if (typeof record.returnLate === 'boolean') return record.returnLate ? 'late' : 'on-time';
  const arrival = dateOf(record.entryAt);
  if (!Number.isFinite(arrival.getTime())) return 'unverified';
  const timing = returnTiming(record, arrival);
  return timing.known ? timing.late ? 'late' : 'on-time' : 'unverified';
}

export function gateCounts(records, now = new Date()) {
  const counts = { approved: 0, outside: 0, overdue: 0, returnedOnTime: 0, returnedLate: 0 };
  for (const record of records) {
    if (record.archived) continue;
    if (record.status === 'APPROVED') counts.approved++;
    if (record.status === 'CURRENTLY_OUT') {
      counts.outside++;
      if (returnTiming(record, now).late) counts.overdue++;
    }
    if (record.status === 'CLEARED') {
      const classification = returnClassification(record);
      if (classification === 'late') counts.returnedLate++;
      if (classification === 'on-time') counts.returnedOnTime++;
    }
  }
  return counts;
}

export function gateView(record, view, now = new Date()) {
  if (record.archived) return false;
  if (view === 'approved') return record.status === 'APPROVED';
  if (view === 'outside') return record.status === 'CURRENTLY_OUT';
  if (view === 'overdue') return record.status === 'CURRENTLY_OUT' && returnTiming(record, now).late;
  if (view === 'on-time') return record.status === 'CLEARED' && returnClassification(record) === 'on-time';
  if (view === 'late') return record.status === 'CLEARED' && returnClassification(record) === 'late';
  return ['APPROVED', 'CURRENTLY_OUT', 'CLEARED'].includes(record.status);
}
