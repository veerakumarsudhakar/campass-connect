import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRequests, hostelForGender, matchesScope } from '../src/portal-filters.js';
const records=[
  {id:'pending',status:'PENDING_HOD',department:'CSE',year:2,section:'A',gender:'Female'},
  {id:'approved',status:'APPROVED',department:'CSE',year:2,section:'B',gender:'Male'},
  {id:'returned',status:'CLEARED',department:'EEE',year:3,section:'A'},
  {id:'declined',status:'REJECTED',department:'CSE',year:2,section:'A'},
  {id:'archived',status:'APPROVED',department:'CSE',year:2,archived:true}
];
test('student status views keep approved, pending and declined requests separate',()=>{
  assert.deepEqual(filterRequests(records,{status:'approved'}).map(r=>r.id),['approved','returned']);
  assert.deepEqual(filterRequests(records,{status:'progress'}).map(r=>r.id),['pending']);
  assert.deepEqual(filterRequests(records,{status:'rejected'}).map(r=>r.id),['declined']);
});
test('staff filters combine department, year, section and queue',()=>{
  assert.deepEqual(filterRequests(records,{department:'CSE',year:'2',section:'A',status:'PENDING_HOD'}).map(r=>r.id),['pending']);
  assert.equal(filterRequests(records,{department:'EEE',year:'2'}).length,0);
});
test('hostel routing and scope isolate assigned hostel and year',()=>{
  assert.equal(hostelForGender('Male'),'Boys hostel');
  assert.equal(hostelForGender('Female'),'Girls hostel');
  assert.equal(hostelForGender('Other'),'Hostel assignment required');
  assert.deepEqual(filterRequests(records,{hostel:'Girls hostel'}).map(r=>r.id),['pending']);
  assert.equal(matchesScope(records[0],{hostel:'Girls hostel',year:2,department:'CSE'}),true);
  assert.equal(matchesScope(records[1],{hostel:'Girls hostel',year:2}),false);
  assert.equal(matchesScope(records[0],{department:'EEE'}),false);
});
test('staff decision history includes approvals that are still awaiting later stages',()=>{
  const passes=[{id:'next-stage',status:'PENDING_HOD',approvals:[{role:'Class Advisor',decision:'APPROVED'}]},
    {id:'own-decline',status:'REJECTED',approvals:[{role:'Class Advisor',decision:'REJECTED'}]},
    {id:'later-decline',status:'REJECTED',approvals:[{role:'HOD',decision:'REJECTED'}]}];
  assert.deepEqual(filterRequests(passes,{status:'approved',role:'Class Advisor'}).map(r=>r.id),['next-stage']);
  assert.deepEqual(filterRequests(passes,{status:'rejected',role:'Class Advisor'}).map(r=>r.id),['own-decline']);
});
