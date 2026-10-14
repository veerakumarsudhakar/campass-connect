import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateCounts, gateView, returnClassification, returnRemarkError, returnTiming } from '../functions/gate-policy.js';

test('security counts approved, outside, overdue, and actual return timing', () => {
  const now = new Date('2026-10-14T15:00:00Z');
  const records = [
    { status: 'APPROVED', returnAt: '2026-10-14T18:00:00Z' },
    { status: 'CURRENTLY_OUT', returnAt: '2026-10-14T14:45:00Z' },
    { status: 'CURRENTLY_OUT', returnAt: '2026-10-14T16:00:00Z' },
    { status: 'CLEARED', returnAt: '2026-10-14T14:30:00Z', entryAt: '2026-10-14T14:29:00Z' },
    { status: 'CLEARED', returnAt: '2026-10-14T14:30:00Z', entryAt: '2026-10-14T14:31:00Z', returnRemark: 'Bus delay' },
    { status: 'CLEARED', returnAt: '2026-10-14T14:30:00Z' },
    { status: 'CURRENTLY_OUT', returnAt: '2026-10-14T14:00:00Z', archived: true },
  ];
  assert.deepEqual(gateCounts(records, now), { approved: 1, outside: 2, overdue: 1, returnedOnTime: 1, returnedLate: 1 });
  assert.equal(records.filter(record => gateView(record, 'overdue', now)).length, 1);
  assert.equal(records.filter(record => gateView(record, 'late', now)).length, 1);
  assert.equal(returnClassification(records[5]), 'unverified');
});

test('late return uses approved deadline and supports Firestore timestamps', () => {
  const deadline = new Date('2026-10-14T14:30:00Z');
  const record = { returnAtTimestamp: { toDate: () => deadline } };
  assert.equal(returnTiming(record, deadline).late, false);
  assert.deepEqual(returnTiming(record, new Date('2026-10-14T14:31:01Z')), { late: true, minutesLate: 2, known: true });
  assert.equal(returnClassification({ ...record, entryAt: { toDate: () => new Date('2026-10-14T14:31:00Z') } }), 'late');
  assert.equal(returnClassification({ ...record, entryAt: new Date('2026-10-14T14:31:00Z'), returnLate: false }), 'on-time');
  assert.match(returnRemarkError(record, '  ', new Date('2026-10-14T14:31:00Z')), /remark/);
  assert.equal(returnRemarkError(record, 'Bus delay', new Date('2026-10-14T14:31:00Z')), '');
  assert.equal(returnRemarkError(record, '', deadline), '');
});

test('a confirmed exit immediately moves one pass between summary counts', () => {
  const now = new Date('2026-10-14T15:00:00Z');
  const passes = ['one','two','three'].map(id => ({ id, status: 'APPROVED', returnAt: '2026-10-14T18:00:00Z' }));
  assert.deepEqual([gateCounts(passes,now).approved,gateCounts(passes,now).outside], [3,0]);
  const confirmed = passes.map(pass => pass.id === 'three' ? { ...pass, status: 'CURRENTLY_OUT', exitAt: now } : pass);
  assert.deepEqual([gateCounts(confirmed,now).approved,gateCounts(confirmed,now).outside], [2,1]);
  assert.equal(confirmed.filter(pass => gateView(pass,'outside',now)).length,1);
});
