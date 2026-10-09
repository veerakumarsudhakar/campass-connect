import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES } from '../src/workflow.js';
import { contactError, formatDateTime, gateError, profileForRole, profileError, roleFields } from '../src/profile-policy.js';
import { filterRequests, matchesScope } from '../src/portal-filters.js';
import { parseStudentCsv } from '../src/student-import.js';
import { approvalRoute, categoryOf, studentTypeOf, outpassClassificationError, permissionProgress } from '../functions/outpass-policy.js';
import { SCIENCE_AND_HUMANITIES, canonicalDepartment, formatSections, normalizeCatalog, sectionSpan } from '../functions/academic-policy.js';

test('S&H covers first-year Engineering across majors and respects institution and advisor section',()=>{
  const staff={role:'Class Advisor',institution:'STUDY WORLD COLLEGE OF ENGINEERING',department:SCIENCE_AND_HUMANITIES,section:'A',phone:'9842012345'};
  assert.equal(profileError(staff,staff.role),'');
  assert.equal(profileForRole(staff,staff.role).year,1);
  const pass={institution:staff.institution,department:'EEE',year:1,section:'A'};
  assert.equal(matchesScope(pass,staff),true);
  assert.equal(matchesScope({...pass,year:2},staff),false);
  assert.equal(matchesScope({...pass,section:'B'},staff),false);
  assert.equal(matchesScope({...pass,institution:'ARTS'},staff),false);
  assert.equal(matchesScope({...pass,section:'B'},{...staff,section:''}),true);
  assert.equal(matchesScope({...pass,section:'B'},{...staff,role:'HOD'}),false);
  assert.match(profileError({...staff,institution:'Arts'},staff.role),/Engineering/);
  const alias={role:'HOD',institution:'study world college of engineering',department:'s&h',phone:'9842012345'};
  assert.equal(profileError(alias,alias.role),'');
  assert.equal(profileForRole(alias,alias.role).department,SCIENCE_AND_HUMANITIES);
  assert.equal(profileForRole(alias,alias.role).year,1);
  assert.equal(matchesScope({institution:'STUDY WORLD COLLEGE OF ENGINEERING',department:'MECHNICAL ENGINEERING',year:1,section:'C'},alias),false);
  assert.equal(matchesScope({institution:alias.institution,department:'MECHNICAL ENGINEERING',year:1,section:'C'},alias),false);
  const letters=['A','B','C','D','E','F','G'];
  const firstRange=sectionSpan('A','F',letters), secondRange=sectionSpan('G','F',letters);
  assert.deepEqual(firstRange,['A','B','C','D','E','F']);
  assert.deepEqual(secondRange,['F','G']);
  assert.equal(formatSections(firstRange),'A–F');
  const hodA={...alias,sections:firstRange}, hodB={...alias,sections:secondRange};
  const yearOne={institution:alias.institution,department:'MECHNICAL ENGINEERING',year:1};
  assert.equal(matchesScope({...yearOne,section:'B'},hodA),true);
  assert.equal(matchesScope({...yearOne,section:'B'},hodB),false);
  assert.equal(matchesScope({...yearOne,section:'F'},hodA),true);
  assert.equal(matchesScope({...yearOne,section:'F'},hodB),true);
  assert.equal(matchesScope({...yearOne,section:'G'},hodA),false);
  assert.equal(matchesScope({...yearOne,section:'G'},hodB),true);
  assert.equal(matchesScope({institution:alias.institution,department:'MECHNICAL ENGINEERING',year:2,section:'C'},alias),false);
  assert.equal(matchesScope({institution:'STUDY WORLD COLLEGE OF ARTS AND SCIENCE',department:'CSE',year:1,section:'A'},{...alias,institution:'STUDY WORLD COLLEGE OF ARTS AND SCIENCE'}),false);
  const student={role:'Student',institution:'STUDY WORLD COLLEGE OF ENGINEERING',department:'s&h',year:2,section:'A',gender:'Female',studentPhone:'9842012346',parentPhone:'9842012345',studentType:'HOSTELLER'};
  assert.match(profileError(student,student.role),/first-year/);
  assert.equal(profileError({...student,year:1},student.role),'');
  assert.equal(canonicalDepartment('SCIENCE AND HUMANITIES'),SCIENCE_AND_HUMANITIES);
  const catalog=normalizeCatalog({institutions:[{name:' STUDY WORLD COLLEGE OF ENGINEERING ',departments:['CSE','s&h','SCIENCE AND HUMANITIES']}],years:['1','1','2'],sections:['a','A']});
  assert.deepEqual(catalog.institutions[0].departments,['CSE',SCIENCE_AND_HUMANITIES]);
  assert.deepEqual(catalog.years,[1,2]);
  assert.deepEqual(normalizeCatalog({institutions:[{name:'Engineering',departments:['CSE']}],years:[3,4],sections:['A']}).years,[1,3,4]);
  assert.deepEqual(catalog.sections,['A']);
});

