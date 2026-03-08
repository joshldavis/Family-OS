
/**
 * Google Calendar Sync Service
 *
 * TODO: Implement using the Google Calendar API v3.
 * Auth: OAuth2 — scopes needed:
 *   https://www.googleapis.com/auth/calendar
 *   https://www.googleapis.com/auth/calendar.events
 * Docs: https://developers.google.com/calendar/api/v3/reference
 *
 * All functions currently return mock data or no-ops.
 */

import { CalendarEvent } from '../types';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end:   { dateTime: string; timeZone?: string };
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink: string;
}

export interface GoogleCalendarConfig {
  accessToken: string | null;
  calendarId: string;        // 'primary' or a specific calendar ID
  lastSyncAt: string | null;
  pushEnabled: boolean;      // push Family OS events → Google
  pullEnabled: boolean;      // pull Google events → Family OS
}

export const DEFAULT_GCAL_CONFIG: GoogleCalendarConfig = {
  accessToken: null,
  calendarId: 'primary',
  lastSyncAt: null,
  pushEnabled: true,
  pullEnabled: true,
};

/**
 * Initiate Google OAuth flow for Calendar.
 * TODO: Build OAuth URL with calendar scopes and redirect_uri.
 * Store the returned accessToken in config.accessToken.
 */
export async function connectGoogleCalendar(): Promise<{ accessToken: string }> {
  // TODO: const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}&...`
  // TODO: window.location.href = url;
  throw new Error('Google Calendar OAuth not yet configured. Add VITE_GOOGLE_CLIENT_ID to .env');
}

export function disconnectGoogleCalendar(): GoogleCalendarConfig {
  return DEFAULT_GCAL_CONFIG;
}

/**
 * Push a single Family OS event to Google Calendar.
 * TODO: POST https://www.googleapis.com/calendar/v3/calendars/<calendarId>/events
 *       with Authorization: Bearer <accessToken>
 */
export async function pushEvent(
  _accessToken: string,
  _calendarId: string,
  event: CalendarEvent,
): Promise<{ googleEventId: string }> {
  // TODO: Real API call — map CalendarEvent → GoogleCalendarEvent shape, POST to API
  console.log('[googleCalendar] pushEvent stub called for:', event.title);
  return { googleEventId: `mock-gcal-${event.id}` };
}

/**
 * Pull events from Google Calendar within a date range.
 * TODO: GET https://www.googleapis.com/calendar/v3/calendars/<calendarId>/events
 *       with timeMin, timeMax, singleEvents=true, orderBy=startTime
 */
export async function pullEvents(
  _accessToken: string,
  _calendarId: string,
  _timeMin: string,
  _timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  // TODO: Real API call — return events in the requested range
  return [
    {
      id: 'mock-gcal-1',
      summary: '[Mock] Work Meeting',
      start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
      end:   { dateTime: new Date(Date.now() + 86400000 + 3600000).toISOString() },
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com',
    },
  ];
}

/**
 * Full two-way sync:
 *  1. Push all Family OS events (created after lastSyncAt) to Google Calendar
 *  2. Pull Google Calendar events (modified after lastSyncAt) into Family OS
 */
export async function syncAll(
  config: GoogleCalendarConfig,
  familyEvents: CalendarEvent[],
): Promise<{
  pushed: number;
  pulled: GoogleCalendarEvent[];
  syncedAt: string;
}> {
  if (!config.accessToken) throw new Error('Not connected to Google Calendar');

  let pushed = 0;
  if (config.pushEnabled) {
    for (const event of familyEvents) {
      await pushEvent(config.accessToken, config.calendarId, event);
      pushed++;
    }
  }

  const pulled: GoogleCalendarEvent[] = config.pullEnabled
    ? await pullEvents(
        config.accessToken,
        config.calendarId,
        new Date(Date.now() - 30 * 86400000).toISOString(),
        new Date(Date.now() + 90 * 86400000).toISOString(),
      )
    : [];

  return { pushed, pulled, syncedAt: new Date().toISOString() };
}
