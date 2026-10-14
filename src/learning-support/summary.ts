import type { Assignment, CalendarEvent, Student } from '../types.ts';
import { Status } from '../types.ts';

/**
 * This is a READ-ONLY view of ALREADY AVAILABLE family state.
 *
 * No inference about learning disabilities, health, regulation, or IEPs.
 * No automatic actions. No global browser-scoped email/action item store.
 * Records without an explicit household link are excluded from this view.
 */
export type LearningSupportBucket = 'attention' | 'organized' | 'review';
export type LearningSupportItemKind = 'assignment' | 'event';

export interface LearningSupportCard {
  id: string;
  kind: LearningSupportItemKind;
  bucket: LearningSupportBucket;
  title: string;
  detail: string;
  person: string | null;
  dueDate: string | null;
  sourceLabel: string | null;
  href: '/schoolwork' | '/calendar';
}

export interface LearningSupportSummary {
  attention: LearningSupportCard[];
  organized: LearningSupportCard[];
  review: LearningSupportCard[];
  counts: { attention: number; organized: number; review: number };
  /** Diagnostics include counts only, NEVER rejected record content. */
  excludedUnscopedAssignments: number;
}

function asVerifiedDate(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day ? raw : null;
}

function ordinal(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function sourceLabel(source: Assignment['source']): string | null {
  if (source === 'Manual') return 'Entered in Schoolwork';
  if (source === 'Import') return 'Imported item — verify origin';
  if (source === 'AI') return 'AI-extracted item — verify origin';
  return null;
}

function sortByDate(a: LearningSupportCard, b: LearningSupportCard): number {
  const dateA = a.dueDate ?? '9999-12-31';
  const dateB = b.dueDate ?? '9999-12-31';
  return dateA.localeCompare(dateB) || a.title.localeCompare(b.title);
}

export function buildLearningSupportSummary(args: {
  familyId: string | null;
  students: readonly Student[];
  assignments: readonly Assignment[];
  events: readonly CalendarEvent[];
  /** Local household calendar date, YYYY-MM-DD. */
  today: string;
}): LearningSupportSummary {
  const attention: LearningSupportCard[] = [];
  const organized: LearningSupportCard[] = [];
  const review: LearningSupportCard[] = [];

  const empty = (): LearningSupportSummary => ({
    attention: [], organized: [], review: [],
    counts: { attention: 0, organized: 0, review: 0 },
    excludedUnscopedAssignments: 0,
  });

  if (!args.familyId) return empty();
  if (!asVerifiedDate(args.today)) throw new Error('A valid local date is required');

  const familyStudents = new Map(args.students
    .filter(s => s.familyId === args.familyId)
    .map(s => [s.id, s.name]));
  let excludedUnscopedAssignments = 0;

  for (const assignment of args.assignments) {
    // Legacy Assignment has no familyId. A matching student with explicit
    // family ownership is the ONLY defensible current tenant join. Never
    // show orphan assignments or guess child identity by similar names.
    const name = familyStudents.get(assignment.studentId);
    if (!name) {
      excludedUnscopedAssignments++;
      continue;
    }
    const date = asVerifiedDate(assignment.dueDate);
    const detail = assignment.subject?.trim() || 'Subject not provided';
    const base: Omit<LearningSupportCard, 'bucket'> = {
      id: 'assignment:' + assignment.id,
      kind: 'assignment',
      title: assignment.title?.trim() || 'Untitled assignment',
      detail,
      person: name,
      dueDate: date,
      sourceLabel: sourceLabel(assignment.source),
      href: '/schoolwork',
    };
    if (!date) {
      if (assignment.status !== Status.DONE) {
        review.push({ ...base, bucket: 'review', detail: detail + ' · Verify missing or invalid deadline' });
      }
      continue;
    }

    const days = ordinal(date) - ordinal(args.today);
    if (assignment.status === Status.DONE) {
      if (days >= -7 && days <= 0) organized.push({
        ...base, bucket: 'organized', detail: detail + ' · Marked complete',
      });
    } else if (days <= 3) {
      attention.push({
        ...base, bucket: 'attention',
        detail: days < 0 ? detail + ' · Overdue' :
          days === 0 ? detail + ' · Due today' : detail + ' · Due soon',
      });
    } else if (days <= 14) {
      organized.push({ ...base, bucket: 'organized', detail: detail + ' · Upcoming assignment' });
    }
  }

  for (const event of args.events) {
    // Events have explicit household ownership; unowned events are excluded.
    if (event.familyId !== args.familyId) continue;
    const rawDate = typeof event.start === 'string'
      ? event.start.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/)?.[1] ?? null
      : null;
    const date = asVerifiedDate(rawDate);
    const base: Omit<LearningSupportCard, 'bucket'> = {
      id: 'event:' + event.id,
      kind: 'event',
      title: event.title?.trim() || 'Untitled event',
      detail: event.location?.trim() ? 'Calendar · ' + event.location.trim() : 'Calendar event',
      person: null, // never infer a child from an unverified attendee list
      dueDate: date,
      sourceLabel: event.provider === 'google' ? 'Google Calendar' : 'Family calendar',
      href: '/calendar',
    };

    if (!date) {
      review.push({
        ...base, bucket: 'review',
        detail: 'Calendar event · Confirm date and time',
      });
      continue;
    }
    const days = ordinal(date) - ordinal(args.today);
    if (days >= 0 && days <= 14) {
      organized.push({ ...base, bucket: 'organized' });
    }
  }

  attention.sort(sortByDate);
  organized.sort(sortByDate);
  review.sort(sortByDate);
  return {
    attention, organized, review,
    counts: {
      attention: attention.length, organized: organized.length, review: review.length,
    },
    excludedUnscopedAssignments,
  };
}

export function localDateISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