test('outpass categories and student types preserve legacy defaults and permission levels',()=>{
  assert.equal(categoryOf({}),'OUTING');assert.equal(studentTypeOf({}),'HOSTELLER');
  for(const category of ['OUTING','EMERGENCY','ON_DUTY','HOLIDAY','LEAVE'])for(const studentType of ['HOSTELLER','DAY_SCHOLAR'])assert.equal(outpassClassificationError({category,studentType}),'');
  assert.equal(approvalRoute({studentType:'DAY_SCHOLAR'}).PENDING_HOD,'APPROVED');
  assert.equal(approvalRoute({studentType:'HOSTELLER'}).PENDING_HOD,'PENDING_PRINCIPAL');
  assert.equal(permissionProgress({status:'PENDING_HOD',studentType:'DAY_SCHOLAR',approvals:[{role:'Class Advisor',decision:'APPROVED'}]}).label,'Level 2 of 2 · HOD');
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
  assert.equal(roleFields(ROLES.WARDEN).year,false);
  assert.match(profileError({...form,wardenCoverage:[]},ROLES.WARDEN),/coverage/);
  assert.deepEqual(profileForRole({...form,wardenCoverage:['ENGINEERING:1','ALLIED_HEALTH:2']},ROLES.WARDEN).wardenCoverage,['ENGINEERING:1','ALLIED_HEALTH:2']);
  assert.equal(roleFields(ROLES.WARDEN).department,false);
  assert.equal(profileForRole(form,ROLES.ADMIN).position,'Administrator');
});

test('scope follows role: HOD all years, Principal one institute, hostel teams ignore departments', () => {
  const pass={institution:'Engineering',department:'CSE',year:2,section:'A',gender:'Male'};
  assert.equal(matchesScope(pass,{role:ROLES.HOD,institution:'Engineering',department:'CSE',year:4,section:'Z'}),true);
  assert.equal(matchesScope(pass,{role:ROLES.PRINCIPAL,institution:'Arts',department:'CSE',year:2}),false);
  assert.equal(matchesScope(pass,{role:ROLES.PRINCIPAL,institution:'Engineering',department:'EEE',year:4}),true);
  const deputy={role:ROLES.WARDEN,hostel:'Boys hostel',wardenCoverage:['ENGINEERING:2','ALLIED_HEALTH:3']};
  assert.equal(matchesScope(pass,deputy),true);
  assert.equal(matchesScope({...pass,year:3},deputy),false);
  assert.equal(matchesScope({...pass,institution:'STUDY WORLD COLLEGE OF ALLIED AND HEALTH SCIENCE',year:3},deputy),true);
  assert.equal(matchesScope({...pass,institution:'STUDY WORLD COLLEGE OF ARTS AND SCIENCE'},deputy),false);
  assert.equal(matchesScope({...pass,gender:'Female'},deputy),false);
  assert.equal(matchesScope(pass,{role:ROLES.COUNCILLOR,hostel:'Boys hostel',year:4,department:'EEE'}),true);
  assert.equal(matchesScope({...pass,gender:'Female'},{role:ROLES.COUNCILLOR,hostel:'Boys hostel'}),false);
});

test('gate rejects early, expired and invalid exits; overdue students can return', () => {
  const pass={status:'APPROVED',outAt:'2026-10-05T09:00:00Z',returnAt:'2026-10-05T11:00:00Z'};
  assert.match(gateError(pass,new Date('2026-10-05T08:59:59Z')),/locked/);
  assert.equal(gateError(pass,new Date(pass.outAt)), '');
  assert.equal(gateError(pass,new Date(pass.returnAt)), '');
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

test('alternate parent contact is optional, distinct and saved',()=>{
 const student={institution:'Engineering',department:'CSE',year:2,section:'A',gender:'Male',studentPhone:'9842012346',parentPhone:'9842012345',studentType:'HOSTELLER'};
 assert.equal(profileError(student,ROLES.STUDENT),'');
 assert.match(profileError({...student,alternateParentPhone:student.parentPhone},ROLES.STUDENT),/alternate/);
 assert.equal(profileForRole({...student,alternateParentPhone:'+91 9842012347'},ROLES.STUDENT).alternateParentPhone,'9842012347');
});
