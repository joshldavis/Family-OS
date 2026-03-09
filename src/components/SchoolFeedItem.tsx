
import React, { useState } from 'react';
import { ClassifiedEmail, ActionItem, BehaviorUpdate, Announcement } from '../types';
import {
  CalendarDays,
  GraduationCap,
  AlertCircle,
  Star,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Union type for all feed-displayable items
export type FeedItem =
  | { kind: 'classified'; data: ClassifiedEmail }
  | { kind: 'action'; data: ActionItem }
  | { kind: 'behavior'; data: BehaviorUpdate }
  | { kind: 'announcement'; data: Announcement };

interface SchoolFeedItemProps {
  item: FeedItem;
}

const sourceBadgeColor = (source: string) => {
  if (source.toLowerCase().includes('classdojo')) return 'bg-green-100 text-green-700';
  if (source.toLowerCase().includes('google')) return 'bg-blue-100 text-blue-700';
  if (source.toLowerCase().includes('remind')) return 'bg-purple-100 text-purple-700';
  return 'bg-indigo-100 text-indigo-700';
};

const SchoolFeedItem: React.FC<SchoolFeedItemProps> = ({ item }) => {
  const [expanded, setExpanded] = useState(false);

  if (item.kind === 'behavior') {
    const { data } = item;
    const isPositive = data.type === 'positive';
    const isNegative = data.type === 'negative';
    return (
      <div className={`flex items-start gap-3 p-3 rounded-xl border ${
        isPositive ? 'bg-green-50 border-green-100' : isNegative ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'
      }`}>
        <Star size={16} className={`flex-shrink-0 mt-0.5 ${isPositive ? 'text-green-500' : isNegative ? 'text-amber-500' : 'text-slate-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{data.childName}</span>
            {data.points != null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {isPositive ? '+' : ''}{data.points} pts
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sourceBadgeColor(data.source)}`}>{data.source}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{data.details}</p>
        </div>
      </div>
    );
  }

  if (item.kind === 'announcement') {
    const { data } = item;
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl border bg-white border-slate-100">
        <Info size={16} className="flex-shrink-0 mt-0.5 text-slate-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-700 truncate">{data.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sourceBadgeColor(data.source)}`}>{data.source}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{data.summary}</p>
        </div>
      </div>
    );
  }

  if (item.kind === 'action') {
    const { data } = item;
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl border bg-amber-50 border-amber-100">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-amber-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{data.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sourceBadgeColor(data.source)}`}>{data.source}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{data.description}</p>
        </div>
      </div>
    );
  }

  // kind === 'classified'
  const { data } = item;
  const categoryIcon = {
    calendar_event: <CalendarDays size={15} className="text-indigo-500" />,
    assignment:     <GraduationCap size={15} className="text-amber-500" />,
    action_required:<AlertCircle size={15} className="text-red-500" />,
    behavior_update:<Star size={15} className="text-green-500" />,
    announcement:   <Info size={15} className="text-slate-400" />,
    irrelevant:     <Info size={15} className="text-slate-300" />,
  }[data.category];

  const summary = data.extractedData.eventTitle
    || data.extractedData.assignmentTitle
    || data.extractedData.actionDescription
    || data.extractedData.summary
    || data.subject;

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-3">
      <button
        className="w-full flex items-start gap-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex-shrink-0 mt-0.5">{categoryIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800 truncate">{summary}</span>
            {data.childName && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{data.childName}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{[data.from, data.date].filter(Boolean).join(' · ') || 'Unknown'}</p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-300 flex-shrink-0 mt-1" /> : <ChevronDown size={14} className="text-slate-300 flex-shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
          <p><span className="font-semibold">Subject:</span> {data.subject}</p>
          {data.extractedData.eventDate && <p><span className="font-semibold">Date:</span> {data.extractedData.eventDate}{data.extractedData.eventTime ? ` at ${data.extractedData.eventTime}` : ''}</p>}
          {data.extractedData.eventLocation && <p><span className="font-semibold">Location:</span> {data.extractedData.eventLocation}</p>}
          {data.extractedData.dueDate && <p><span className="font-semibold">Due:</span> {data.extractedData.dueDate}</p>}
          {data.extractedData.deadline && <p><span className="font-semibold">Deadline:</span> {data.extractedData.deadline}</p>}
          {data.extractedData.details && <p><span className="font-semibold">Details:</span> {data.extractedData.details}</p>}
          {data.rawText && <p className="text-slate-400 italic line-clamp-3">{data.rawText}</p>}
        </div>
      )}
    </div>
  );
};

export default SchoolFeedItem;
