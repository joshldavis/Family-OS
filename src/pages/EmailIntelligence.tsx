
import React, { useState, useCallback, useRef } from 'react';
import {
  Mail,
  AlertCircle,
  Star,
  Info,
  CalendarDays,
  GraduationCap,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Inbox,
  Clock,
} from 'lucide-react';
import {
  ActionItem,
  BehaviorUpdate,
  Announcement,
  ClassifiedEmail,
  EmailScanConfig,
  EmailScanResult,
  Student,
  CalendarEvent,
  Assignment,
} from '../types';
import { classifySingleEmail, FamilyContext, parseEmailSource } from '../services/emailClassifier';
import { routeClassifiedEmails } from '../services/emailRouter';
import { scanFromPastedText } from '../services/emailScanner';
import ActionItemCard from '../components/ActionItemCard';
import SchoolFeedItem, { FeedItem } from '../components/SchoolFeedItem';
import EmailScanModal from '../components/EmailScanModal';

interface EmailIntelligenceProps {
  actionItems: ActionItem[];
  behaviorUpdates: BehaviorUpdate[];
  announcements: Announcement[];
  classifiedEmails: ClassifiedEmail[];
  emailScanConfig: EmailScanConfig;
  lastScanResult: EmailScanResult | null;
  isScanning: boolean;
  students: Student[];
  events: CalendarEvent[];
  assignments: Assignment[];
  familyName: string;
  onActionItemDone: (id: string) => void;
  onScanComplete: (result: {
    eventsCreated: CalendarEvent[];
    assignmentsCreated: Assignment[];
    actionItems: ActionItem[];
    behaviorUpdates: BehaviorUpdate[];
    announcements: Announcement[];
    classifiedEmails: ClassifiedEmail[];
    scanResult: EmailScanResult;
  }) => void;
  onUpdateConfig: (config: Partial<EmailScanConfig>) => void;
}

const SCAN_DEBOUNCE_MS = 30_000;

