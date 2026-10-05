import { useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from './firebase';
import { ROLES } from './workflow';
import { ProfileFields } from './ProfileFields';
import { createAdminAccount, saveAdminProfile, adminProfile } from './admin-service';
import { useAcademicCatalog, validateCatalog } from './academic-catalog';
import { SCIENCE_AND_HUMANITIES, formatSections, isCommonFirstYear, isEngineering, isScienceAndHumanities, normalizeCatalog, sectionSpan } from '../functions/academic-policy';
import './admin-workspace.css';

const blank = { displayName:'', email:'', password:'', role:'Student', registerNumber:'', institution:'', department:'', year:'', section:'', hostel:'', studentPhone:'', parentPhone:'', phone:'', position:'', gender:'', studentType:'HOSTELLER', photoUrl:'', approvalStatus:'APPROVED', disabled:false };
const message = error => error.code === 'permission-denied' ? 'This change was denied. Verify that the latest admin rules are deployed.' : error.code === 'auth/email-already-in-use' ? 'An account with this email already exists.' : error.message || 'Could not save this change.';

async function saveCatalog(catalog, demo) {
  const normalized = normalizeCatalog(catalog);
  const invalid = validateCatalog(normalized);
  if (invalid) throw new Error(invalid);
  if (!demo) await setDoc(doc(db, 'settings', 'academic'), { ...normalized, updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp() });
  return normalized;
}

export function UserEditor({ person, currentUser, demo, setUsers, notify, close }) {
  const editing = Boolean(person);
  const [form,setForm] = useState({ ...blank, ...person, role: person?.approvalStatus === 'PENDING' ? person.requestedRole || person.role : person?.role || 'Student', password:'' });
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [shown,setShown] = useState(false);
  const set = (key,value) => setForm(old => ({ ...old, [key]:value }));
  const self = person?.uid === currentUser.uid;
  async function save(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const data = adminProfile(form);
      if (demo) {
        if (setUsers) setUsers(rows => editing ? rows.map(row => row.uid === person.uid ? {...row,...data} : row) : [...rows,{...data,email:form.email,uid:'demo-'+Date.now()}]);
      } else if (editing) await saveAdminProfile(person.uid, form);
      else await createAdminAccount(form);
      notify(editing ? 'Account profile and portal access updated.' : 'User created with approved access.');
      if (editing) close(); else setForm({...blank});
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function reset() { setBusy(true); setError(''); try { if (!demo) await sendPasswordResetEmail(auth,person.email); notify('Password reset email requested.'); } catch(err) { setError(message(err)); } finally { setBusy(false); } }
  return <section className="form-card admin-editor"><div className="panel-head"><div><h3>{editing?'Edit user account':'Create a new user'}</h3><p>{editing?'Update identity, role, assignments, contact details, and portal access.':'Choose a role, assign campus coverage, and create approved access.'}</p></div>{editing&&<button type="button" className="text-btn" onClick={close}>Close</button>}</div><form className="access-grid" onSubmit={save}>
    <label>Full name<input value={form.displayName} onChange={e=>set('displayName',e.target.value)} maxLength={160} required/></label>
    <label>Role<select value={form.role} disabled={self} onChange={e=>set('role',e.target.value)}>{Object.values(ROLES).map(role=><option key={role}>{role}</option>)}</select>{self&&<small>Another administrator must change your role or access.</small>}</label>
    <label>College email<input type="email" value={form.email} readOnly={editing} onChange={e=>set('email',e.target.value)} required/>{editing&&<small>Sign-in email is managed through Firebase Authentication.</small>}</label>
    {!editing&&<label>Temporary password<span className="password-field"><input type={shown?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} minLength={8} autoComplete="new-password" required/><button type="button" onClick={()=>setShown(!shown)}>{shown?'Hide':'Show'}</button></span></label>}
    <label>Register number / staff ID<input value={form.registerNumber} onChange={e=>set('registerNumber',e.target.value)} maxLength={40} required/></label>
    <ProfileFields form={form} set={set} role={form.role}/>
    <label>Profile photo URL<input type="url" value={form.photoUrl} onChange={e=>set('photoUrl',e.target.value)} placeholder="https://…"/></label>
    {editing&&<><label>Approval<select value={form.approvalStatus} disabled={self} onChange={e=>set('approvalStatus',e.target.value)}><option value="APPROVED">Approved</option><option value="PENDING">Pending review</option><option value="REJECTED">Rejected</option><option value="REMOVED">Archived</option></select></label><label>Portal access<select value={form.disabled?'disabled':'enabled'} disabled={self} onChange={e=>set('disabled',e.target.value==='disabled')}><option value="enabled">Enabled when approved</option><option value="disabled">Disabled</option></select></label><p className="admin-help">Archiving or disabling blocks portal access and preserves past passes. Reapprove and enable to restore access.</p></>}
    {error&&<p className="error admin-wide" role="alert">{error}</p>}<div className="admin-form-actions admin-wide"><button className="primary" disabled={busy}>{busy?'Saving…':editing?'Save account changes':'Create approved user'}</button>{editing&&<button type="button" className="secondary" disabled={busy||!person.email} onClick={reset}>Send password reset</button>}</div>
  </form></section>;
}

export function AdminUsers({users,currentUser,demo,setUsers,notify,rolesOnly=false}) {
  const [term,setTerm] = useState(''), [role,setRole] = useState(''), [access,setAccess] = useState(''), [department,setDepartment] = useState(''), [selected,setSelected] = useState(null);
  const departments = [...new Set(users.map(user=>user.department).filter(Boolean))].sort();
  const rows = users.filter(user => (!rolesOnly||user.role!=='Student'||user.requestedRole&&user.requestedRole!=='Student') && (!role||(user.requestedRole||user.role)===role) && (!department||user.department===department) && (!access||(access==='DISABLED'?user.disabled:user.approvalStatus===access)) && [user.displayName,user.email,user.registerNumber].join(' ').toLowerCase().includes(term.toLowerCase()));
  return <section>{selected&&<UserEditor key={selected.uid} person={selected} currentUser={currentUser} demo={demo} setUsers={setUsers} notify={notify} close={()=>setSelected(null)}/>}<section className="panel"><div className="panel-head"><div><h3>{rolesOnly?'Staff roles & coverage':'User accounts & approvals'}</h3><p>{rows.length} accounts · Select an account to edit all profile fields.</p></div></div><div className="filter-bar"><label>Search<input placeholder="Name, email or ID" value={term} onChange={e=>setTerm(e.target.value)}/></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="">All roles</option>{Object.values(ROLES).map(value=><option key={value}>{value}</option>)}</select></label><label>Department<select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All departments</option>{departments.map(value=><option key={value}>{value}</option>)}</select></label><label>Access<select value={access} onChange={e=>setAccess(e.target.value)}><option value="">All access states</option>{['PENDING','APPROVED','REJECTED','REMOVED','DISABLED'].map(value=><option key={value}>{value}</option>)}</select></label></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Role & coverage</th><th>Access</th><th>Action</th></tr></thead><tbody>{rows.map(user=><tr key={user.uid}><td><b>{user.displayName}</b><span>{user.email}</span><span>{user.registerNumber}</span></td><td>{user.requestedRole||user.role}<span>{user.institution}</span><span>{user.department}{user.year?' · Year '+user.year:''}{user.sections?.length?' · '+formatSections(user.sections):user.section?' · '+user.section:''}{user.hostel?' · '+user.hostel:''}</span></td><td><span className="status">{user.disabled?'DISABLED':user.approvalStatus||'PENDING'}</span></td><td><button className="secondary" onClick={()=>setSelected(user)}>Edit / review</button></td></tr>)}</tbody></table>{!rows.length&&<p className="empty">No accounts match these filters.</p>}</div></section></section>;
}

export function AcademicSettings({mode,demo,notify}) {
  const {catalog,setCatalog,error:loadError} = useAcademicCatalog();
  const [draft,setDraft] = useState(()=>structuredClone(catalog));
  const [yearsText,setYearsText] = useState(catalog.years.join(', ')), [sectionsText,setSectionsText] = useState(catalog.sections.join(', '));
  const [name,setName] = useState(''), [department,setDepartment] = useState(''), [selected,setSelected] = useState(0), [busy,setBusy] = useState(false), [error,setError] = useState(''), [dirty,setDirty] = useState(false);
  useEffect(()=>{ if(dirty)return; setDraft(structuredClone(catalog)); setYearsText(catalog.years.join(', ')); setSectionsText(catalog.sections.join(', ')); },[catalog,dirty]);
  const changeDraft = value => { setDirty(true); setDraft(value); };
  const editInstitution = (key,value) => changeDraft(old=>({...old,institutions:old.institutions.map((item,index)=>index===selected?{...item,[key]:value}:item)}));
  async function save(event) { event.preventDefault(); setBusy(true); setError(''); try { const normalized=await saveCatalog({...draft,years:yearsText.split(',').map(value=>Number(value.trim())),sections:sectionsText.split(',').map(value=>value.trim())},demo); setCatalog(normalized); setDraft(normalized); setYearsText(normalized.years.join(', ')); setSectionsText(normalized.sections.join(', ')); setDirty(false); notify('Academic settings saved. Existing accounts and passes retain their assignments.'); }catch(err){setError(message(err));}finally{setBusy(false);} }
  const institution=draft.institutions[selected];
  return <section className="form-card academic-settings"><div className="panel-head"><div><h3>{mode==='years'?'Years & sections':'Institutions & departments'}</h3><p>{mode==='years'?'Choose the years and sections available when creating or editing accounts.':'Add or rename institutions and departments. Science & Humanities for first-year Engineering is managed on its own page.'}</p></div></div><form onSubmit={save}>{mode==='years'?<div className="access-grid"><label>Available years (comma separated)<input value={yearsText} onChange={e=>{setDirty(true);setYearsText(e.target.value)}}/><small>Years 1–8 are supported. Year 1 stays available for common first-year Engineering.</small></label><label>Sections (comma separated)<input value={sectionsText} onChange={e=>{setDirty(true);setSectionsText(e.target.value)}}/></label></div>:<><div className="academic-add"><label>New institution<input value={name} onChange={e=>setName(e.target.value)} maxLength={160}/></label><button type="button" className="secondary" onClick={()=>{const next=name.trim(); if(!next)return setError('Enter an institution name.'); if(draft.institutions.some(item=>item.name.trim().toLowerCase()===next.toLowerCase()))return setError('That institution is already listed.'); changeDraft(old=>({...old,institutions:[...old.institutions,{name:next,departments:[]}]})); setSelected(draft.institutions.length); setName(''); setError('');}}>Add institution</button></div><label>Manage institution<select value={selected} onChange={e=>setSelected(Number(e.target.value))}>{draft.institutions.map((item,index)=><option key={index} value={index}>{item.name}</option>)}</select></label>{institution&&<><div className="academic-add"><label>Institution name<input value={institution.name} onChange={e=>editInstitution('name',e.target.value)} maxLength={160} required/></label><button type="button" className="secondary danger" disabled={draft.institutions.length===1} onClick={()=>{changeDraft(old=>({...old,institutions:old.institutions.filter((_,index)=>index!==selected)})); setSelected(0);}}>Remove option</button></div><div className="academic-add"><label>New department<input value={department} onChange={e=>setDepartment(e.target.value)} maxLength={160}/></label><button type="button" className="secondary" onClick={()=>{const next=department.trim(); if(!next)return; if(institution.departments.some(value=>value.trim().toLowerCase()===next.toLowerCase()||isScienceAndHumanities(value)&&isScienceAndHumanities(next)))return setError('That department is already listed.'); editInstitution('departments',[...institution.departments,next]); setDepartment(''); setError('');}}>Add department</button></div><div className="department-list">{institution.departments.map((value,index)=><div key={index}><input aria-label={'Department '+(index+1)} value={value} onChange={e=>editInstitution('departments',institution.departments.map((old,i)=>i===index?e.target.value:old))} maxLength={160} required/><button type="button" className="text-btn" onClick={()=>editInstitution('departments',institution.departments.filter((_,i)=>i!==index))}>Remove</button></div>)}</div></>}</>}<p className="admin-help">{mode==='years'?'Class Advisors and Year Wardens use these years. S&H advisors and HODs always cover Year 1 only.':'Add '+SCIENCE_AND_HUMANITIES+' to an Engineering college, or use the S&H coverage page to add it to every Engineering institution.'}</p>{(error||loadError)&&<p className="error" role="alert">{error||loadError}</p>}<div className="admin-form-actions"><button className="primary" disabled={busy}>{busy?'Saving…':'Save academic settings'}</button><button type="button" className="secondary" onClick={()=>{setDirty(false); setDraft(structuredClone(catalog)); setYearsText(catalog.years.join(', ')); setSectionsText(catalog.sections.join(', ')); setSelected(0); setError('');}}>Reset unsaved changes</button></div></form></section>;
}

const staffRole = user => user.approvalStatus === 'PENDING' ? user.requestedRole || user.role : user.role;
export function ScienceCoverage({users,currentUser,demo,setUsers,notify}) {
  const {catalog,setCatalog,error:loadError} = useAcademicCatalog();
  const [selected,setSelected] = useState(null), [hodId,setHodId] = useState(''), [from,setFrom] = useState(''), [to,setTo] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const engineering = catalog.institutions.filter(item => isEngineering(item.name));
  const missing = engineering.filter(item => !item.departments.some(isScienceAndHumanities));
  const staff = users.filter(user => isCommonFirstYear({ ...user, role: staffRole(user) }));
  const hods = staff.filter(user => staffRole(user) === 'HOD');
  async function addCoverage() {
    if (!engineering.length) return setError('Add an Engineering institution on the Departments page first.');
    setBusy(true); setError('');
    try {
      const next = { ...catalog, institutions: catalog.institutions.map(item => isEngineering(item.name) && !item.departments.some(isScienceAndHumanities) ? { ...item, departments: [...item.departments, SCIENCE_AND_HUMANITIES] } : item) };
      const normalized = await saveCatalog(next, demo);
      setCatalog(normalized);
      notify('Science & Humanities is available for every Engineering institution.');
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function allocate(event) {
    event.preventDefault(); setError('');
    const hod = hods.find(user => user.uid === hodId);
    const span = sectionSpan(from, to, catalog.sections);
    if (!hod) return setError('Choose an S&H HOD.');
    if (!span.length) return setError('Choose a section range from Years & sections. Add any missing letters there first.');
    setBusy(true);
    try {
      const role = staffRole(hod);
      const form = { ...hod, role, sections: span };
      const data = adminProfile(form);
      if (demo) setUsers?.(rows => rows.map(row => row.uid === hod.uid ? { ...row, ...data } : row));
      else await saveAdminProfile(hod.uid, form);
      notify(`${hod.displayName} now covers sections ${formatSections(span)}.`);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  const coverageLabel = user => staffRole(user) === 'HOD' ? formatSections(user.sections) : user.section ? `Section ${user.section}` : 'All sections';
  return <section>{selected&&<UserEditor key={selected.uid} person={selected} currentUser={currentUser} demo={demo} setUsers={setUsers} notify={notify} close={()=>setSelected(null)}/>}<section className="form-card academic-settings"><div className="panel-head"><div><h3>Science & Humanities · common first year</h3><p>{SCIENCE_AND_HUMANITIES} is the shared Year 1 department for Engineering. Coverage stops there.</p></div></div><ul className="coverage-points"><li>Class Advisors and HODs in this department cover Year 1 students in every Engineering major at their own college.</li><li>A Class Advisor can take one section, or leave section as “All sections”.</li><li>Assign each S&H HOD a section range, such as A–F and F–G. Only those class requests appear for that HOD. A section in both ranges is shared. Year 2 and above stay with the major department.</li><li>Arts, science, and health-science colleges are outside this coverage.</li></ul>{engineering.length?missing.length?<p className="admin-help">Missing from: {missing.map(item=>item.name).join(', ')}.</p>:<p className="admin-help">Every Engineering institution already includes this department.</p>:<p className="admin-help">No Engineering institution is configured yet.</p>}<div className="admin-form-actions"><button type="button" className="primary" disabled={busy||!missing.length} onClick={addCoverage}>{busy?'Saving…':'Add S&H to Engineering'}</button></div><form className="academic-add" onSubmit={allocate}><label>S&H HOD<select value={hodId} onChange={e=>setHodId(e.target.value)} required><option value="">Choose HOD</option>{hods.map(user=><option key={user.uid} value={user.uid}>{user.displayName}</option>)}</select></label><label>From section<select value={from} onChange={e=>setFrom(e.target.value)} required><option value="">From</option>{catalog.sections.map(value=><option key={value}>{value}</option>)}</select></label><label>To section<select value={to} onChange={e=>setTo(e.target.value)} required><option value="">To</option>{catalog.sections.map(value=><option key={'to-'+value}>{value}</option>)}</select></label><button className="secondary" disabled={busy||!hods.length}>{busy?'Saving…':'Assign section range'}</button></form><p className="admin-help">Add letters such as D, E, F and G on Years & sections before assigning a wider range. An HOD with no range sees no class requests.</p>{(error||loadError)&&<p className="error" role="alert">{error||loadError}</p>}<div className="table-wrap"><table className="admin-table"><thead><tr><th>S&H staff</th><th>Coverage</th><th>Access</th><th>Action</th></tr></thead><tbody>{staff.map(user=><tr key={user.uid}><td><b>{user.displayName}</b><span>{user.email}</span><span>{user.registerNumber}</span></td><td>{user.requestedRole||user.role}<span>{user.institution}</span><span>{coverageLabel(user)} · Year 1 only</span></td><td><span className="status">{user.disabled?'DISABLED':user.approvalStatus||'PENDING'}</span></td><td><button className="secondary" onClick={()=>setSelected(user)}>Edit role</button></td></tr>)}</tbody></table>{!staff.length&&<p className="empty">No Class Advisor or HOD is assigned to S&H yet. Create one and choose this department.</p>}</div></section></section>;
}
