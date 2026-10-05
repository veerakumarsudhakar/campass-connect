import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';
import { doc, collection, getDoc, getDocs, query, where, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { profileForRole, profileError } from './profile-policy';

export function adminProfile(form) {
  const error = profileError(form, form.role);
  if (error) throw new Error(error);
  const registerNumber = String(form.registerNumber || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,40}$/.test(registerNumber)) throw new Error('Enter a valid register number / staff ID (up to 40 characters).');
  const displayName = String(form.displayName || '').trim();
  if (!displayName || displayName.length > 160) throw new Error('Enter a full name (up to 160 characters).');
  const approvalStatus = form.approvalStatus || 'APPROVED';
  const disabled = Boolean(form.disabled);
  return { displayName, registerNumber, ...profileForRole(form, form.role), role: form.role, requestedRole: form.role,
    approvalStatus, active: approvalStatus === 'APPROVED' && !disabled, disabled, deleted: approvalStatus === 'REMOVED',
    photoUrl: String(form.photoUrl || '').trim() };
}

export async function saveAdminProfile(uid, form, creating = false) {
  const data = adminProfile(form);
  const userRef = doc(db, 'users', uid), auditRef = doc(collection(db, 'adminAudit'));
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(userRef);
    if (creating === existing.exists()) throw new Error(creating ? 'An account profile already exists.' : 'This account no longer exists.');
    const previous = existing.data();
    if (previous?.deletionPending || previous?.accountOperation) throw new Error('This account has a backend operation in progress.');
    const reservationRef = doc(db, 'registerNumbers', data.registerNumber);
    const reservation = await transaction.get(reservationRef);
    const oldReservationRef = previous?.registerNumber && previous.registerNumber !== data.registerNumber ? doc(db, 'registerNumbers', previous.registerNumber) : null;
    const oldReservation = oldReservationRef ? await transaction.get(oldReservationRef) : null;
    if (reservation.exists() && reservation.data().uid !== uid) throw new Error('This register number / staff ID is already assigned.');
    if (uid === auth.currentUser.uid && (data.role !== 'Admin' || !data.active)) throw new Error('Keep your own administrator account active.');
    const merged = { ...data, reviewedAt: serverTimestamp(), updatedBy: auth.currentUser.uid };
    if (creating) Object.assign(merged, { email: String(form.email).trim().toLowerCase(), createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
    transaction.set(userRef, merged, { merge: !creating });
    if (!reservation.exists()) transaction.set(reservationRef, { uid, createdAt: serverTimestamp() });
    if (oldReservation?.exists() && oldReservation.data().uid === uid) transaction.delete(oldReservationRef);
    if (data.role === 'Student' || previous?.role === 'Student' || previous?.requestedRole === 'Student') {
      transaction.set(doc(db, 'students', uid), { ...merged, userId: uid, email: creating ? merged.email : previous.email }, { merge: true });
    }
    transaction.set(auditRef, { actorId: auth.currentUser.uid, targetId: uid, action: creating ? 'CREATE_USER' : 'EDIT_USER', at: serverTimestamp(),
      before: previous ? { role: previous.role, registerNumber: previous.registerNumber || '', approvalStatus: previous.approvalStatus || '', disabled: previous.disabled || false } : null,
      after: { role: data.role, registerNumber: data.registerNumber, approvalStatus: data.approvalStatus, disabled: data.disabled } });
  });
  return data;
}

export async function permanentlyDeleteAccount(person) {
  const uid = String(person?.uid || '');
  if (!uid || uid.includes('/')) throw new Error('Choose a valid account.');
  if (!auth.currentUser || uid === auth.currentUser.uid) throw new Error('Another administrator must delete your account.');
  const userRef = doc(db, 'users', uid);
  const lockRef = doc(db, 'accountLocks', uid);
  const [existing, lock] = await Promise.all([getDoc(userRef), getDoc(lockRef)]);
  if (!existing.exists() && !lock.exists()) throw new Error('This account no longer exists.');
  if (existing.exists() && existing.data().accountOperation) throw new Error('This account has an operation in progress. Retry shortly.');
  const profile = existing.exists() ? existing.data() : person;
  const registerNumber = profile.registerNumber || '';
  const [student, session, reservation, passes] = await Promise.all([
    getDoc(doc(db, 'students', uid)),
    getDoc(doc(db, 'portalSessions', uid)),
    registerNumber ? getDoc(doc(db, 'registerNumbers', registerNumber)) : Promise.resolve(null),
    getDocs(query(collection(db, 'outpasses'), where('studentId', '==', uid))),
  ]);
  const extras = [
    ...(student.exists() ? [student.ref] : []),
    ...(session.exists() ? [session.ref] : []),
    ...(reservation?.exists() && reservation.data().uid === uid ? [reservation.ref] : []),
    ...passes.docs.map(item => item.ref),
  ];
  const first = writeBatch(db);
  if (existing.exists()) {
    first.set(lockRef, { deleted: true, createdAt: serverTimestamp(), by: auth.currentUser.uid });
    first.delete(userRef);
    first.set(doc(collection(db, 'adminAudit')), {
      actorId: auth.currentUser.uid, targetId: uid, action: 'DELETE_USER', at: serverTimestamp(),
      before: { role: profile.role || '', registerNumber, approvalStatus: profile.approvalStatus || '', disabled: Boolean(profile.disabled) },
      after: null,
    });
  }
  const room = existing.exists() ? 497 : 500;
  extras.slice(0, room).forEach(ref => first.delete(ref));
  if (existing.exists() || extras.length) await first.commit();
  for (let index = room; index < extras.length; index += 500) {
    const batch = writeBatch(db);
    extras.slice(index, index + 500).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

export async function createAdminAccount(form) {
  adminProfile(form);
  if (form.password.length < 8) throw new Error('Use a temporary password with at least 8 characters.');
  const secondary = initializeApp(auth.app.options, `admin-create-${crypto.randomUUID()}`);
  const secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
  let account;
  try {
    account = (await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password)).user;
    await saveAdminProfile(account.uid, form, true);
    return account.uid;
  } catch (error) {
    if (account) { try { await deleteUser(account); } catch { throw new Error('Profile creation failed and the sign-in account could not be rolled back. Contact the administrator before retrying this email.'); } }
    throw error;
  } finally { await signOut(secondaryAuth).catch(() => {}); await deleteApp(secondary); }
}
