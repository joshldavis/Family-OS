
import { useState, useCallback } from 'react';
import useLocalStorage from './useLocalStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationSettings {
  morningBriefing: boolean;
  assignmentDeadlines: boolean;
  choreReminders: boolean;
  mealPlanReminder: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  morningBriefing: true,
  assignmentDeadlines: true,
  choreReminders: true,
  mealPlanReminder: false,
};

const STORAGE_KEY_SETTINGS  = 'family_os_notification_settings';
const STORAGE_KEY_LAST_BRIEF = 'family_os_last_briefing_date';

// ── Brief context passed in from App ─────────────────────────────────────────

export interface BriefingContext {
  overdueChores: string[];
  dueTodayAssignments: string[];
  todayEvents: string[];
  missingMeals: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const isSupported = typeof Notification !== 'undefined';

  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'default',
  );

  const [settings, setSettings] = useLocalStorage<NotificationSettings>(
    STORAGE_KEY_SETTINGS,
    DEFAULT_SETTINGS,
  );

  const [lastBriefingDate, setLastBriefingDate] = useLocalStorage<string>(
    STORAGE_KEY_LAST_BRIEF,
    '',
  );

  // ── Request permission ────────────────────────────────────────────────────

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'default';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  // ── Core send ─────────────────────────────────────────────────────────────

  const sendNotification = useCallback(
    (title: string, body: string, options?: NotificationOptions) => {
      if (!isSupported || Notification.permission !== 'granted') return;

      const payload: NotificationOptions = {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        ...options,
      };

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then(reg => reg.showNotification(title, payload))
          .catch(() => new Notification(title, payload));
      } else {
        new Notification(title, payload);
      }
    },
    [isSupported],
  );

  // ── Overdue / deadline alerts ─────────────────────────────────────────────

  const fireOverdueAlerts = useCallback(
    (ctx: BriefingContext) => {
      if (!isSupported || Notification.permission !== 'granted') return;

      if (settings.choreReminders && ctx.overdueChores.length > 0) {
        sendNotification(
          `🏠 ${ctx.overdueChores.length} overdue chore${ctx.overdueChores.length > 1 ? 's' : ''}`,
          ctx.overdueChores.slice(0, 3).join(', ') +
            (ctx.overdueChores.length > 3 ? ` +${ctx.overdueChores.length - 3} more` : ''),
          { tag: 'overdue-chores' },
        );
      }

      if (settings.assignmentDeadlines && ctx.dueTodayAssignments.length > 0) {
        sendNotification(
          `📚 ${ctx.dueTodayAssignments.length} assignment${ctx.dueTodayAssignments.length > 1 ? 's' : ''} due today`,
          ctx.dueTodayAssignments.slice(0, 3).join(', ') +
            (ctx.dueTodayAssignments.length > 3
              ? ` +${ctx.dueTodayAssignments.length - 3} more`
              : ''),
          { tag: 'due-today' },
        );
      }
    },
    [isSupported, settings, sendNotification],
  );

  // ── Morning briefing ──────────────────────────────────────────────────────

  /**
   * Call this on app mount (after state is loaded).
   * Fires at most once per calendar day, only if it's 7am or later.
   */
  const fireMorningBriefing = useCallback(
    (ctx: BriefingContext) => {
      if (!isSupported || Notification.permission !== 'granted') return;
      if (!settings.morningBriefing) return;

      const now   = new Date();
      const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
      const hour  = now.getHours();

      // Only fire once per day, only at/after 7am
      if (lastBriefingDate === today || hour < 7) return;

      // Build briefing body
      const lines: string[] = [];

      if (ctx.todayEvents.length > 0) {
        lines.push(`📅 Today: ${ctx.todayEvents.slice(0, 2).join(', ')}${ctx.todayEvents.length > 2 ? ` +${ctx.todayEvents.length - 2} more` : ''}`);
      }
      if (ctx.dueTodayAssignments.length > 0) {
        lines.push(`📚 Due today: ${ctx.dueTodayAssignments.slice(0, 2).join(', ')}`);
      }
      if (ctx.overdueChores.length > 0) {
        lines.push(`🏠 Overdue chores: ${ctx.overdueChores.slice(0, 2).join(', ')}`);
      }
      if (ctx.missingMeals > 0) {
        lines.push(`🍽️ ${ctx.missingMeals} meal${ctx.missingMeals > 1 ? 's' : ''} not planned this week`);
      }
      if (lines.length === 0) {
        lines.push("You're all caught up! Great job 🎉");
      }

      sendNotification(
        `Good morning! Here's your Family OS briefing`,
        lines.join('\n'),
        { tag: 'morning-briefing', requireInteraction: false },
      );

      setLastBriefingDate(today);

      // Also fire individual overdue alerts after the briefing
      fireOverdueAlerts(ctx);
    },
    [isSupported, settings, lastBriefingDate, sendNotification, setLastBriefingDate, fireOverdueAlerts],
  );

  // ── Send a test notification ──────────────────────────────────────────────

  const sendTestNotification = useCallback(() => {
    sendNotification(
      '✅ Family OS Notifications Active',
      "You'll receive morning briefings, assignment reminders, and chore alerts here.",
      { tag: 'test' },
    );
  }, [sendNotification]);

  // ── Settings helpers ──────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<NotificationSettings>) =>
      setSettings(prev => ({ ...prev, ...patch })),
    [setSettings],
  );

  return {
    isSupported,
    permission,
    settings,
    updateSettings,
    requestPermission,
    sendNotification,
    fireMorningBriefing,
    fireOverdueAlerts,
    sendTestNotification,
  };
}
