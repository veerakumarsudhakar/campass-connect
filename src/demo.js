import { ROLES } from './workflow';

export const demoUser = { uid: 'demo-student', role: ROLES.STUDENT, displayName: 'Aarav Krishnan', registerNumber: '22CSE104', institution: 'STUDY WORLD COLLEGE OF ENGINEERING', department: 'COMPUTER SCIENCE AND ENGINEERING', year: 3, section: 'A', gender: 'Male', studentPhone: '9842012346', parentPhone: '9842012345' };
export const demoPasses = [
  { id: 'OP-0247', passNumber: 'PASS #0247', studentName: 'Aarav Krishnan', registerNumber: '22CSE104', department: 'Computer Science', year: 3, reason: 'Family function', destination: 'Coimbatore', outAt: '2026-08-23T08:00', returnAt: '2026-08-24T18:00', status: 'PENDING_WARDEN', approvals: [{role:'Class Advisor', decision:'APPROVED', name:'Dr. Meera Nair', at:'2026-08-21T09:20'}, {role:'HOD', decision:'APPROVED', name:'Dr. Rajesh Kumar', at:'2026-08-21T11:12'}, {role:'Principal', decision:'APPROVED', name:'Dr. Latha Menon', at:'2026-08-21T14:03'}] },
  { id: 'OP-0239', passNumber: 'PASS #0239', studentName: 'Aarav Krishnan', registerNumber: '22CSE104', department: 'Computer Science', year: 3, reason: 'Medical appointment', destination: 'Chennai', outAt: '2026-08-19T10:00', returnAt: '2026-08-19T17:00', status: 'CLEARED', approvals: [] }
];
