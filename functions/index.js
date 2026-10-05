import { matchesStaffScope as inScope } from './academic-policy.js';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { accountManager, AccountError } from './account-management.js';
import { error as logError } from 'firebase-functions/logger';
import { contactError, profileError, profileForRole, ROLES, roleFields, gateError } from './portal-policy.js';
import { Timestamp } from 'firebase-admin/firestore';
import { outpassClassificationError, studentTypeOf, STUDENT_TYPES } from './outpass-policy.js';
setGlobalOptions({region:'europe-west1'});
initializeApp(); const db=getFirestore(); const adminAuth=getAuth();
const roles={ADVISOR:'Class Advisor',HOD:'HOD',PRINCIPAL:'Principal',WARDEN:'Year Warden',COUNCILLOR:'Resident Councillor',SECURITY:'Security'};
const transitions={PENDING_ADVISOR:{role:roles.ADVISOR,next:'PENDING_HOD'},PENDING_HOD:{role:roles.HOD,next:'PENDING_PRINCIPAL'},PENDING_PRINCIPAL:{role:roles.PRINCIPAL,next:'PENDING_WARDEN'},PENDING_WARDEN:{role:roles.WARDEN,next:'PENDING_COUNCILLOR'},PENDING_COUNCILLOR:{role:roles.COUNCILLOR,next:'APPROVED'}};
async function actor(auth){if(!auth)throw new HttpsError('unauthenticated','Sign in required.');const s=await db.doc(`users/${auth.uid}`).get();if(!s.exists||s.data().active!==true||s.data().disabled||s.data().deletionPending)throw new HttpsError('permission-denied','Account access is unavailable.');return {id:auth.uid,...s.data()}}
const manageAccount = accountManager({db,auth:adminAuth,timestamp:()=>FieldValue.serverTimestamp()});
export const manageUserAccount = onCall(async req => {
  try { return await manageAccount({callerUid:req.auth?.uid,uid:req.data?.uid,action:req.data?.action}); }
  catch(error) {
    logError('Account management failed', {action:req.data?.action||'unknown',code:error.code||'unknown',message:error.message});
    if(error instanceof AccountError)throw new HttpsError(error.code,error.message);
    throw new HttpsError('internal','Account update failed on the server. Please contact the system administrator.');
  }
});
function audit(ref,user,action,from,to,remarks=''){return ref.collection('auditLogs').add({userId:user.id,userName:user.displayName||'',role:user.role,action,previousStatus:from,newStatus:to,remarks,createdAt:FieldValue.serverTimestamp()})}
const clean=(value,max=120)=>String(value||'').trim().slice(0,max);
const mail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const createApprovedAccount=onCall(async req=>{
  const manager=await actor(req.auth);
  if(manager.role!==ROLES.ADMIN)throw new HttpsError('permission-denied','Administrators only.');
  const data=req.data||{},role=data.role,displayName=clean(data.displayName),email=clean(data.email,160).toLowerCase(),registerNumber=clean(data.registerNumber,40).toUpperCase();
  const invalid=profileError(data,role);
  if(!Object.values(ROLES).includes(role)||!displayName||!mail.test(email)||!/^[A-Z0-9_-]+$/.test(registerNumber)||invalid)throw new HttpsError('invalid-argument',invalid||'Enter valid account details.');
  if(typeof data.password!=='string'||data.password.length<8)throw new HttpsError('invalid-argument','Password must contain at least 8 characters.');
  let created;
  try{
    created=await adminAuth.createUser({email,password:data.password,displayName});
    const profile={displayName,email,registerNumber,...profileForRole(data,role),role,requestedRole:role,active:true,approvalStatus:'APPROVED',createdAt:FieldValue.serverTimestamp(),createdBy:manager.id};
    await db.runTransaction(async tx=>{
      const ref=db.doc(`registerNumbers/${registerNumber}`),used=await tx.get(ref);
      if(used.exists)throw new HttpsError('already-exists','This register number / staff ID is already registered.');
      tx.set(ref,{uid:created.uid,createdAt:FieldValue.serverTimestamp()});
      tx.set(db.doc(`users/${created.uid}`),profile);
      if(role===ROLES.STUDENT)tx.set(db.doc(`students/${created.uid}`),{...profile,userId:created.uid});
    });
    return {uid:created.uid};
  }catch(error){if(created)await adminAuth.deleteUser(created.uid).catch(()=>{});if(error instanceof HttpsError)throw error;if(error.code==='auth/email-already-exists')throw new HttpsError('already-exists','An account already exists for this email.');throw new HttpsError('internal','Account creation failed.');}
});
export const setStudentType=onCall(async req=>{
  const manager=await actor(req.auth);if(manager.role!==ROLES.ADMIN)throw new HttpsError('permission-denied','Administrators only.');
  const {uid,studentType}=req.data||{};
  if(typeof uid!=='string'||!uid||uid.includes('/')||!Object.hasOwn(STUDENT_TYPES,studentType))throw new HttpsError('invalid-argument','Choose a valid student and student type.');
  await db.runTransaction(async tx=>{
    const userRef=db.doc('users/'+uid),studentRef=db.doc('students/'+uid);
    const [user,student]=await Promise.all([tx.get(userRef),tx.get(studentRef)]);
    if(!user.exists)throw new HttpsError('not-found','Student profile not found.');
    const profile=user.data(),studentRole=profile.approvalStatus==='PENDING'?(profile.requestedRole||profile.role):profile.role;
    if(studentRole!==ROLES.STUDENT||profile.disabled||profile.deletionPending||profile.accountOperation)throw new HttpsError('failed-precondition','This student account cannot be changed.');
    const changes={studentType,reviewedAt:FieldValue.serverTimestamp()};tx.update(userRef,changes);if(student.exists)tx.update(studentRef,{studentType});
  });return {studentType};
});
export const registerStudent=onCall(async req=>{
  const data=req.data||{},displayName=clean(data.displayName),email=clean(data.email,160).toLowerCase(),registerNumber=clean(data.registerNumber,40).toUpperCase();
  const invalid=profileError(data,ROLES.STUDENT);
  if(!displayName||!mail.test(email)||!/^[A-Z0-9_-]+$/.test(registerNumber)||invalid)throw new HttpsError('invalid-argument',invalid||'Please provide valid student registration details.');
  if(typeof data.password!=='string'||data.password.length<8)throw new HttpsError('invalid-argument','Password must contain at least 8 characters.');
  let created;try{
    created=await adminAuth.createUser({email,password:data.password,displayName});
    const profile={displayName,email,registerNumber,...profileForRole(data,ROLES.STUDENT),role:ROLES.STUDENT,requestedRole:ROLES.STUDENT,active:false,approvalStatus:'PENDING',createdAt:FieldValue.serverTimestamp()};
    await db.runTransaction(async tx=>{const regRef=db.doc('registerNumbers/'+registerNumber),used=await tx.get(regRef);if(used.exists)throw new HttpsError('already-exists','This register number is already registered.');tx.set(regRef,{uid:created.uid,createdAt:FieldValue.serverTimestamp()});tx.set(db.doc('users/'+created.uid),profile);tx.set(db.doc('students/'+created.uid),{...profile,userId:created.uid});});
    return {uid:created.uid};
  }catch(error){if(created)await adminAuth.deleteUser(created.uid).catch(()=>{});if(error instanceof HttpsError)throw error;if(error.code==='auth/email-already-exists')throw new HttpsError('already-exists','An account already exists for this email.');throw new HttpsError('internal','Registration could not be completed.');}
});

