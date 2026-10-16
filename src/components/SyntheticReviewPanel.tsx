import React, { useState } from 'react';
import { CheckCircle2, CircleAlert, ClipboardCheck, RotateCcw, ShieldCheck } from 'lucide-react';
import type { Student } from '../types';
import type { CaptureCandidate } from '../intelligence/captureCandidates';
import {
  initialSyntheticCorrections, isDuplicateSyntheticSource,
  makeSyntheticReviewReceipt, currentSyntheticReceipt,
  type SyntheticCorrections, type SyntheticReviewReceipt,
} from '../intelligence/syntheticReviewLoop';

const MESSAGES: Record<string, string> = {
  wrong_session: 'Only the current demo parent may review this item.',
  unsupported_kind: 'Only fictional assignments can receive a demo draft approval. Events and messages remain review-only.',
  unverified_fictional_source: 'Acknowledge the fictional notice before continuing.',
  invalid_title: 'Confirm a short, single-line title.',
  student_not_in_family: 'Select one of the fictional students shown here.',
  invalid_date: 'A real calendar date is required. No deadline will be guessed.',
  confirm_fields: 'Confirm the title, child, and deadline individually.',
  duplicate_source: 'This fictional source was already reviewed in this session. Undo the earlier draft first.',
  invalid_timestamp: 'The review timestamp could not be validated.',
};

type Disposition = 'needs-correction' | 'dismissed';

const SyntheticReviewPanel: React.FC<{
  candidate: CaptureCandidate;
  students: readonly Student[];
  familyId: string;
  actorRole: string;
  activeMode: string;
  receipts: readonly SyntheticReviewReceipt[];
  onReceipt: (receipt: SyntheticReviewReceipt) => void;
  onUndoReceipt: (fingerprint: string) => void;
}> = ({ candidate, students, familyId, actorRole, activeMode, receipts, onReceipt, onUndoReceipt }) => {
  const [corrections, setCorrections] = useState<SyntheticCorrections>(
    () => initialSyntheticCorrections(candidate),
  );
  const [error, setError] = useState<string | null>(null);
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const existing = receipts.find(r => r.familyId === familyId &&
    r.sourceFingerprint === candidate.source.externalRef);
  const current = currentSyntheticReceipt(candidate, existing);
  const isDuplicate = isDuplicateSyntheticSource(candidate, receipts);

  const patch = (changes: Partial<SyntheticCorrections>) => {
    setCorrections(previous => ({ ...previous, ...changes }));
    setError(null);
    setDisposition(null);
  };

  const approve = () => {
    setError(null);
    const result = makeSyntheticReviewReceipt({
      candidate, corrections, students, actorFamilyId: familyId, actorRole, activeMode,
      previousReceipts: receipts, now: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(MESSAGES[result.reason] ?? 'Draft approval not permitted.');
      return;
    }
    onReceipt(result.receipt);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-indigo-200">
      <div>
        <p className="text-xs uppercase tracking-wide font-bold text-indigo-700">
          Step 2 of 3 · Correct and confirm
        </p>
        <h4 className="font-bold text-slate-900 mt-1 flex items-center gap-2">
          <ClipboardCheck size={18} aria-hidden="true" /> Parent review (fictional example)
        </h4>
        <p className="text-sm text-slate-600 mt-1">
          Adjust the proposed details. A name matched from a notice isn't proof of child identity;
          you must select and confirm the fictional student yourself.
        </p>
      </div>

      {candidate.kind !== 'assignment' && (
        <p className="text-sm bg-amber-50 border border-amber-100 text-amber-900 p-3 rounded-lg">
          This {candidate.kind.replace(/_/g, ' ')} can be inspected, but demo draft approval is limited
          to assignments. Calendar events and communications are never scheduled or sent here.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
          Proposed title
          <input value={corrections.title} maxLength={200}
            onChange={e => patch({ title: e.target.value, confirmedTitle: false })}
            className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Fictional student
          <select value={corrections.studentId}
            onChange={e => patch({ studentId: e.target.value, confirmedStudent: false })}
            className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2">
            <option value="">Needs identification</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Proposed deadline
          <input type="date" value={corrections.dueDate}
            onChange={e => patch({ dueDate: e.target.value, confirmedDate: false })}
            className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2" />
        </label>
      </div>

      <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <legend className="text-sm font-semibold text-slate-800 px-1">Explicit parent checks</legend>
        {([
          ['reviewedFictionalNotice', 'I understand this is a fictional example and not an authentic school message.'],
          ['confirmedTitle', 'I have checked the proposed assignment title.'],
          ['confirmedStudent', 'I have selected the correct fictional student.'],
          ['confirmedDate', 'I have checked the proposed deadline.'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={corrections[key]}
              onChange={e => patch({ [key]: e.target.checked })}
              className="mt-1 rounded border-slate-300" />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {error && <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3" role="alert">{error}</p>}

      {disposition && !current && (
        <div role="status" className="rounded-lg border border-amber-100 bg-amber-50 text-sm text-amber-900 p-3">
          {disposition === 'dismissed'
            ? 'Dismissed in this session only. No source was changed.'
            : 'Marked for correction in this session only. Update the proposed fields above.'}
          <button type="button" onClick={() => setDisposition(null)}
            className="ml-2 underline font-semibold">Undo</button>
        </div>
      )}

      {current ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <h4 className="font-bold flex items-center gap-2 text-emerald-900">
            <CheckCircle2 size={19} aria-hidden="true" /> Step 3 · Demo draft approved
          </h4>
          <p className="text-sm text-emerald-950">
            Preview only: create assignment “{current.actionPreview.title}” for{' '}
            {students.find(s => s.id === current.actionPreview.studentId)?.name ?? 'fictional student'}
            {' '}due {current.actionPreview.dueDate}.
          </p>
          <p className="text-xs text-emerald-900 font-semibold">
            NO SCHOOLWORK RECORD CREATED · NO APPROVAL STORED · NO AGENT EXECUTED
          </p>
          <button type="button" onClick={() => onUndoReceipt(current.sourceFingerprint)}
            className="flex items-center gap-2 text-sm font-semibold text-emerald-800 underline">
            <RotateCcw size={14} aria-hidden="true" /> Undo session draft
          </button>
        </div>
      ) : isDuplicate ? (
        <div role="status" className="rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-sm p-3">
          This fictional source already has a draft review in this session. Another attempt won't
          create a duplicate. It may have changed since review.
          <button type="button" onClick={() => onUndoReceipt(candidate.source.externalRef)}
            className="ml-2 font-semibold underline">Undo earlier draft</button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={approve} disabled={candidate.kind !== 'assignment'}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold">
            Approve fictional draft only
          </button>
          <button type="button" onClick={() => { setError(null); setDisposition('needs-correction'); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700">
            Needs correction
          </button>
          <button type="button" onClick={() => { setError(null); setDisposition('dismissed'); }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700">
            Dismiss for now
          </button>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <ShieldCheck size={17} aria-hidden="true" className="shrink-0" />
        These checks and the receipt exist only in this browser session. They do not establish
        identity, consent, source authenticity, server approval, or permission to execute.
      </p>
    </div>
  );
};

export default SyntheticReviewPanel;
