import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Eye, ShieldCheck, Undo2 } from 'lucide-react';
import type { LearningSupportSummary } from '../learning-support/summary';
import {
  deriveDecisionCandidates, isCurrentDecision, recordDraftDecision, summarizeDraftReviews,
  type DecisionCandidate, type DraftReviewDecision, type ReviewDisposition,
} from '../learning-support/decisionInbox';
import { Role } from '../types';
import { useFamily } from '../FamilyContext';
import { useModeModules } from '../modes/ModeContext';

function prettyDate(date: string | null) {
  if (!date) return 'Not confirmed';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

const ParentDecisionInbox: React.FC<{ summary: LearningSupportSummary }> = ({ summary }) => {
  const { state } = useFamily();
  const { activeMode, featureEnabled } = useModeModules();
  const actorFamilyId = state.currentUser?.familyId ?? null;
  const actorRole = state.currentUser?.role ?? null;
  const allowed = featureEnabled && activeMode === 'learning-support' &&
    actorRole === Role.PARENT && Boolean(actorFamilyId);

  const candidates = useMemo(
    () => deriveDecisionCandidates(allowed ? actorFamilyId : null, summary),
    [allowed, actorFamilyId, summary],
  );

  // These drafts are intentionally NOT saved to localStorage, Supabase or any
  // integration. They are for evaluating the human decision UX only.
  const [drafts, setDrafts] = useState<Record<string, DraftReviewDecision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const counts = summarizeDraftReviews(candidates, drafts);
  const pending = candidates.filter(c => !isCurrentDecision(c, drafts[c.id]));
  const reviewed = candidates.filter(c => isCurrentDecision(c, drafts[c.id]));
  const visiblePending = showAll ? pending : pending.slice(0, 4);

  if (!allowed) return null;

  const decide = (candidate: DecisionCandidate, disposition: ReviewDisposition) => {
    setError(null);
    try {
      const current = candidates.find(c => c.id === candidate.id &&
        c.sourceRevision === candidate.sourceRevision);
      if (!current) throw new Error('The source changed. Refresh before reviewing.');
      // Explicit caller role and mode, not a server authorization grant.
      const decision = recordDraftDecision({
        candidate: current, disposition, actorFamilyId, actorRole, activeMode,
        confirmedDate: dates[candidate.id] ?? null, note: notes[candidate.id],
        now: new Date().toISOString(),
      });
      setDrafts(prev => ({ ...prev, [candidate.id]: decision }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record draft review');
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/30 overflow-hidden" aria-labelledby="decision-inbox-title">
      <div className="p-5 sm:p-6 space-y-3 border-b border-indigo-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">Parent decision inbox · Preview</p>
            <h2 id="decision-inbox-title" className="text-xl font-bold text-slate-900 mt-1">
              Review before anything happens
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              These suggestions come only from schoolwork and calendar entries already in this family workspace.
              Review the underlying record before accepting a draft follow-up.
            </p>
          </div>
          <div className="bg-white border border-indigo-100 rounded-xl p-3 min-w-[115px]">
            <p className="text-xs text-slate-500">To review</p>
            <p className="text-2xl font-bold text-slate-900">{counts.open}</p>
          </div>
        </div>
        <p className="flex gap-2 text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
          <ShieldCheck size={17} aria-hidden="true" className="shrink-0" />
          Demo-only decisions. Approving a draft does not update Schoolwork, create calendar events,
          send messages, execute an agent or save approval to a server. Your selections disappear
          when you leave or refresh this view.
        </p>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {error && <p role="alert" className="text-sm text-red-700 border border-red-200 bg-red-50 p-3 rounded-lg">{error}</p>}
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <CheckCircle2 className="text-emerald-600 mb-2" size={22} aria-hidden="true" />
            <p className="font-semibold text-slate-900">No unreviewed suggestions in this session.</p>
            <p className="text-sm text-slate-600 mt-1">
              This does not confirm that all family commitments are complete. Check your source records.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {visiblePending.map(candidate => (
              <li key={candidate.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                      {candidate.bucket === 'attention' ? 'Due soon or overdue' : 'Needs verification'}
                    </p>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{candidate.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {candidate.person ? candidate.person + ' · ' : ''}{candidate.reason}
                    </p>
                  </div>
                  <span className="text-xs text-slate-600 rounded-lg bg-slate-100 px-2.5 py-1.5 flex gap-1.5 items-center">
                    <Clock3 size={14} aria-hidden="true" /> {prettyDate(candidate.recordedDate)}
                  </span>
                </div>
                <div className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                  <p><strong>Suggested next step:</strong> {candidate.proposedAction}</p>
                  <p className="text-xs text-slate-500">
                    Evidence: {candidate.provenance}. The record origin has not been independently verified.
                  </p>
                  <Link to={candidate.sourceHref} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
                    <Eye size={15} aria-hidden="true" /> Open {candidate.kind === 'assignment' ? 'Schoolwork' : 'Calendar'} module <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
                {candidate.needsConfirmedDate && (
                  <label className="block text-sm font-medium text-slate-800">
                    Confirm a proposed date for the draft (does not update Schoolwork)
                    <input
                      type="date"
                      value={dates[candidate.id] ?? ''}
                      onChange={e => setDates(prev => ({ ...prev, [candidate.id]: e.target.value }))}
                      className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 w-full sm:w-auto"
                    />
                  </label>
                )}
                {candidate.mustFixSource && (
                  <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 p-3 rounded-lg">
                    The calendar date or time is incomplete. Correct it in Calendar before approving a draft.
                  </p>
                )}
                <label className="block text-sm font-medium text-slate-800">
                  Optional parent note — local to this session
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={notes[candidate.id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [candidate.id]: e.target.value }))}
                    placeholder="What should be checked or discussed?"
                    className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => decide(candidate, 'approved-draft')}
                    disabled={candidate.mustFixSource || (candidate.needsConfirmedDate && !dates[candidate.id])}
                    className="text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 rounded-lg px-3 py-2"
                  >
                    Approve draft only
                  </button>
                  <button type="button" onClick={() => decide(candidate, 'needs-correction')}
                    className="text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-3 py-2">
                    Needs correction
                  </button>
                  <button type="button" onClick={() => decide(candidate, 'dismissed')}
                    className="text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-3 py-2">
                    Dismiss for now
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {pending.length > 4 && (
          <button type="button" onClick={() => setShowAll(x => !x)}
            className="text-sm font-semibold text-indigo-700 hover:underline">
            {showAll ? 'Show fewer suggestions' : `Show all ${pending.length} suggestions`}
          </button>
        )}

        <div className="border-t border-indigo-100 pt-4">
          <button type="button" onClick={() => setShowHistory(x => !x)}
            aria-expanded={showHistory}
            className="text-sm font-semibold text-indigo-700 flex gap-2 items-center hover:underline">
            {showHistory ? 'Hide session review history' : 'Show session review history'}
            ({counts.approvedDrafts} draft approved, {counts.needsCorrection} need correction, {counts.dismissed} dismissed)
          </button>
          {showHistory && (
            <ul className="mt-3 space-y-2">
              {reviewed.length === 0 ? (
                <li className="text-sm text-slate-500">Nothing reviewed during this session.</li>
              ) : reviewed.map(candidate => {
                const decision = drafts[candidate.id];
                return (
                  <li key={candidate.id} className="rounded-lg border bg-white p-3 flex flex-wrap gap-3 items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{candidate.title}</p>
                      <p className="text-xs text-slate-600">
                        {decision.disposition === 'approved-draft' ? 'Approved as draft only — not executed' :
                          decision.disposition === 'needs-correction' ? 'Needs correction in source' :
                            'Dismissed for this session'}
                        {decision.confirmedDate ? ' · ' + prettyDate(decision.confirmedDate) : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => {
                      setDrafts(prev => {
                        const next = { ...prev }; delete next[candidate.id]; return next;
                      });
                    }} className="text-sm text-indigo-700 hover:underline flex gap-1 items-center">
                      <Undo2 size={15} aria-hidden="true" /> Undo
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default ParentDecisionInbox;