const EmailIntelligence: React.FC<EmailIntelligenceProps> = ({
  actionItems,
  behaviorUpdates,
  announcements,
  classifiedEmails,
  lastScanResult,
  isScanning,
  students,
  events,
  assignments,
  familyName,
  onActionItemDone,
  onScanComplete,
  onUpdateConfig,
  emailScanConfig,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [localScanning, setLocalScanning] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const lastScanTimestamp = useRef<number>(0);

  const pendingActions = actionItems.filter(a => a.status === 'pending')
    .sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

  const allFeedItems: FeedItem[] = [
    ...behaviorUpdates.map(d => ({ kind: 'behavior' as const, data: d })),
    ...announcements.map(d => ({ kind: 'announcement' as const, data: d })),
    ...classifiedEmails
      .filter(e => e.category !== 'irrelevant')
      .map(d => ({ kind: 'classified' as const, data: d })),
  ].sort((a, b) => {
    const da = a.data as any;
    const db = b.data as any;
    const dateA: string = 'date' in da ? da.date : (da.createdAt ?? '');
    const dateB: string = 'date' in db ? db.date : (db.createdAt ?? '');
    return dateB.localeCompare(dateA);
  });

  const handleScan = useCallback(async (text: string, subject: string, from: string) => {
    const now = Date.now();
    if (now - lastScanTimestamp.current < SCAN_DEBOUNCE_MS) {
      setFlashMessage('Please wait a moment before scanning again.');
      setTimeout(() => setFlashMessage(null), 3000);
      return;
    }
    lastScanTimestamp.current = now;
    setLocalScanning(true);

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
      const context: FamilyContext = {
        familyName,
        children: students.map(s => ({
          name: s.name,
          grade: s.grade,
          school: s.notes?.replace('Attends ', '') || '',
        })),
        existingEvents: events,
        existingAssignments: assignments,
      };

      const cleaned = parseEmailSource(text);
      const classified = await classifySingleEmail(cleaned, subject, from, context, apiKey);

      const familyId = events[0]?.familyId || 'fam-1';
      const routerStudents = students.map(s => ({ id: s.id, name: s.name }));
      const routingResult = routeClassifiedEmails(classified, {
        events,
        assignments,
        actionItems,
        familyId,
        students: routerStudents,
      });

      const itemsCreated =
        routingResult.eventsCreated.length +
        routingResult.assignmentsCreated.length +
        routingResult.actionItems.length;

      const scanResult: EmailScanResult = {
        scannedAt: new Date().toISOString(),
        emailsFound: 1,
        itemsCreated,
        categories: classified.reduce((acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      onScanComplete({
        ...routingResult,
        classifiedEmails: classified,
        scanResult,
      });

      const msg = itemsCreated > 0
        ? `✓ Found ${itemsCreated} item${itemsCreated !== 1 ? 's' : ''} to add`
        : '✓ Email scanned — nothing new to add';
      setFlashMessage(msg);
      setTimeout(() => setFlashMessage(null), 4000);
    } finally {
      setLocalScanning(false);
    }
  }, [familyName, students, events, assignments, actionItems, onScanComplete]);

  const formatLastScan = (iso: string | null) => {
    if (!iso) return 'Never scanned';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const scanning = isScanning || localScanning;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Mail size={28} className="text-indigo-600" />
            Email Intelligence
          </h1>
          <p className="text-slate-500 mt-1">Scan school emails to auto-add events, assignments, and action items.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastScanResult && (
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={12} />
              Last scan: {formatLastScan(emailScanConfig.lastScanAt)}
              {lastScanResult.itemsCreated > 0 && (
                <span className="ml-1 text-green-600 font-semibold">· {lastScanResult.itemsCreated} items added</span>
              )}
            </div>
          )}
          <button
            onClick={() => setModalOpen(true)}
            disabled={scanning}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
          >
            {scanning
              ? <><RefreshCw size={16} className="animate-spin" /> Scanning…</>
              : <><Mail size={16} /> Scan Email</>
            }
          </button>
        </div>
      </header>

      {/* Flash message */}
      {flashMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-semibold flex items-center gap-2 animate-in fade-in duration-300">
          <CheckCircle2 size={16} />
          {flashMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Action Items + Feed */}
        <div className="lg:col-span-2 space-y-8">

          {/* Needs Your Attention */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-500" />
                Needs Your Attention
                {pendingActions.length > 0 && (
                  <span className="ml-1 text-sm bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{pendingActions.length}</span>
                )}
              </h2>
            </div>
            {pendingActions.length === 0 ? (
              <div className="bg-white border-2 border-dashed rounded-2xl p-10 text-center">
                <CheckCircle2 size={32} className="mx-auto text-green-400 mb-3" />
                <p className="text-slate-500 font-medium">All caught up! No action items right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingActions.map(item => (
                  <ActionItemCard key={item.id} item={item} onMarkDone={onActionItemDone} />
                ))}
              </div>
            )}
          </section>

          {/* Recent from School */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl flex items-center gap-2">
                <Inbox size={20} className="text-slate-400" />
                Recent from School
              </h2>
              <button
                onClick={() => setModalOpen(true)}
                disabled={scanning}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                {scanning
                  ? <><RefreshCw size={12} className="animate-spin" /> Checking…</>
                  : <><Mail size={12} /> Check Email</>
                }
              </button>
            </div>

            {allFeedItems.length === 0 ? (
              <div className="bg-white border-2 border-dashed rounded-2xl p-12 text-center">
                <Mail size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 font-medium">No school emails scanned yet.</p>
                <p className="text-slate-400 text-sm mt-1">Paste a ClassDojo notification or school email to get started.</p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 text-sm"
                >
                  <Sparkles size={15} /> Try it now
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {allFeedItems.map((item, i) => (
                  <SchoolFeedItem key={i} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Stats sidebar */}
        <div className="space-y-6">
          {/* Stats card */}
          <div className="bg-white border rounded-2xl p-6 notion-shadow">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              Intelligence Summary
            </h4>
            <div className="space-y-3">
              {[
                { label: 'Action Items', value: pendingActions.length, icon: <AlertCircle size={14} className="text-amber-500" />, color: 'text-amber-600' },
                { label: 'Behavior Updates', value: behaviorUpdates.length, icon: <Star size={14} className="text-green-500" />, color: 'text-green-600' },
                { label: 'Announcements', value: announcements.length, icon: <Info size={14} className="text-slate-400" />, color: 'text-slate-600' },
                { label: 'Events Found', value: classifiedEmails.filter(e => e.category === 'calendar_event').length, icon: <CalendarDays size={14} className="text-indigo-500" />, color: 'text-indigo-600' },
                { label: 'Assignments Found', value: classifiedEmails.filter(e => e.category === 'assignment').length, icon: <GraduationCap size={14} className="text-amber-500" />, color: 'text-amber-600' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    {icon} {label}
                  </div>
                  <span className={`font-bold text-sm ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
            <h4 className="font-bold text-indigo-900 mb-3 text-sm">How it works</h4>
            <ol className="space-y-2 text-xs text-indigo-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-indigo-500 flex-shrink-0">1.</span>
                Copy any school email, ClassDojo notification, or teacher message
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-indigo-500 flex-shrink-0">2.</span>
                Paste it here and click "Classify with Claude"
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-indigo-500 flex-shrink-0">3.</span>
                Events, assignments, and action items are automatically added to the right modules
              </li>
            </ol>
            <p className="text-xs text-indigo-500 mt-3 font-medium">Works with ClassDojo, Google Classroom, Remind, and any school email.</p>
          </div>

          {/* Last scan result */}
          {lastScanResult && (
            <div className="bg-white border rounded-2xl p-6 notion-shadow">
              <h4 className="font-bold text-slate-900 mb-3 text-sm flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                Last Scan
              </h4>
              <p className="text-xs text-slate-500 mb-3">{formatLastScan(emailScanConfig.lastScanAt)}</p>
              <div className="space-y-1">
                {Object.entries(lastScanResult.categories).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between text-xs">
                    <span className="text-slate-500 capitalize">{cat.replace('_', ' ')}</span>
                    <span className="font-bold text-slate-700">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-xs font-bold">
                <span className="text-slate-500">Items created</span>
                <span className="text-indigo-600">{lastScanResult.itemsCreated}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <EmailScanModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onScan={handleScan}
        isScanning={localScanning}
      />
    </div>
  );
};

export default EmailIntelligence;
