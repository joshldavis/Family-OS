
import React, { useMemo, useState } from 'react';
import { CalendarEvent, Assignment, Status } from '../types';
import { 
  MapPin, 
  Clock, 
  Plus, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  GraduationCap, 
  RefreshCw, 
  CheckCircle2, 
  Globe,
  X
} from 'lucide-react';

interface CalendarProps {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  assignments: Assignment[];
  isGoogleLinked: boolean;
}

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

const Calendar: React.FC<CalendarProps> = ({ events, setEvents, assignments, isGoogleLinked }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Merge standard events with assignments for a unified view
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
      start: `${a.dueDate}T23:59`, // Default to end of day for sorting
      category: a.subject,
      isDone: a.status === Status.DONE,
      provider: 'internal'
    }));

    return [...eventItems, ...assignmentItems].sort((a, b) => a.start.localeCompare(b.start));
  }, [events, assignments]);

  // Group by date
  const groupedItems = useMemo(() => {
    return mergedItems.reduce((acc, item) => {
      const date = item.start.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(item);
      return acc;
    }, {} as Record<string, MergedItem[]>);
  }, [mergedItems]);

  const dates = Object.keys(groupedItems).sort();

  const handleSync = () => {
    if (!isGoogleLinked) return;
    setIsSyncing(true);
    
    // Simulate API call to Google Calendar
    setTimeout(() => {
      const googleEvents: CalendarEvent[] = [
        {
          id: `google-${Date.now()}`,
          familyId: 'fam-1',
          title: 'Work Project Sync (Google)',
          start: `${new Date().toISOString().split('T')[0]}T14:00`,
          end: `${new Date().toISOString().split('T')[0]}T15:00`,
          location: 'Google Meet',
          provider: 'google'
        }
      ];

      setEvents(prev => {
        // Remove existing google events to avoid duplicates in mock
        const filtered = prev.filter(e => e.provider !== 'google');
        return [...filtered, ...googleEvents];
      });

      setIsSyncing(false);
      setSyncComplete(true);
      setTimeout(() => setSyncComplete(false), 3000);
    }, 2000);
  };

  const handleCreateEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;
    const syncToGoogle = formData.get('syncToGoogle') === 'on';

    const newEvent: CalendarEvent = {
      id: `e-${Date.now()}`,
      familyId: 'fam-1',
      title: formData.get('title') as string,
      start: `${date}T${startTime}`,
      end: `${date}T${endTime}`,
      location: formData.get('location') as string,
      provider: syncToGoogle ? 'google' : 'internal'
    };

    setEvents(prev => [...prev, newEvent]);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Family Calendar</h1>
          <p className="text-slate-500 mt-1">One schedule to rule them all. Events and assignments combined.</p>
        </div>
        <div className="flex gap-2">
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
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            New Event
          </button>
        </div>
      </header>

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
            <p className="text-slate-500 mt-1 max-w-xs mx-auto">No events or deadlines planned yet. Start by adding items to your family workspace.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="mt-6 text-indigo-600 font-bold hover:underline"
            >
              Add an Event
            </button>
          </div>
        )}
      </div>

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
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Location</label>
                  <input 
                    name="location" 
                    className="w-full px-4 py-2 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    placeholder="e.g. West Park Field"
                  />
                </div>
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

              <div className="pt-4">
                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md">
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
