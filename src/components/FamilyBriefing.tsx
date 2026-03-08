
import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useFamily } from '../FamilyContext';

const ONE_HOUR_MS = 3_600_000;
const MODEL = 'claude-sonnet-4-20250514';

// ─────────────────────────────────────────────────────────────────────────────

const FamilyBriefing: React.FC = () => {
  const { state, dispatch, briefingContext } = useFamily();

  // Initialise from persisted state so text survives page navigation
  const [briefing, setBriefing]   = useState<string>(state.lastBriefingText ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const isStale = (): boolean => {
    const lastAt = state.lastBriefingGeneratedAt;
    if (!lastAt) return true;
    return Date.now() - new Date(lastAt).getTime() > ONE_HOUR_MS;
  };

  const generateBriefing = useCallback(async () => {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
    if (!apiKey) {
      setError('Add VITE_ANTHROPIC_API_KEY to your .env file to enable AI briefings.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const {
      overdueChores,
      overdueAssignments,
      dueSoonAssignments,
      upcomingEvents,
      budgetAlerts,
      choreCompletionRate,
      familyMembers,
      users,
    } = briefingContext;

    const prompt = `You are a warm, encouraging family assistant. Write a concise 4–6 sentence morning briefing for a family. Be conversational and focus on what matters most today. Do not use bullet points or markdown formatting — plain prose only.

Family context:
- Members present: ${users.map(u => u.name).join(', ')}
- Students: ${familyMembers.map(s => `${s.name} (${s.grade})`).join(', ') || 'None'}
- Chore completion rate this period: ${choreCompletionRate}%
- Overdue chores (${overdueChores.length}): ${overdueChores.map(c => `${c.title} (${c.daysOverdue}d late)`).join(', ') || 'None'}
- Overdue assignments (${overdueAssignments.length}): ${overdueAssignments.map(a => `${a.title} – ${a.subject} (${a.daysOverdue}d late)`).join(', ') || 'None'}
- Assignments due soon: ${dueSoonAssignments.map(a => `${a.title} due ${a.dueDate}`).join(', ') || 'None'}
- Upcoming events: ${upcomingEvents.slice(0, 3).map(e => `${e.title} at ${e.start}${e.location ? ` @ ${e.location}` : ''}`).join(', ') || 'None'}
- Budget alerts: ${budgetAlerts.map(b => `${b.category} at ${b.percentUsed}%`).join(', ') || 'None'}

Write the briefing now:`.trim();

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          (errBody as any)?.error?.message ?? `Anthropic API error ${response.status}`
        );
      }

      const data = await response.json();
      const text: string = (data.content?.[0]?.text ?? '').trim();
      if (!text) throw new Error('Empty response from Claude.');

      setBriefing(text);
      dispatch({
        type: 'SET_BRIEFING',
        payload: { timestamp: new Date().toISOString(), text },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate briefing.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [briefingContext, dispatch]);

  // On mount: generate if we have no text to show OR if the cache is stale.
  // We check the local `briefing` value (initialised from state) rather than
  // `state.lastBriefingText` directly, because hydration may not have run yet
  // on the very first render — so `briefing === ''` means "nothing to show".
  useEffect(() => {
    const hasCachedText = briefing.length > 0;
    if (!hasCachedText || isStale()) {
      generateBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const minsAgo = state.lastBriefingGeneratedAt
    ? Math.floor((Date.now() - new Date(state.lastBriefingGeneratedAt).getTime()) / 60000)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-indigo-900 text-white rounded-2xl p-6 notion-shadow relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-700/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-300" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">
              AI Family Briefing
            </h3>
          </div>
          <button
            onClick={generateBriefing}
            disabled={isLoading}
            title="Refresh briefing"
            className="p-1.5 rounded-lg hover:bg-indigo-800 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              size={13}
              className={`text-indigo-300 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        {/* Loading skeleton */}
        {isLoading && !briefing && (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-indigo-700/60 rounded-full w-full" />
            <div className="h-3 bg-indigo-700/60 rounded-full w-5/6" />
            <div className="h-3 bg-indigo-700/60 rounded-full w-full" />
            <div className="h-3 bg-indigo-700/60 rounded-full w-4/5" />
            <div className="h-3 bg-indigo-700/60 rounded-full w-3/4" />
          </div>
        )}

        {/* Briefing text — visible even while a background refresh is in flight */}
        {briefing && (
          <p className={`text-sm leading-relaxed text-indigo-100 transition-opacity ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
            {briefing}
          </p>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex items-start gap-2 text-indigo-300 mt-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {/* Placeholder when nothing has loaded yet (no API key, no error shown yet) */}
        {!isLoading && !briefing && !error && (
          <p className="text-sm text-indigo-400 italic">
            Generating your family briefing…
          </p>
        )}

        {/* Timestamp */}
        {briefing && minsAgo !== null && !isLoading && (
          <p className="text-[10px] text-indigo-400 mt-3">
            Generated {minsAgo < 1 ? 'just now' : `${minsAgo}m ago`}
          </p>
        )}
      </div>
    </div>
  );
};

export default FamilyBriefing;
