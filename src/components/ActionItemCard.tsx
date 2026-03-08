
import React from 'react';
import { ActionItem } from '../types';
import { AlertCircle, Clock, CheckCircle2, User } from 'lucide-react';

interface ActionItemCardProps {
  item: ActionItem;
  onMarkDone: (id: string) => void;
}

const urgencyConfig = {
  high:   { border: 'border-l-red-500',   bg: 'bg-red-50',   badge: 'bg-red-100 text-red-700',   label: 'Urgent' },
  medium: { border: 'border-l-amber-400', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', label: 'Soon' },
  low:    { border: 'border-l-slate-300', bg: 'bg-white',    badge: 'bg-slate-100 text-slate-600', label: 'FYI' },
};

const ActionItemCard: React.FC<ActionItemCardProps> = ({ item, onMarkDone }) => {
  const cfg = urgencyConfig[item.urgency];

  const formatDeadline = (d: string | null) => {
    if (!d) return null;
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border-l-4 border border-slate-100 ${cfg.border} ${cfg.bg} transition-all`}>
      <AlertCircle size={16} className={`flex-shrink-0 mt-0.5 ${item.urgency === 'high' ? 'text-red-500' : item.urgency === 'medium' ? 'text-amber-500' : 'text-slate-400'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-900 leading-tight">{item.title}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {item.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {item.childName && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
              <User size={10} /> {item.childName}
            </span>
          )}
          {item.deadline && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
              <Clock size={10} /> Due {formatDeadline(item.deadline)}
            </span>
          )}
          <span className="text-[10px] text-slate-400">{item.source}</span>
        </div>
      </div>

      <button
        onClick={() => onMarkDone(item.id)}
        title="Mark as done"
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-green-100 text-slate-300 hover:text-green-600 transition-colors"
      >
        <CheckCircle2 size={18} />
      </button>
    </div>
  );
};

export default ActionItemCard;
