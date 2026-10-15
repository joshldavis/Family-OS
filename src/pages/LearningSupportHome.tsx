import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, BookOpen, CalendarDays, CheckCircle2,
  ClipboardList, FolderOpen, Info, ShieldCheck,
} from 'lucide-react';
import { Role } from '../types';
import { useFamily } from '../FamilyContext';
import { useModeModules } from '../modes/ModeContext';
import ParentDecisionInbox from '../components/ParentDecisionInbox';
import { buildLearningSupportSummary, localDateISO } from '../learning-support/summary';
import type { LearningSupportCard } from '../learning-support/summary';

const MAX_CARDS = 6;

function displayDate(date: string | null): string {
  if (!date) return 'Date needs confirmation';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function SupportCard({ item }: { item: LearningSupportCard }) {
  const Icon = item.kind === 'event' ? CalendarDays : BookOpen;
  return (
    <li>
      <Link to={item.href} className="block border border-slate-200 bg-white rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-slate-100 text-indigo-700">
            <Icon size={18} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900">{item.title}</p>
            <p className="text-sm text-slate-600 mt-1">
              {item.person ? item.person + ' · ' : ''}{item.detail}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {displayDate(item.dueDate)}
              {item.sourceLabel ? ' · ' + item.sourceLabel : ''}
            </p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-slate-400 mt-1" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}

function DashboardSection({
  title, description, items, count, emptyMessage, icon,
}: {
  title: string;
  description: string;
  items: LearningSupportCard[];
  count: number;
  emptyMessage: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            {icon}{title}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-2.5 py-1">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>
      {items.length ? (
        <ul className="space-y-2">
          {items.slice(0, MAX_CARDS).map(item => <SupportCard item={item} key={item.id} />)}
        </ul>
      ) : (
        <p className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-5 text-slate-600">
          {emptyMessage}
        </p>
      )}
      {count > MAX_CARDS && (
        <p className="text-xs text-slate-500">
          Showing {MAX_CARDS} of {count}. See Schoolwork or Calendar for the full list.
        </p>
      )}
    </section>
  );
}

/**
 * First Learning Support view: evidence-only. Reuses records already present
 * in FamilyContext; it does not run analysis agents, read documents, load
 * browser-global email stores, mutate state, or assert health conclusions.
 */
const LearningSupportHome: React.FC = () => {
  const { state } = useFamily();
  const { isEnabled, activeMode, featureEnabled } = useModeModules();
  const familyId = state.currentUser?.familyId ?? null;
  const authorizedView = featureEnabled &&
    activeMode === 'learning-support' &&
    state.currentUser?.role === Role.PARENT &&
    Boolean(familyId);

  const today = localDateISO(new Date());
  const showSchool = isEnabled('schoolwork');
  const showCalendar = isEnabled('calendar');
  const showEmail = isEnabled('email-intelligence');
  const showDocs = isEnabled('documents');

  const summary = useMemo(() => buildLearningSupportSummary({
    familyId: authorizedView ? familyId : null,
    students: authorizedView && showSchool ? state.students : [],
    assignments: authorizedView && showSchool ? state.assignments : [],
    events: authorizedView && showCalendar ? state.events : [],
    today,
  }), [
    authorizedView, familyId, showSchool, showCalendar,
    state.students, state.assignments, state.events, today,
  ]);

  if (!authorizedView) {
    // A locally selected mode is NOT an authorization grant.
    return <div className="p-6 rounded-xl border bg-white">
      <h1 className="font-bold text-slate-900">Learning Support</h1>
      <p className="text-slate-600 text-sm mt-2">
        This overview is available to a signed-in parent in Learning Support mode.
      </p>
    </div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Learning Support · Family overview
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          What needs your attention?
        </h1>
        <p className="text-slate-600 text-sm max-w-2xl">
          A clearer view of school assignments and family calendar entries already recorded in Family OS.
          Calendar entries are not assumed to be school-related. This overview does not infer diagnoses or make decisions.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Needs attention</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{summary.counts.attention}</p>
          <p className="text-xs text-slate-500 mt-1">Overdue or due within three days</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Already organized</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{summary.counts.organized}</p>
          <p className="text-xs text-slate-500 mt-1">Upcoming or recently completed</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Worth reviewing</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{summary.counts.review}</p>
          <p className="text-xs text-slate-500 mt-1">Dates requiring confirmation</p>
        </div>
      </div>

      {/* Reversible, session-only parent decision prototype: no write actions. */}
      <ParentDecisionInbox key={familyId ?? 'signed-out'} summary={summary} />

      <DashboardSection
        title="Needs your attention"
        description="Open assignments that are overdue, due today, or due in the next three days."
        icon={<AlertCircle size={21} className="text-amber-600" aria-hidden="true" />}
        items={summary.attention}
        count={summary.counts.attention}
        emptyMessage="No immediate schoolwork deadlines found in the connected family records."
      />

      <DashboardSection
        title="Already organized"
        description="Upcoming assignments and family calendar entries in the next two weeks, plus recently completed schoolwork."
        icon={<CheckCircle2 size={21} className="text-emerald-600" aria-hidden="true" />}
        items={summary.organized}
        count={summary.counts.organized}
        emptyMessage="No upcoming or recently completed items found in the visible records. Check Schoolwork or Calendar for anything missing."
      />

      <DashboardSection
        title="Worth reviewing"
        description="Existing schoolwork and calendar entries with dates we cannot confirm."
        icon={<ClipboardList size={21} className="text-indigo-600" aria-hidden="true" />}
        items={summary.review}
        count={summary.counts.review}
        emptyMessage="No date issues were detected in the family records shown here."
      />

      <section className="rounded-2xl border bg-white p-5 space-y-3" aria-label="School information tools">
        <h2 className="font-bold text-slate-900 flex gap-2 items-center">
          <Info size={18} aria-hidden="true" /> Sources and next steps
        </h2>
        <p className="text-sm text-slate-600">
          This overview currently reads family-linked Schoolwork and Calendar entries.
          School email actions, document content, behavioral observations, and meeting summaries
          are not included until verified household-scoped capture and permissions are ready.
          An empty section does not prove that all responsibilities have been handled.
        </p>
        <div className="flex gap-3 flex-wrap">
          {showSchool && <Link className="text-sm font-semibold text-indigo-700 hover:underline" to="/schoolwork">
            <BookOpen size={16} className="inline mr-1" aria-hidden="true" />Open Schoolwork
          </Link>}
          {showCalendar && <Link className="text-sm font-semibold text-indigo-700 hover:underline" to="/calendar">
            <CalendarDays size={16} className="inline mr-1" aria-hidden="true" />Open Calendar
          </Link>}
          {showEmail && <Link className="text-sm font-semibold text-indigo-700 hover:underline" to="/email">
            <ClipboardList size={16} className="inline mr-1" aria-hidden="true" />Review School Email
          </Link>}
          {showDocs && <Link className="text-sm font-semibold text-indigo-700 hover:underline" to="/documents">
            <FolderOpen size={16} className="inline mr-1" aria-hidden="true" />Open Documents
          </Link>}
        </div>
        <p className="flex gap-2 text-xs text-slate-500">
          <ShieldCheck size={16} className="shrink-0" aria-hidden="true" />
          No messages sent and no records changed by this overview. Mode settings are a local view,
          not a substitute for database access controls.
        </p>
      </section>
    </div>
  );
};

export default LearningSupportHome;
