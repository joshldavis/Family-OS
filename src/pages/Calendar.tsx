
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { CalendarEvent, Assignment, Status } from '../types';
import {
  MapPin,
  Clock,
  Plus,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  GraduationCap,
  RefreshCw,
  CheckCircle2,
  Globe,
  X,
  LayoutGrid,
  List,
  MessageSquare,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useFamily } from '../FamilyContext';

interface MergedItem {
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

// ── Month Grid ────────────────────────────────────────────────────────────────

const DOT_COLORS: Record<string, string> = {
  event_internal: 'bg-indigo-500',
  event_google:   'bg-blue-500',
  assignment:     'bg-amber-400',
};

interface MonthGridProps {
  viewMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  groupedItems: Record<string, MergedItem[]>;
  selectedDay: string | null;
  onSelectDay: (d: string | null) => void;
}

const MonthGrid: React.FC<MonthGridProps> = ({
  viewMonth, onPrev, onNext, groupedItems, selectedDay, onSelectDay,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build a flat array of 42 cell objects (6 rows × 7 cols)
  const cells = useMemo(() => {
    const result: { dateStr: string; inMonth: boolean }[] = [];
    // Leading days from prev month
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      result.push({ dateStr: d.toISOString().split('T')[0], inMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      result.push({ dateStr: date.toISOString().split('T')[0], inMonth: true });
    }
    // Trailing days from next month
    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      result.push({ dateStr: date.toISOString().split('T')[0], inMonth: false });
    }
    return result;
  }, [year, month, firstDayOfMonth, daysInMonth, daysInPrevMonth]);

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white border rounded-2xl notion-shadow overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/50">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeft size={18} className="text-slate-500" />
        </button>
        <h2 className="font-bold text-slate-900 text-lg">{monthLabel}</h2>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronRight size={18} className="text-slate-500" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 divide-x divide-y border-r border-b">
        {cells.map(({ dateStr, inMonth }) => {
          const items   = groupedItems[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const isSel   = dateStr === selectedDay;
          const dayNum  = parseInt(dateStr.split('-')[2], 10);
          const visible = items.slice(0, 3);
          const overflow = items.length - visible.length;

          return (
            <div
              key={dateStr}
              onClick={() => onSelectDay(isSel ? null : dateStr)}
              className={`min-h-[80px] p-1.5 cursor-pointer transition-colors ${
                !inMonth       ? 'bg-slate-50/60'        : 'bg-white hover:bg-indigo-50/30'
              } ${isSel ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
            >
              {/* Day number */}
              <div className="flex justify-end mb-1">
                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-indigo-600 text-white'
                    : !inMonth
                      ? 'text-slate-300'
                      : 'text-slate-700'
                }`}>
                  {dayNum}
                </span>
              </div>
              {/* Event chips */}
              <div className="space-y-0.5">
                {visible.map(item => (
                  <div
                    key={item.id}
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded truncate text-white ${
                      item.type === 'assignment'
                        ? 'bg-amber-400'
                        : item.provider === 'google'
                          ? 'bg-blue-500'
                          : 'bg-indigo-500'
                    }`}
                  >
                    {item.title}
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="text-[10px] text-slate-400 font-semibold pl-1">
                    +{overflow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-3 border-t bg-slate-50/50">
        {[
          { color: 'bg-indigo-500', label: 'Event' },
          { color: 'bg-blue-500',   label: 'Google' },
          { color: 'bg-amber-400',  label: 'Assignment' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span className="text-xs text-slate-500 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Selected Day Detail Panel ─────────────────────────────────────────────────

interface DayDetailProps {
  dateStr: string;
  items: MergedItem[];
  onClose: () => void;
}

const DayDetail: React.FC<DayDetailProps> = ({ dateStr, items, onClose }) => {
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  return (
    <div className="bg-white border rounded-2xl notion-shadow overflow-hidden animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between px-5 py-4 border-b bg-indigo-50/40">
        <h3 className="font-bold text-slate-900">{label}</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 transition-colors">
          <X size={16} className="text-slate-500" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Nothing scheduled</p>
        ) : items.map(item => (
          <div
            key={item.id}
            className={`flex gap-3 p-3 rounded-xl border ${
              item.type === 'assignment'
                ? 'border-l-4 border-l-amber-400 bg-amber-50/30'
                : item.provider === 'google'
                  ? 'border-l-4 border-l-blue-500 bg-blue-50/30'
                  : 'border-l-4 border-l-indigo-400 bg-indigo-50/20'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">{item.title}</p>
              <div className="flex flex-wrap gap-3 mt-1">
                {item.type === 'event' && (
                  <span className="text-xs text-slate-500">
                    {new Date(item.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {item.end && ` – ${new Date(item.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                  </span>
                )}
                {item.location && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={11} /> {item.location}
                  </span>
                )}
                {item.category && (
                  <span className="text-xs text-indigo-600 font-semibold">{item.category}</span>
                )}
              </div>
            </div>
            {item.type === 'assignment' && (
              <GraduationCap size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            {item.provider === 'google' && item.type === 'event' && (
              <Globe size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

type CalendarView = 'month' | 'agenda';

const Calendar: React.FC = () => {
  const { state, dispatch } = useFamily();
  const events = state.events;
  const assignments = state.assignments;
  const isGoogleLinked = state.isGoogleLinked;

  const [view, setView] = useState<CalendarView>('month');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventFormError, setEventFormError] = useState<string | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chat parser ────────────────────────────────────────────────────────
  const [chatParserOpen, setChatParserOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatParsing, setChatParsing] = useState(false);
  const [chatResults, setChatResults] = useState<Array<{
    title: string; date: string; time?: string; location?: string; selected: boolean;
  }> | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  const mergedItems = useMemo(() => {
    const eventItems: MergedItem[] = events.map(e => ({
      id: e.id,
      type: 'event',
      title: e.title,
      start: e.start,
      end: e.end,
      location: e.location,
      provider: e.provider || 'internal'
    }));

    const assignmentItems: MergedItem[] = assignments.map(a => ({
      id: a.id,
      type: 'assignment',
      title: a.title,
      start: `${a.dueDate}T23:59`,
      category: a.subject,
      isDone: a.status === Status.DONE,
      provider: 'internal'
    }));

    return [...eventItems, ...assignmentItems].sort((a, b) => a.start.localeCompare(b.start));
  }, [events, assignments]);

  const groupedItems = useMemo(() => {
    return mergedItems.reduce((acc, item) => {
      const date = item.start.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    }, {} as Record<string, MergedItem[]>);
  }, [mergedItems]);

  const dates = Object.keys(groupedItems).sort();

  const parseChatText = async () => {
    if (!chatText.trim()) return;
    setChatParsing(true);
    setChatError(null);
    setChatResults(null);
    try {
      const apiKey = import.meta.env.VITE_API_KEY || '';
      if (!apiKey) throw new Error('No API key');
      const ai = new GoogleGenAI({ apiKey });
      const todayStr = new Date().toISOString().split('T')[0];

      const prompt = `Extract ALL events, dates, and appointments from this message/chat thread.
Today's date: ${todayStr}

Message:
${chatText}

Return a JSON array of events. Each event:
{"title":"Event Name","date":"YYYY-MM-DD","time":"HH:MM (optional)","location":"Location (optional)"}

If only a weekday is mentioned (e.g. "Friday"), calculate the next occurrence from today.
Only return the JSON array. No explanation.`;

      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const parsed = JSON.parse(result.text || '[]') as Array<{
        title: string; date: string; time?: string; location?: string;
      }>;

      if (!Array.isArray(parsed) || parsed.length === 0) {
        setChatError('No events found in that text. Try pasting a message with dates or times.');
        return;
      }

      setChatResults(parsed.map(e => ({ ...e, selected: true })));
    } catch {
      setChatError('Could not parse the message. Check your Gemini API key.');
    } finally {
      setChatParsing(false);
    }
  };

  const addChatEvents = () => {
    if (!chatResults) return;
    const now = new Date().toISOString();
    chatResults.filter(r => r.selected).forEach(e => {
      const start = e.time ? `${e.date}T${e.time}` : `${e.date}T09:00`;
      const [h, m] = (e.time || '09:00').split(':').map(Number);
      const endHour = String(Math.min(h + 1, 23)).padStart(2, '0');
      const end = e.time ? `${e.date}T${endHour}:${String(m).padStart(2, '0')}` : `${e.date}T10:00`;
      dispatch({
        type: 'ADD_EVENT',
        payload: {
          id: `chat-${Date.now()}-${Math.random()}`,
          familyId: 'fam-1',
          title: e.title,
          start,
          end,
          location: e.location,
          createdAt: now,
        },
      });
    });
    setChatParserOpen(false);
    setChatText('');
    setChatResults(null);
  };

  const handleSync = () => {
    if (!isGoogleLinked) return;
    setIsSyncing(true);
    syncTimeoutRef.current = setTimeout(() => {
      const now = new Date().toISOString();
      const googleEvent: CalendarEvent = {
        id: `google-${Date.now()}`,
        familyId: 'fam-1',
        title: 'Work Project Sync (Google)',
        start: `${new Date().toISOString().split('T')[0]}T14:00`,
        end: `${new Date().toISOString().split('T')[0]}T15:00`,
        location: 'Google Meet',
        provider: 'google',
        createdAt: now,
      };
      const filtered = events.filter(e => e.provider !== 'google');
      dispatch({ type: 'HYDRATE', payload: { events: [...filtered, googleEvent] } });
      setIsSyncing(false);
      setSyncComplete(true);
      syncTimeoutRef.current = setTimeout(() => setSyncComplete(false), 3000);
    }, 2000);
  };

  const handleCreateEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;
    const syncToGoogle = formData.get('syncToGoogle') === 'on';
    const now = new Date().toISOString();

    if (endTime && startTime && endTime <= startTime) {
      setEventFormError('End time must be after start time.');
      return;
    }
    setEventFormError(null);

    const newEvent: CalendarEvent = {
      id: `e-${Date.now()}`,
      familyId: 'fam-1',
      title: formData.get('title') as string,
      start: `${date}T${startTime}`,
      end: `${date}T${endTime}`,
      location: formData.get('location') as string,
      provider: syncToGoogle ? 'google' : 'internal',
      createdAt: now,
    };

    dispatch({ type: 'ADD_EVENT', payload: newEvent });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Family Calendar</h1>
          <p className="text-slate-500 mt-1">One schedule to rule them all. Events and assignments combined.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setView('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                view === 'month' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid size={14} /> Month
            </button>
            <button
              onClick={() => setView('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                view === 'agenda' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List size={14} /> Agenda
            </button>
          </div>

          {isGoogleLinked && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all shadow-sm text-sm ${
                syncComplete
                  ? 'bg-green-50 text-green-600 border border-green-100'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isSyncing ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : syncComplete ? (
                <CheckCircle2 size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              {isSyncing ? 'Syncing...' : syncComplete ? 'Synced' : 'Sync Google'}
            </button>
          )}
          <button
            onClick={() => setChatParserOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-semibold hover:bg-slate-50 transition-colors shadow-sm text-sm"
          >
            <MessageSquare size={18} />
            Paste Chat
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            New Event
          </button>
        </div>
      </header>

      {/* Month view */}
      {view === 'month' && (
        <div className="space-y-4">
          <MonthGrid
            viewMonth={viewMonth}
            onPrev={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNext={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            groupedItems={groupedItems}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay && (
            <DayDetail
              dateStr={selectedDay}
              items={groupedItems[selectedDay] ?? []}
              onClose={() => setSelectedDay(null)}
            />
          )}
        </div>
      )}

      {/* Agenda view */}
      {view === 'agenda' && (
        <div className="max-w-3xl space-y-12">
          {dates.length > 0 ? dates.map(date => (
            <div key={date} className="relative pl-8 border-l-2 border-slate-100 last:border-l-0 pb-8">
              <div className="absolute -left-[9px] top-0 w-4 h-4 bg-indigo-600 rounded-full ring-4 ring-white"></div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
              </div>
              <div className="space-y-4">
                {groupedItems[date].map(item => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`bg-white border p-5 rounded-2xl notion-shadow flex gap-6 transition-all group ${
                      item.type === 'assignment'
                        ? 'border-l-4 border-l-amber-400 hover:border-amber-200'
                        : item.provider === 'google'
                          ? 'border-l-4 border-l-blue-500 hover:border-blue-200'
                          : 'hover:border-indigo-200'
                    }`}
                  >
                    <div className="w-20 pt-1">
                      {item.type === 'event' ? (
                        <>
                          <p className={`text-sm font-bold ${item.provider === 'google' ? 'text-blue-600' : 'text-indigo-600'}`}>
                            {new Date(item.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </p>
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Start</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-amber-600 uppercase">Due</p>
                          <GraduationCap size={20} className="text-amber-400 mt-1" />
                        </>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className={`font-bold text-slate-900 text-lg ${item.isDone ? 'text-slate-400 line-through' : ''}`}>
                          {item.title}
                        </h4>
                        <div className="flex gap-1">
                          {item.type === 'assignment' && (
                            <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Assignment</span>
                          )}
                          {item.provider === 'google' && (
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                              <Globe size={10} /> Google
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {item.type === 'event' && item.end && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Clock size={16} className="text-slate-400" />
                            <span>Duration: {((new Date(item.end).getTime() - new Date(item.start).getTime()) / 60000)} mins</span>
                          </div>
                        )}
                        {item.location && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <MapPin size={16} className="text-slate-400" />
                            <span>{item.location}</span>
                          </div>
                        )}
                        {item.category && (
                          <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <span className="font-medium text-slate-400">Subject:</span>
                            <span className="text-indigo-600 font-semibold">{item.category}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <ChevronRight className={`text-slate-300 group-hover:translate-x-1 transition-all ${
                        item.type === 'assignment'
                          ? 'group-hover:text-amber-400'
                          : item.provider === 'google'
                            ? 'group-hover:text-blue-500'
                            : 'group-hover:text-indigo-400'
                      }`} size={24} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <div className="bg-white border-2 border-dashed rounded-3xl p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarIcon size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Empty Schedule</h3>
              <p className="text-slate-500 mt-1 max-w-xs mx-auto">No events or deadlines planned yet.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-6 text-indigo-600 font-bold hover:underline"
              >
                Add an Event
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-50/30">
              <h2 className="text-xl font-bold text-slate-900">New Family Event</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Event Title</label>
                <input
                  name="title"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="e.g. Soccer Match"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Location</label>
                <input
                  name="location"
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="e.g. West Park Field"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Date</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Start Time</label>
                  <input
                    type="time"
                    name="startTime"
                    required
                    defaultValue="09:00"
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">End Time</label>
                  <input
                    type="time"
                    name="endTime"
                    required
                    defaultValue="10:00"
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {isGoogleLinked && (
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="syncToGoogle"
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Globe size={14} className="text-blue-500" />
                      <span className="text-sm font-semibold text-slate-700">Post to Google Calendar</span>
                    </div>
                  </label>
                </div>
              )}

              {eventFormError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
                  {eventFormError}
                </p>
              )}

              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Chat Parser Modal ── */}
      {chatParserOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare size={20} className="text-indigo-500" />
                  Paste Chat / Message
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Paste any iMessage, WhatsApp, or email thread and AI will extract events.</p>
              </div>
              <button onClick={() => { setChatParserOpen(false); setChatText(''); setChatResults(null); setChatError(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!chatResults ? (
                <>
                  <textarea
                    autoFocus
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    placeholder="Paste your group chat, iMessage thread, or any message containing dates and events..."
                    rows={8}
                    className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  {chatError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{chatError}</p>
                  )}
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
                    <Sparkles size={14} className="text-indigo-500 flex-shrink-0" />
                    Works with iMessage, WhatsApp, GroupMe, Remind, email — anything with dates and times.
                  </div>
                  <button
                    onClick={parseChatText}
                    disabled={!chatText.trim() || chatParsing}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {chatParsing ? <><Loader2 size={18} className="animate-spin" /> Extracting events…</> : <><Sparkles size={18} /> Extract Events with AI</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <p className="text-sm font-semibold text-slate-900">Found {chatResults.length} event{chatResults.length !== 1 ? 's' : ''}. Select which to add:</p>
                  </div>
                  <div className="space-y-2">
                    {chatResults.map((result, i) => (
                      <label
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${result.selected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}
                      >
                        <input
                          type="checkbox"
                          checked={result.selected}
                          onChange={() => setChatResults(prev => prev!.map((r, j) => j === i ? { ...r, selected: !r.selected } : r))}
                          className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{result.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {result.date}
                            {result.time && ` · ${result.time}`}
                            {result.location && ` · 📍 ${result.location}`}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { setChatResults(null); setChatError(null); }}
                      className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={addChatEvents}
                      disabled={!chatResults.some(r => r.selected)}
                      className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      Add {chatResults.filter(r => r.selected).length} Event{chatResults.filter(r => r.selected).length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
