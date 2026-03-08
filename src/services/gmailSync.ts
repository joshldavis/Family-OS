
/**
 * Gmail Auto-Sync Service
 *
 * TODO: Implement via Gmail API (OAuth2) or MCP Gmail integration.
 * Auth flow: redirect to Google OAuth consent → receive access_token → store in localStorage.
 * Scopes needed: https://www.googleapis.com/auth/gmail.readonly
 *
 * All functions currently return mock data so the rest of the app can
 * be wired up and tested before real credentials are available.
 */

export interface RawEmail {
  id: string;
  subject: string;
  from: string;
  date: string;       // ISO string
  snippet: string;
  body: string;
}

export interface GmailSyncConfig {
  enabled: boolean;
  accessToken: string | null;
  intervalMinutes: number;  // 15 | 30 | 60 | 120
  lastSyncAt: string | null;
}

export const DEFAULT_GMAIL_CONFIG: GmailSyncConfig = {
  enabled: false,
  accessToken: null,
  intervalMinutes: 60,
  lastSyncAt: null,
};

/**
 * Initiate Google OAuth flow for Gmail.
 * TODO: Replace with real OAuth redirect / popup using VITE_GOOGLE_CLIENT_ID.
 */
export async function connectGmail(): Promise<{ accessToken: string }> {
  // TODO: window.location.href = buildOAuthUrl({ scope: 'gmail.readonly', ... });
  throw new Error('Gmail OAuth not yet configured. Add VITE_GOOGLE_CLIENT_ID to .env');
}

/**
 * Fetch recent school-related emails from the Gmail API.
 * TODO: GET https://gmail.googleapis.com/gmail/v1/users/me/messages
 *       with q="from:school OR from:teacher" and Authorization: Bearer <accessToken>
 */
export async function fetchEmails(
  _accessToken: string,
  _schoolDomains: string[],
): Promise<RawEmail[]> {
  // TODO: Real implementation — query Gmail API with domain filters
  return [
    {
      id: 'mock-1',
      subject: '[Mock] Science Fair Project Due Friday',
      from: 'teacher@school.example.com',
      date: new Date().toISOString(),
      snippet: 'Reminder: science fair projects are due this Friday...',
      body: 'Dear parents, this is a reminder that science fair projects are due this Friday at 8am.',
    },
    {
      id: 'mock-2',
      subject: '[Mock] Early Dismissal Wednesday',
      from: 'office@school.example.com',
      date: new Date().toISOString(),
      snippet: 'School will dismiss at 1pm this Wednesday for teacher training...',
      body: 'Please note that school will dismiss early this Wednesday at 1:00 PM.',
    },
  ];
}

/**
 * Parse raw emails for school assignments and deadlines.
 * TODO: Pass raw email bodies to AI (Gemini/Claude) for structured extraction.
 */
export async function parseSchoolEmails(emails: RawEmail[]): Promise<{
  assignments: Array<{ title: string; subject: string; dueDate: string; studentName?: string }>;
  announcements: Array<{ title: string; summary: string; date: string }>;
}> {
  // TODO: Call AI service with each email body to extract structured data
  return {
    assignments: emails
      .filter(e => e.subject.toLowerCase().includes('due') || e.subject.toLowerCase().includes('project'))
      .map(e => ({
        title: e.subject.replace('[Mock] ', ''),
        subject: 'General',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        studentName: undefined,
      })),
    announcements: emails
      .filter(e => e.subject.toLowerCase().includes('dismissal') || e.subject.toLowerCase().includes('notice'))
      .map(e => ({
        title: e.subject.replace('[Mock] ', ''),
        summary: e.snippet,
        date: e.date,
      })),
  };
}

/**
 * Parse raw emails for calendar events (field trips, meetings, etc.).
 * TODO: Use AI or regex to extract event name, date, time, location.
 */
export async function parseCalendarEmails(emails: RawEmail[]): Promise<Array<{
  title: string;
  start: string;
  end: string;
  location?: string;
}>> {
  // TODO: Extract event data from email bodies using AI
  return emails
    .filter(e => e.subject.toLowerCase().includes('dismissal') || e.subject.toLowerCase().includes('event'))
    .map(e => ({
      title: e.subject.replace('[Mock] ', ''),
      start: new Date(Date.now() + 2 * 86400000).toISOString(),
      end: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(),
      location: undefined,
    }));
}