export const provisionUser=onCall(async req=>{await actor(req.auth);throw new HttpsError('failed-precondition','Use the administrator Create approved access form to provision accounts.');});

export const createOutpass=onCall(async req=>{
  const u=await actor(req.auth);if(u.role!==ROLES.STUDENT)throw new HttpsError('permission-denied','Students only.');const x=req.data||{};
  const category=x.category||'OUTING',studentType=studentTypeOf(u),classificationError=outpassClassificationError({category,studentType});
  if(classificationError)throw new HttpsError('invalid-argument',classificationError);
  if(x.responsibilityAccepted!==true)throw new HttpsError('invalid-argument','Accept the responsibility declaration.');
  const invalid=contactError(x.studentPhone,x.parentPhone);if(invalid)throw new HttpsError('invalid-argument',invalid);
  const out=new Date(x.outAt),back=new Date(x.returnAt);
  if(!clean(x.reason,600)||!Number.isFinite(out.getTime())||!Number.isFinite(back.getTime())||back<=out||out<new Date())throw new HttpsError('invalid-argument','Enter a reason and a future departure before the return time.');
  if(!u.institution||!u.department)throw new HttpsError('failed-precondition','Your institution and department must be verified first.');
  const ref=db.collection('outpasses').doc(),phones=profileForRole(x,ROLES.STUDENT);
  const record={studentId:u.id,studentName:u.displayName,registerNumber:u.registerNumber,institution:u.institution,department:u.department,year:u.year,gender:u.gender||'',section:u.section||'',photoUrl:u.photoUrl||'',studentPhone:phones.studentPhone,parentPhone:phones.parentPhone,reason:clean(x.reason,600),category,studentType,permissionPolicy:'FULL_APPROVAL',responsibilityAccepted:true,outAt:out.toISOString(),returnAt:back.toISOString(),outAtTimestamp:Timestamp.fromDate(out),returnAtTimestamp:Timestamp.fromDate(back),permissionLetterUrl:clean(x.permissionLetterUrl,2000),permissionLetterName:clean(x.permissionLetterName,200),status:'PENDING_ADVISOR',approvals:[],createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
  await ref.set(record);await audit(ref,u,'SUBMITTED','DRAFT','PENDING_ADVISOR');return {id:ref.id};
});

export const importStudentDirectory=onCall(async req=>{
  const u=await actor(req.auth);if(![roles.ADVISOR,roles.WARDEN].includes(u.role))throw new HttpsError('permission-denied','Only Class Advisors and Year Wardens can upload student details.');
  const rows=Array.isArray(req.data?.students)?req.data.students:[];if(!rows.length||rows.length>500)throw new HttpsError('invalid-argument','Upload between 1 and 500 student rows.');
  const batch=db.batch(),seen=new Set();
  for(const row of rows){
    const registerNumber=clean(row.registerNumber,40).toUpperCase(),displayName=clean(row.displayName),invalid=profileError(row,ROLES.STUDENT);
    if(!/^[A-Z0-9_-]+$/.test(registerNumber)||!displayName||invalid||seen.has(registerNumber))throw new HttpsError('invalid-argument',invalid||'Each student needs a unique, valid ID and name.');
    const record={registerNumber,displayName,...profileForRole(row,ROLES.STUDENT)};
    if(!inScope(record,u))throw new HttpsError('permission-denied','A student is outside your assigned coverage.');
    seen.add(registerNumber);batch.set(db.doc('studentDirectory/'+registerNumber),{...record,updatedBy:u.id,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  }
  await batch.commit();return {count:rows.length};
});

export const processDecision=onCall(async req=>{
  const u=await actor(req.auth);const {outpassId,decision,remarks=''}=req.data||{};
  if(!['APPROVED','REJECTED'].includes(decision)||typeof remarks!=='string')throw new HttpsError('invalid-argument','Invalid decision.');
  if(decision==='REJECTED'&&!remarks.trim())throw new HttpsError('invalid-argument','A rejection reason is required.');
  if(typeof outpassId!=='string'||outpassId.includes('/'))throw new HttpsError('invalid-argument','Invalid pass ID.');
  const ref=db.doc('outpasses/'+outpassId);
  await db.runTransaction(async tx=>{
    const s=await tx.get(ref);if(!s.exists)throw new HttpsError('not-found','Outpass not found.');
    const pass=s.data(),step=transitions[pass.status];if(pass.archived||!step||step.role!==u.role||!inScope(pass,u))throw new HttpsError('permission-denied','You cannot decide on this request at its current stage.');
    const next=decision==='REJECTED'?'REJECTED':(pass.status==='PENDING_HOD'&&studentTypeOf(pass)==='DAY_SCHOLAR'?'APPROVED':step.next),decidedAt=new Date(),comment=clean(remarks,600);
    const entry={role:u.role,approverId:u.id,decision,name:u.displayName||'',at:decidedAt,remarks:comment},updates={status:next,approvals:[...(pass.approvals||[]),entry],updatedAt:FieldValue.serverTimestamp()};
    if(u.role===roles.PRINCIPAL&&decision==='APPROVED')updates.hostel=pass.gender==='Male'?'Boys hostel':pass.gender==='Female'?'Girls hostel':'Hostel assignment required';
    if(next==='APPROVED')updates.passNumber='PASS-'+outpassId.slice(0,8).toUpperCase();
    tx.update(ref,updates);tx.set(ref.collection('approvals').doc(),{role:u.role,approverId:u.id,approverName:u.displayName,decision,remarks:comment,decidedAt});
    tx.set(ref.collection('auditLogs').doc(),{userId:u.id,userName:u.displayName,role:u.role,action:decision,previousStatus:pass.status,newStatus:next,remarks:comment,createdAt:FieldValue.serverTimestamp()});
  });return {ok:true};
});

export const logGateMovement=onCall(async req=>{
  const u=await actor(req.auth);if(u.role!==roles.SECURITY)throw new HttpsError('permission-denied','Security staff only.');
  const {outpassId,action,gate}=req.data||{};if(typeof outpassId!=='string'||!outpassId||outpassId.includes('/')||!['EXIT','RETURN'].includes(action)||!clean(gate,80))throw new HttpsError('invalid-argument','Select a valid pass, movement, and gate.');
  const ref=db.doc('outpasses/'+outpassId);
  await db.runTransaction(async tx=>{
    const s=await tx.get(ref);if(!s.exists)throw new HttpsError('not-found','Pass not found.');const p=s.data();
    if(p.archived||!((action==='EXIT'&&p.status==='APPROVED')||(action==='RETURN'&&p.status==='CURRENTLY_OUT')))throw new HttpsError('failed-precondition','Invalid gate transition.');
    if(action==='EXIT'){
      const invalid=gateError(p);if(invalid)throw new HttpsError('failed-precondition',invalid);
    }
    const next=action==='EXIT'?'CURRENTLY_OUT':'CLEARED',gateName=clean(gate,80);
    tx.update(ref,{status:next,gate:gateName,[action==='EXIT'?'exitAt':'entryAt']:FieldValue.serverTimestamp(),[action==='EXIT'?'exitBy':'entryBy']:u.displayName||'',updatedAt:FieldValue.serverTimestamp()});
    tx.set(ref.collection('gateLogs').doc(),{securityId:u.id,securityName:u.displayName,action,gate:gateName,at:FieldValue.serverTimestamp()});
    tx.set(ref.collection('auditLogs').doc(),{userId:u.id,userName:u.displayName,role:u.role,action,gate:gateName,previousStatus:p.status,newStatus:next,createdAt:FieldValue.serverTimestamp()});
  });return {ok:true};
});
