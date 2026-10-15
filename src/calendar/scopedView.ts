import type { Assignment, CalendarEvent, Student } from '../types.ts';
import { calendarDayForTimestamp, isValidDateKey } from './date.ts';

export interface CalendarViewItem {
  id: string;
  type: 'event' | 'assignment';
  title: string;
  start: string;
  end?: string;
  location?: string;
  category?: string;
  isDone?: boolean;
  provider?: 'internal' | 'google';
}

/**
 * Explicitly scoped read model. Legacy assignments do not have a familyId,
 * so only join them through a student in the selected household.
 * This is a defense-in-depth filter, not a substitute for server RLS.
 */
export function buildScopedCalendar(args: {
  familyId: string | null;
  students: readonly Student[];
  assignments: readonly Assignment[];
  events: readonly CalendarEvent[];
}): {
  groupedItems: Record<string, CalendarViewItem[]>;
  dates: string[];
  invalidDateCount: number;
  excludedUnscopedCount: number;
} {
  const groupedItems: Record<string, CalendarViewItem[]> = {};
  let invalidDateCount = 0;
  let excludedUnscopedCount = 0;
  if (!args.familyId) {
    return { groupedItems, dates: [], invalidDateCount, excludedUnscopedCount };
  }

  const studentIds = new Set(
    args.students.filter(s => s.familyId === args.familyId).map(s => s.id)
  );
  const add = (date: string, item: CalendarViewItem) => {
    (groupedItems[date] ??= []).push(item);
  };

  for (const event of args.events) {
    if (event.familyId !== args.familyId) {
      excludedUnscopedCount++;
      continue;
    }
    const date = calendarDayForTimestamp(event.start);
    if (!date) { invalidDateCount++; continue; }
    add(date, {
      id: event.id, type: 'event', title: event.title,
      start: event.start, end: event.end, location: event.location,
      provider: event.provider ?? 'internal',
    });
  }
  for (const item of args.assignments) {
    if (!studentIds.has(item.studentId)) {
      excludedUnscopedCount++;
      continue;
    }
    if (!isValidDateKey(item.dueDate)) { invalidDateCount++; continue; }
    add(item.dueDate, {
      id: item.id, type: 'assignment', title: item.title,
      start: item.dueDate + 'T23:59', category: item.subject,
      isDone: item.status === 'Done', provider: 'internal',
    });
  }

  const dates = Object.keys(groupedItems).sort();
  for (const date of dates) {
    groupedItems[date].sort((a, b) =>
      a.start.localeCompare(b.start) || a.title.localeCompare(b.title)
    );
  }
  return { groupedItems, dates, invalidDateCount, excludedUnscopedCount };
}
