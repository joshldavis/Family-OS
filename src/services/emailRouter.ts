
/**
 * Email Router Service
 * Takes classified emails and creates typed items for the appropriate app modules.
 */

import {
  ClassifiedEmail,
  CalendarEvent,
  Assignment,
  ActionItem,
  BehaviorUpdate,
  Announcement,
  Status,
  Frequency,
} from '../types';

export interface AppState {
  events: CalendarEvent[];
  assignments: Assignment[];
  actionItems: ActionItem[];
  familyId: string;
  students: Array<{ id: string; name: string }>;
}

export interface RoutingResult {
  eventsCreated: CalendarEvent[];
  assignmentsCreated: Assignment[];
  actionItems: ActionItem[];
  behaviorUpdates: BehaviorUpdate[];
  announcements: Announcement[];
  skipped: Array<{ emailId: string; reason: string }>;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function detectSource(from: string): string {
  if (from.includes('classdojo.com')) return 'ClassDojo';
  if (from.includes('google.com') || from.includes('classroom')) return 'Google Classroom';
  if (from.includes('remind.com')) return 'Remind';
  return 'School Email';
}

function findStudentId(
  childName: string | null,
  students: Array<{ id: string; name: string }>
): string | undefined {
  if (!childName) return students[0]?.id;
  const lower = childName.toLowerCase();
  return students.find(s => s.name.toLowerCase().includes(lower))?.id;
}

export function routeClassifiedEmails(
  emails: ClassifiedEmail[],
  state: AppState
): RoutingResult {
  const result: RoutingResult = {
    eventsCreated: [],
    assignmentsCreated: [],
    actionItems: [],
    behaviorUpdates: [],
    announcements: [],
    skipped: [],
  };

  const today = new Date().toISOString().split('T')[0];

  for (const email of emails) {
    const source = detectSource(email.from);

    if (email.isDuplicate) {
      result.skipped.push({ emailId: email.id, reason: 'duplicate' });
      continue;
    }

    switch (email.category) {
      case 'calendar_event': {
        const { eventTitle, eventDate, eventTime, eventLocation } = email.extractedData;
        if (!eventTitle || !eventDate) {
          result.skipped.push({ emailId: email.id, reason: 'missing event title or date' });
          break;
        }
        const startTime = eventTime
          ? ` ${eventTime}` // keep as display string; simplest approach
          : 'T09:00';
        const start = eventDate + (eventTime ? '' : 'T09:00');
        const end = eventDate + (eventTime ? '' : 'T10:00');

        result.eventsCreated.push({
          id: `evt-email-${uid()}`,
          familyId: state.familyId,
          title: eventTitle,
          start,
          end,
          location: eventLocation,
          provider: 'email_import' as any,
          externalId: email.id,
          createdAt: new Date().toISOString(),
        });
        break;
      }

      case 'assignment': {
        const { assignmentTitle, subject, dueDate } = email.extractedData;
        if (!assignmentTitle) {
          result.skipped.push({ emailId: email.id, reason: 'missing assignment title' });
          break;
        }
        const studentId = findStudentId(email.childName, state.students);
        result.assignmentsCreated.push({
          id: `asgn-email-${uid()}`,
          studentId: studentId || state.students[0]?.id || 'unknown',
          subject: subject || 'General',
          title: assignmentTitle,
          dueDate: dueDate || today,
          estimatedMinutes: 30,
          status: Status.NOT_STARTED,
          source: 'Import',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        break;
      }

      case 'action_required': {
        const { actionDescription, deadline, urgency } = email.extractedData;
        result.actionItems.push({
          id: `action-${uid()}`,
          source,
          title: email.subject || 'Action Required',
          description: actionDescription || email.rawText,
          childName: email.childName,
          deadline: deadline || null,
          urgency: urgency || 'medium',
          status: 'pending',
          emailId: email.id,
          createdAt: new Date().toISOString(),
        });
        break;
      }

      case 'behavior_update': {
        const { behaviorType, details, points } = email.extractedData;
        if (!email.childName) {
          result.skipped.push({ emailId: email.id, reason: 'no child identified for behavior update' });
          break;
        }
        result.behaviorUpdates.push({
          id: `beh-${uid()}`,
          childName: email.childName,
          type: behaviorType || 'neutral',
          details: details || email.rawText,
          points: points ?? null,
          source,
          date: email.date || today,
        });
        break;
      }

      case 'announcement': {
        const { summary } = email.extractedData;
        result.announcements.push({
          id: `ann-${uid()}`,
          title: email.subject || 'School Announcement',
          summary: summary || email.rawText,
          source,
          childName: email.childName,
          date: email.date || today,
          isRead: false,
        });
        break;
      }

      case 'irrelevant':
      default:
        result.skipped.push({ emailId: email.id, reason: 'irrelevant or unrecognized category' });
        break;
    }
  }

  return result;
}
