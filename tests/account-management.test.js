import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountManager } from '../functions/account-management.js';
function setup(target={active:true,approvalStatus:'APPROVED',role:'Student'}) {
  const records=new Map(Object.entries({'users/admin':{active:true,role:'Admin'},'users/target':target,'students/target':{userId:'target'},'registerNumbers/REG':{uid:'target'},'registerNumbers/OTHER':{uid:'other'},'outpasses/history':{studentId:'target'}}));
  const calls=[];
  const doc=path=>({path,async get(){return {exists:records.has(path),data:()=>records.get(path)}},async update(data){records.set(path,{...records.get(path),...data})},async set(data){records.set(path,data)},async delete(){records.delete(path)}});
  const db={doc,async runTransaction(fn){return fn({get:ref=>ref.get(),update:(ref,data)=>ref.update(data)})},async recursiveDelete(ref){records.delete(ref.path)},collection(name){return {where(key,op,value){return {async get(){return {docs:[...records].filter(([path,data])=>path.startsWith(name+'/')&&data[key]===value).map(([path])=>({ref:doc(path)}))}}}}}}};
  const auth={async deleteUser(uid){calls.push(`delete:${uid}`)},async updateUser(uid,data){calls.push(`disabled:${data.disabled}`)},async revokeRefreshTokens(){calls.push('revoke')}};
  return {records,calls,auth,manage:accountManager({db,auth,timestamp:()=>123})};
}
test('delete removes Auth, profiles and own binding; retains unrelated registrations and history',async()=>{
  const f=setup();await f.manage({callerUid:'admin',uid:'target',action:'delete'});
  assert.ok(f.calls.includes('delete:target'));for(const path of ['users/target','students/target','registerNumbers/REG'])assert.ok(!f.records.has(path));
  assert.ok(f.records.has('registerNumbers/OTHER'));assert.ok(f.records.has('outpasses/history'));assert.equal(f.records.get('accountLocks/target').deleted,true);
});
test('disable revokes sessions and enable restores approved access, including other admins',async()=>{
  const f=setup({active:true,role:'Admin',approvalStatus:'APPROVED'});await f.manage({callerUid:'admin',uid:'target',action:'disable'});
  assert.equal(f.records.get('users/target').active,false);assert.equal(f.records.get('users/target').disabled,true);assert.ok(f.calls.includes('revoke'));
  await f.manage({callerUid:'admin',uid:'target',action:'enable'});assert.equal(f.records.get('users/target').active,true);assert.equal(f.records.get('users/target').disabled,false);
});
test('enabling a pending account never grants approval',async()=>{
  const f=setup({active:false,disabled:true,role:'Student',approvalStatus:'PENDING'});await f.manage({callerUid:'admin',uid:'target',action:'enable'});
  assert.equal(f.records.get('users/target').active,false);assert.equal(f.records.get('users/target').approvalStatus,'PENDING');
});
test('self-management, inactive admins and non-admins cannot manage accounts',async()=>{
  const f=setup();await assert.rejects(f.manage({callerUid:'admin',uid:'admin',action:'delete'}),{code:'failed-precondition'});
  f.records.set('users/admin',{role:'Admin',active:false});await assert.rejects(f.manage({callerUid:'admin',uid:'target',action:'disable'}),{code:'permission-denied'});
  f.records.set('users/admin',{role:'Student',active:true});await assert.rejects(f.manage({callerUid:'admin',uid:'target',action:'delete'}),{code:'permission-denied'});assert.equal(f.calls.length,0);
});
test('failed deletion stays blocked and retry handles an already-deleted Auth account',async()=>{
  const f=setup();f.auth.deleteUser=async()=>{throw Error('temporary failure')};await assert.rejects(f.manage({callerUid:'admin',uid:'target',action:'delete'}),{code:'internal'});
  assert.equal(f.records.get('users/target').active,false);assert.equal(f.records.get('users/target').deletionPending,true);assert.equal(f.records.get('users/target').accountOperation,null);
  await assert.rejects(f.manage({callerUid:'admin',uid:'target',action:'enable'}),{code:'failed-precondition'});
  f.auth.deleteUser=async()=>{throw Object.assign(Error('missing'),{code:'auth/user-not-found'})};await f.manage({callerUid:'admin',uid:'target',action:'delete'});assert.ok(!f.records.has('users/target'));
});
test('concurrent operations are rejected until the current change completes',async()=>{
  const f=setup({accountOperation:{id:'other',expiresAt:Date.now()+120000}});await assert.rejects(f.manage({callerUid:'admin',uid:'target',action:'enable'}),{code:'aborted'});assert.equal(f.calls.length,0);
});
