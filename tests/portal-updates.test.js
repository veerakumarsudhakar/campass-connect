import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES } from '../src/workflow.js';
import { contactError, formatDateTime, gateError, profileForRole, profileError, roleFields } from '../src/profile-policy.js';
import { filterRequests, matchesScope } from '../src/portal-filters.js';
import { parseStudentCsv } from '../src/student-import.js';
import { categoryOf, studentTypeOf, outpassClassificationError, permissionProgress } from '../functions/outpass-policy.js';

test('outpass categories and student types preserve legacy defaults and permission levels',()=>{
  assert.equal(categoryOf({}),'OUTING');assert.equal(studentTypeOf({}),'HOSTELLER');
  for(const category of ['OUTING','EMERGENCY','ON_DUTY'])for(const studentType of ['HOSTELLER','DAY_SCHOLAR'])assert.equal(outpassClassificationError({category,studentType}),'');
  assert.match(outpassClassificationError({category:'BYPASS',studentType:'DAY_SCHOLAR'}),/Choose/);
  assert.match(outpassClassificationError({category:'OUTING',studentType:'STAFF'}),/Choose/);
  assert.equal(permissionProgress({status:'PENDING_PRINCIPAL',approvals:[{role:'Class Advisor',decision:'APPROVED'},{role:'HOD',decision:'APPROVED'}]}).label,'Level 3 of 5 · Principal');
  assert.equal(permissionProgress({status:'REJECTED',approvals:[{role:'Class Advisor',decision:'APPROVED'},{role:'HOD',decision:'REJECTED'}]}).completed,1);
  assert.equal(permissionProgress({status:'CLEARED'}).label,'All permissions granted');
  const rows=[{id:'day',category:'ON_DUTY',studentType:'DAY_SCHOLAR'},{id:'old'}];
  assert.deepEqual(filterRequests(rows,{category:'ON_DUTY',studentType:'DAY_SCHOLAR'}).map(r=>r.id),['day']);
  assert.deepEqual(filterRequests(rows,{category:'OUTING',studentType:'HOSTELLER'}).map(r=>r.id),['old']);
});

test('equivalent parent/student numbers are detected despite country code and spacing', () => {
  assert.match(contactError('+91 98420 12345', '9842012345'), /different/);
  assert.match(contactError('00919842012345', '+91-98420-12345'), /different/);
  assert.match(contactError('123', '9842012345'), /valid/);
  assert.equal(contactError('9842012346', '9842012345'), '');
});

test('role changes discard irrelevant fields and require official contact details', () => {
  const form = { institution:'Engineering',department:'CSE',year:2,section:'A',hostel:'Boys hostel',phone:'9842012345',position:'Administrator' };
  for (const role of [ROLES.HOD,ROLES.PRINCIPAL,ROLES.COUNCILLOR,ROLES.SECURITY,ROLES.ADMIN]) {
    const profile=profileForRole(form,role);
    assert.equal(profile.year,null);
    assert.equal(profile.section,'');
    if (role!==ROLES.HOD) assert.equal(profile.department,'');
    assert.equal(profileError(form,role),'');
    assert.match(profileError({...form,phone:''},role),/mobile/);
  }
  assert.equal(roleFields(ROLES.WARDEN).year,true);
  assert.equal(roleFields(ROLES.WARDEN).department,false);
  assert.equal(profileForRole(form,ROLES.ADMIN).position,'Administrator');
});

test('scope follows role: HOD all years, Principal one institute, hostel teams ignore departments', () => {
  const pass={institution:'Engineering',department:'CSE',year:2,section:'A',gender:'Male'};
  assert.equal(matchesScope(pass,{role:ROLES.HOD,institution:'Engineering',department:'CSE',year:4,section:'Z'}),true);
  assert.equal(matchesScope(pass,{role:ROLES.PRINCIPAL,institution:'Arts',department:'CSE',year:2}),false);
  assert.equal(matchesScope(pass,{role:ROLES.PRINCIPAL,institution:'Engineering',department:'EEE',year:4}),true);
  assert.equal(matchesScope(pass,{role:ROLES.WARDEN,hostel:'Boys hostel',year:2,department:'EEE'}),true);
  assert.equal(matchesScope(pass,{role:ROLES.WARDEN,hostel:'Boys hostel',year:3}),false);
  assert.equal(matchesScope(pass,{role:ROLES.COUNCILLOR,hostel:'Boys hostel',year:4,department:'EEE'}),true);
});

test('gate rejects early, expired and invalid exits; overdue students can return', () => {
  const pass={status:'APPROVED',outAt:'2026-10-05T09:00:00Z',returnAt:'2026-10-05T11:00:00Z'};
  assert.match(gateError(pass,new Date('2026-10-05T08:59:59Z')),/locked/);
  assert.equal(gateError(pass,new Date(pass.outAt)), '');
  assert.match(gateError(pass,new Date(pass.returnAt)),/expired/);
  assert.match(gateError({...pass,returnAt:'bad'},new Date()),/invalid/);
  assert.match(gateError({...pass,archived:true}),/eligible/);
  assert.equal(gateError({...pass,status:'CURRENTLY_OUT'},new Date('2026-10-10')), '');
});

test('date display and date lookup use Indian dates across UTC midnight', () => {
  assert.equal(formatDateTime('2026-10-04T20:00:00Z'),'05/10/2026 · 01:30 am');
  const rows=[{id:'one',status:'APPROVED',outAt:'2026-10-04T20:00:00Z'},{id:'two',status:'APPROVED',outAt:'2026-10-04T10:00:00Z'}];
  assert.deepEqual(filterRequests(rows,{date:'2026-10-05'}).map(r=>r.id),['one']);
});

const header='registerNumber,displayName,institution,department,year,section,gender,studentPhone,parentPhone';
const line='REG1,"Kumar, Arun",Engineering,CSE,2,A,Male,9842012346,9842012345';
test('CSV review handles quoted names, prevents duplicates and validates coverage before upload', () => {
  const csv=header+'\r\n'+line;
  assert.equal(parseStudentCsv(csv)[0].displayName,'Kumar, Arun');
  assert.throws(()=>parseStudentCsv(csv+'\n'+line),/Duplicate/);
  assert.throws(()=>parseStudentCsv(csv,{role:ROLES.ADVISOR,department:'EEE'}),/coverage/);
  assert.throws(()=>parseStudentCsv(csv.replace('9842012346','9842012345')),/different/);
  assert.throws(()=>parseStudentCsv(csv.replace(',Male,',',Unknown,')),/valid/);
  assert.throws(()=>parseStudentCsv(header+'\nREG1,"unterminated'),/unclosed/);
});
