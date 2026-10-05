import { useEffect, useState } from 'react';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const LEASE_MS = 90000;
let currentSession;
let releaseTabLock;
const sessionKey = uid => `campuspass-session-${uid}`;
function tabSessionId(uid) {
  let id = sessionStorage.getItem(sessionKey(uid));
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(sessionKey(uid), id); }
  return id;
}

export async function releasePortalSession() {
  const session = currentSession;
  currentSession = null;
  try {
    if (session && auth?.currentUser?.uid === session.uid) {
      await runTransaction(db, async tx => {
        const ref = doc(db, 'portalSessions', session.uid), snap = await tx.get(ref);
        if (snap.exists() && snap.data().sessionId === session.id) tx.delete(ref);
      });
    }
  } finally {
    releaseTabLock?.(); releaseTabLock = null;
  }
}

export function usePortalSession(uid, enabled) {
  const [state, setState] = useState({ uid: null, ready: false, error: '' });
  useEffect(() => {
    if (!enabled || !uid) { setState({ uid: null, ready: false, error: '' }); return; }
    let stopped = false, timer, releaseLock;
    const id = tabSessionId(uid);
    const ref = doc(db, 'portalSessions', uid);
    async function claim() {
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref), old = snap.data();
        if (snap.exists() && old.sessionId !== id && old.expiresAt.toMillis() > Date.now()) throw new Error('This account is already in use. Sign out on the other device before signing in here.');
        tx.set(ref, { sessionId: id, expiresAt: Timestamp.fromMillis(Date.now() + LEASE_MS) });
      });
    }
    async function renew() {
      if (stopped || !currentSession || currentSession.id !== id) return;
      try { await claim(); }
      catch (error) { if (!stopped) setState({ uid, ready: false, error: error.message || 'Your session could not be verified. Sign in again.' }); }
    }
    function resume() { if (document.visibilityState === 'visible') renew(); }
    async function start() {
      try {
        // Web Locks prevents duplicated tabs from sharing a copied sessionStorage ID.
        if (navigator.locks) {
          await new Promise((resolve, reject) => {
            navigator.locks.request(`campuspass-${uid}`, { ifAvailable: true }, async lock => {
              if (stopped) { resolve(); return; }
              if (!lock) { reject(new Error('This account is already open in another tab. Sign out there first.')); return; }
              const held = new Promise(done => { releaseLock = done; });
              resolve(); await held;
            }).catch(reject);
          });
        }
        if (stopped) { releaseLock?.(); return; }
        await claim();
        if (stopped) { releaseLock?.(); return; }
        currentSession = { uid, id }; releaseTabLock = releaseLock;
        setState({ uid, ready: true, error: '' });
        timer = setInterval(renew, 25000);
        document.addEventListener('visibilitychange', resume);
      } catch (error) { releaseLock?.(); if (!stopped) setState({ uid, ready: false, error: error.message || 'Session verification failed.' }); }
    }
    start();
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', resume); releaseLock?.(); };
  }, [uid, enabled]);
  return { ready: state.uid === uid && state.ready, error: state.uid === uid ? state.error : '' };
}
