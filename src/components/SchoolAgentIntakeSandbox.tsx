import React, { useState } from 'react';
import { BookOpen, FileCheck2, LockKeyhole, RotateCcw } from 'lucide-react';
import type { ClassifiedEmail } from '../types';
import { Role } from '../types';
import { useFamily } from '../FamilyContext';
import { useModeModules } from '../modes/ModeContext';
import {
  proposeSchoolEmailCandidate, type CaptureCandidate,
} from '../intelligence/captureCandidates';
import { fingerprintPastedSchoolEmail } from '../intelligence/sourceFingerprint';
import type { SyntheticReviewReceipt } from '../intelligence/syntheticReviewLoop';
import SyntheticReviewPanel from './SyntheticReviewPanel';

type NoticeKind = 'assignment' | 'calendar_event' | 'action_required';

interface IntakeForm {
  from: string;
  subject: string;
  kind: NoticeKind;
  title: string;
  studentId: string;
  date: string;
  time: string;
}

const INITIAL: IntakeForm = {
  from: 'teacher@example.org',
  subject: 'School update',
  kind: 'assignment',
  title: '',
  studentId: '',
  date: '',
  time: '',
};

/**
 * No message ingestion, AI or API integration here. Deliberately asks the
 * parent to type synthetic DEMO notice fields and creates ONLY a review
 * candidate in component memory. Future School Agent must verify auth, RLS,
 * source consent and actual sender provenance server-side.
 */
