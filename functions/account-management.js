import { randomUUID } from 'node:crypto';

export class AccountError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Auth and Firestore are injected so failure recovery can be tested without live accounts.
export function accountManager({ db, auth, timestamp }) {
  return async function manage({ callerUid, uid, action }) {
    if (!callerUid) throw new AccountError('unauthenticated', 'Sign in required.');
    if (typeof uid !== 'string' || !uid || uid.includes('/') || !['delete', 'disable', 'enable'].includes(action)) {
      throw new AccountError('invalid-argument', 'Choose a valid account and action.');
    }
    if (uid === callerUid) throw new AccountError('failed-precondition', 'Another administrator must manage your account.');
    const ref = db.doc(`users/${uid}`), operationId = randomUUID();
    const profile = await db.runTransaction(async tx => {
      const [caller, target] = await Promise.all([tx.get(db.doc(`users/${callerUid}`)), tx.get(ref)]);
      if (!caller.exists || caller.data().role !== 'Admin' || caller.data().active !== true || caller.data().disabled || caller.data().deletionPending) {
        throw new AccountError('permission-denied', 'Only active administrators can manage accounts.');
      }
      if (!target.exists) throw new AccountError('not-found', 'Account profile not found.');
      const person = target.data();
      if (person.accountOperation?.expiresAt > Date.now()) throw new AccountError('aborted', 'This account is already being updated. Please retry shortly.');
      if (person.deletionPending && action !== 'delete') throw new AccountError('failed-precondition', 'Account deletion is incomplete. Retry Delete account.');
      tx.update(ref, { accountOperation: { id: operationId, expiresAt: Date.now() + 120000 },
        ...(action !== 'enable' ? { active: false } : {}),
        ...(action === 'delete' ? { deletionPending: true } : {}) });
      return person;
    });
    try {
      if (action === 'delete') {
        // Prevent still-valid tokens from recreating the deleted UID's profile.
        await db.doc(`accountLocks/${uid}`).set({ deleted: true, createdAt: timestamp(), by: callerUid });
        try { await auth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
        const bindings = await db.collection('registerNumbers').where('uid', '==', uid).get();
        for (const binding of bindings.docs) await binding.ref.delete();
        await db.recursiveDelete(db.doc(`students/${uid}`));
        await db.recursiveDelete(ref);
        return { deleted: true };
      }
      const disabled = action === 'disable';
      await auth.updateUser(uid, { disabled });
      if (disabled) await auth.revokeRefreshTokens(uid);
      const active = !disabled && profile.approvalStatus === 'APPROVED';
      await ref.update({ disabled, active, reviewedAt: timestamp(), reviewedBy: callerUid });
      const studentRef = db.doc(`students/${uid}`);
      if ((await studentRef.get()).exists) await studentRef.update({ disabled, active });
      return { disabled, active };
    } catch (error) {
      if (error instanceof AccountError) throw error;
      // A failed delete stays blocked; retry safely completes missing cleanup.
      throw new AccountError('internal', `Account ${action} could not be completed. Please retry. ${action === 'enable' ? '' : 'Portal access remains blocked.'}`.trim());
    } finally {
      await db.runTransaction(async tx => {
        const target = await tx.get(ref);
        if (target.exists && target.data().accountOperation?.id === operationId) tx.update(ref, { accountOperation: null });
      });
    }
  };
}
