import { FileDown, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDateTime as fmt } from './profile-policy';
import { prettyStatus } from './workflow';
import { approvalSteps, approvalForStep, categoryOf, OUTPASS_CATEGORIES, studentTypeOf, STUDENT_TYPES } from '../functions/outpass-policy';
import './pass-ticket.css';

function printPass(element) {
  if (!element || document.querySelector('.pass-print-root')) return;
  const root = document.createElement('div');
  root.className = 'pass-print-root'; root.append(element.cloneNode(true));
  document.body.append(root); document.body.classList.add('printing-pass');
  const cleanup = () => { root.remove(); document.body.classList.remove('printing-pass'); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup, { once: true });
  try { window.print(); } catch { cleanup(); }
}

const STEP_STATUS = { 'Class Advisor':'PENDING_ADVISOR', HOD:'PENDING_HOD', Principal:'PENDING_PRINCIPAL', 'Deputy Warden':'PENDING_WARDEN', 'Resident Councillor':'PENDING_COUNCILLOR' };
export function PassCard({ record, showStudentType = true }) {
  const valid = ['APPROVED', 'CURRENTLY_OUT'].includes(record.status);
  const type = studentTypeOf(record), category = categoryOf(record);
  const steps = approvalSteps(record);
  const queueIndex = steps.map(role => STEP_STATUS[role]).indexOf(record.status);
  const outside = record.status === 'CURRENTLY_OUT';
  const qrValue = `CAMPUSPASS|${record.id}|${record.passNumber || ''}|${record.registerNumber || ''}|${record.studentName || ''}|${record.department || ''}`;
  const returned = record.entryAt;
  function downloadQr(event) {
    const svg = event.currentTarget.closest('.pass-ticket').querySelector('.ticket-qr svg');
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const link = document.createElement('a'); link.href = url; link.download = `${record.passNumber || 'campuspass'}-qr.svg`; link.click(); URL.revokeObjectURL(url);
  }
  const initials = (record.studentName || 'Student').split(/\s+/).slice(0, 2).map(x => x[0]).join('');
  return <article className="pass-ticket" aria-label={`Outpass for ${record.studentName || 'student'}`}>
    <div className="ticket-main">
      <div className="ticket-heading"><div><p className="ticket-kicker">CAMPUSPASS · {record.passNumber || 'REQUEST IN PROGRESS'}</p><h3>{record.studentName || 'Student'}</h3><div className="ticket-tags">{showStudentType&&<span>{STUDENT_TYPES[type]}</span>}<span className={category === 'EMERGENCY' ? 'urgent' : ''}>{OUTPASS_CATEGORIES[category]}</span><span className={`ticket-status ${record.status?.toLowerCase()}`}>{prettyStatus(record.status)}</span></div></div><div className="ticket-identity"><small>Filed {record.createdAt ? fmt(record.createdAt) : '—'}</small>{record.photoUrl ? <img src={record.photoUrl} alt={`${record.studentName}'s student profile`}/> : <div className="ticket-photo-placeholder" aria-label="Student photo unavailable">{initials}</div>}</div></div>
      <dl className="ticket-details">{[
        ['Register number', record.registerNumber], ['Institute', record.institution],
        ['Department / Section', `${record.department || '—'}${record.section ? ' · '+record.section : ''}`], ['Year / Gender', `Year ${record.year || '—'} · ${record.gender || '—'}`],
        ['Out · approved time', fmt(record.outAt)], ['In · expected', fmt(record.returnAt)],
        ['Student mobile', record.studentPhone], ['Parent mobile', record.parentPhone],
        ['Exited · actual', record.exitAt ? fmt(record.exitAt) : 'Not recorded'], ['Returned · actual', returned ? fmt(returned) : 'Not recorded'],
      ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
      <div className="ticket-reason"><small>Reason for request</small><blockquote>{record.reason || '—'}</blockquote><p className={record.responsibilityAccepted ? 'ticket-declaration' : 'ticket-unrecorded'}>{record.responsibilityAccepted ? '✓ Student accepted responsibility for their time outside campus.' : 'Responsibility declaration not recorded on this pass.'}</p></div>
      {returned && <p className="ticket-return">Returned to {type === 'DAY_SCHOLAR' ? 'campus' : 'hostel'} · {fmt(returned)}{record.gate ? ' · '+record.gate : ''}</p>}
      <div className="ticket-footer">{valid ? <div className="ticket-qr"><QRCodeSVG value={qrValue} size={88} level="M" includeMargin/><div><b>Present at the security gate</b><span>Valid until {fmt(record.returnAt)}</span><button type="button" className="ticket-link" onClick={downloadQr}><QrCode size={14}/> Download QR</button></div></div> : <p className="ticket-gate-note">{record.status === 'CLEARED' ? 'This pass is closed. Gate movement is complete.' : record.status === 'REJECTED' ? 'This request was declined. It cannot be used at the gate.' : 'Gate QR becomes available after all permissions are granted.'}</p>}<button type="button" className="ticket-print" onClick={e => printPass(e.currentTarget.closest('.pass-ticket'))}><FileDown size={16}/> Print / save PDF</button></div>
    </div>
    <aside className="ticket-approvals" aria-label="Permission and gate history"><p className="ticket-kicker">Permission trail</p>{steps.map((role,index) => {
      const approval = approvalForStep(record.approvals,role);
      const declined = approval?.decision === 'REJECTED', approved = approval?.decision === 'APPROVED';
      const current = !approval && index === queueIndex;
      const historyMissing = !approval && (['APPROVED','CURRENTLY_OUT','CLEARED'].includes(record.status) || index < queueIndex);
      return <div className="ticket-approval" key={role}><div><b>{role}</b><span>{approval?.name || (current ? 'Awaiting review' : historyMissing ? 'History unavailable' : record.status === 'REJECTED' ? 'Not reached' : 'Pending')}</span>{approval?.at && <small>{fmt(approval.at)}</small>}{approval?.remarks && <p>{approval.remarks}</p>}</div><span className={`ticket-stamp ${declined ? 'declined' : approved ? 'approved' : current ? 'current' : ''}`} aria-label={declined ? 'Declined' : approved ? 'Approved' : current ? 'Awaiting review' : historyMissing ? 'History unavailable' : 'Pending'}>{declined ? 'NO' : approved ? 'OK' : current ? 'NEXT' : '—'}</span></div>;
    })}<div className="ticket-approval ticket-security"><div><b>Security gate</b><span>{outside ? 'Student out' : 'Student in'}{record.gate ? ' · '+record.gate : ''}</span>{(returned || record.exitAt) && <small>{fmt(returned || record.exitAt)}</small>}</div><span className={`ticket-stamp ${outside ? 'current' : 'approved'}`}>{outside ? 'OUT' : 'IN'}</span></div></aside>
  </article>;
}