const SchoolAgentIntakeSandbox: React.FC = () => {
  const { state } = useFamily();
  const { activeMode, featureEnabled } = useModeModules();
  const familyId = state.currentUser?.familyId ?? null;
  const allowed = featureEnabled && activeMode === 'learning-support' &&
    state.currentUser?.role === Role.PARENT && Boolean(familyId);
  // Deliberately use fictional students, NOT names or records of actual children.
  // The familyId links the synthetic example only to this in-memory session.
  const students = familyId ? [
    { id: 'synthetic-student-a', familyId, name: 'Demo student A', grade: '5' },
    { id: 'synthetic-student-b', familyId, name: 'Demo student B', grade: '6' },
  ] : [];
  const [form, setForm] = useState<IntakeForm>(INITIAL);
  const [candidate, setCandidate] = useState<CaptureCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipts, setReceipts] = useState<SyntheticReviewReceipt[]>([]);
  if (!allowed) return null;

  const update = <K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setCandidate(null);
    setError(null);
  };

  const simulate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!familyId) return;
    setCandidate(null);
    setError(null);
    setBusy(true);
    try {
      // The demo fingerprint reflects fictional notice fields only.
      // Do not paste real school emails, medical/IEP notes or child identities.
      // This is a content fingerprint, not proof of sender authenticity.
      // The actual email body is never requested or retained.
      const sourceId = await fingerprintPastedSchoolEmail({
        from: form.from,
        subject: form.subject,
        body: JSON.stringify([form.kind, form.title, form.studentId, form.date, form.time]),
      });
      const student = students.find(s => s.id === form.studentId);
      const extractedData: ClassifiedEmail['extractedData'] =
        form.kind === 'assignment'
          ? { assignmentTitle: form.title, dueDate: form.date, subject: form.subject }
          : form.kind === 'calendar_event'
            ? { eventTitle: form.title, eventDate: form.date, eventTime: form.time }
            : { actionDescription: form.title, deadline: form.date };
      const synthetic: ClassifiedEmail = {
        id: sourceId,
        from: form.from, subject: form.subject, date: '',
        rawText: '', // never collect or persist actual message contents
        category: form.kind,
        confidence: 0, // user-selected category, NOT AI confidence
        childName: student?.name ?? null,
        isDuplicate: false,
        extractedData,
      };
      const result = proposeSchoolEmailCandidate(synthetic, familyId, students);
      if (!result) throw new Error('No review candidate could be formed.');
      // A manual entry is NEVER an authorized source. Even if the pure
      // classifier reports ready_for_review, real execution is unavailable.
      setCandidate(result);
    } catch {
      setError('Unable to create a local draft. No information was sent or saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4" aria-label="School Agent intake demonstration">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">School Agent · Intake lab</p>
        <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
          <BookOpen size={20} aria-hidden="true" /> From school notice to review candidate
        </h2>
        <p className="text-sm text-slate-600 mt-2">
          Enter a fictional school notice, check its missing fields, and practice a parent review.
          Classification is manual here; the proposed action is never executed.
        </p>
      </div>
      <div className="flex items-start gap-2 bg-amber-50 text-amber-900 border border-amber-100 rounded-lg p-3 text-xs">
        <LockKeyhole size={17} className="shrink-0" aria-hidden="true" />
        Fictional information only, please. No live emails are read; nothing is uploaded,
        added to Schoolwork or Calendar, or saved across sessions. Real email access and approvals stay disabled
        until verified household authorization and consent are in place.
      </div>

      <form onSubmit={simulate} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">
          Notice type (manually selected)
          <select value={form.kind} onChange={e => update('kind', e.target.value as NoticeKind)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2">
            <option value="assignment">Assignment</option>
            <option value="calendar_event">Calendar event</option>
            <option value="action_required">Action needed</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          Related fictional student (optional)
          <select value={form.studentId} onChange={e => update('studentId', e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2">
            <option value="">Not known / needs review</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          Fictional sender
          <input value={form.from} maxLength={120} onChange={e => update('from', e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" required />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Fictional subject / course
          <input value={form.subject} maxLength={120} onChange={e => update('subject', e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" required />
        </label>
        <label className="text-sm font-medium text-slate-800 sm:col-span-2">
          Fictional task or event title
          <input value={form.title} maxLength={200} onChange={e => update('title', e.target.value)}
            placeholder="e.g. Bring signed permission slip" required
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Fictional date (leave blank when unknown)
          <input type="date" value={form.date} onChange={e => update('date', e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
        </label>
        {form.kind === 'calendar_event' && (
          <label className="text-sm font-medium text-slate-800">
            Fictional time (leave blank when unknown)
            <input type="time" value={form.time} onChange={e => update('time', e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" />
          </label>
        )}
        <div className="sm:col-span-2 flex gap-3 flex-wrap">
          <button type="submit" disabled={busy}
            className="rounded-lg px-4 py-2 bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
            {busy ? 'Preparing…' : 'Preview source review'}
          </button>
          <button type="button" onClick={() => {
            setForm(INITIAL); setCandidate(null); setError(null); setReceipts([]);
          }}
            className="rounded-lg px-4 py-2 border text-slate-700 text-sm font-semibold flex items-center gap-2">
            <RotateCcw size={16} aria-hidden="true" /> Clear demo session
          </button>
        </div>
      </form>

      {error && <p role="alert" className="border rounded-lg border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</p>}
      {candidate && (
        <div aria-live="polite" className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 size={19} aria-hidden="true" /> Review candidate (not created)
          </h3>
          <p className="text-sm text-slate-700">
            <strong>{candidate.title}</strong> · {candidate.kind.replace(/_/g, ' ')}
          </p>
          <p className="text-sm text-slate-700">
            Recorded date: {candidate.proposedFields.date ?? 'Unconfirmed'} ·
            Student: {candidate.studentMatch === 'exact' ? 'Name matched in household (not yet parent-verified)' : 'Requires identification'}
          </p>
          <p className="text-xs text-slate-600 break-all">
            Local source fingerprint: {candidate.source.externalRef.slice(0, 25)}…
          </p>
          <p className="text-xs text-slate-700">
            Source checks: {candidate.issues.length ? candidate.issues.join(' · ') :
              'No simple extraction fields missing. Sender authenticity, household consent and parent review are still unverified.'}
          </p>
          <p className="text-xs text-indigo-800">
            This identifier is based on fictional input. It cannot prove sender identity,
            source consent or ownership.
          </p>
          <SyntheticReviewPanel
            key={candidate.source.externalRef}
            candidate={candidate}
            students={students}
            familyId={familyId!}
            actorRole={state.currentUser!.role}
            activeMode={activeMode}
            receipts={receipts}
            onReceipt={receipt => setReceipts(previous => [
              ...previous.filter(r => !(r.familyId === receipt.familyId &&
                r.sourceFingerprint === receipt.sourceFingerprint)),
              receipt,
            ])}
            onUndoReceipt={fingerprint => setReceipts(previous => previous.filter(
              receipt => !(receipt.familyId === familyId && receipt.sourceFingerprint === fingerprint),
            ))}
          />
        </div>
      )}
    </section>
  );
};

export default SchoolAgentIntakeSandbox;
