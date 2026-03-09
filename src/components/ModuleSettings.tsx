
import React, { useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { useModules } from '../modules/ModuleContext';
import { ICON_MAP } from '../modules/iconMap';
import { ModuleDefinition, ModuleCategory } from '../modules/types';
import { getDependents } from '../modules/registry';

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; disabled?: boolean; onChange: () => void }> = ({
  checked, disabled, onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
      disabled
        ? 'cursor-not-allowed opacity-50 bg-slate-200'
        : checked
          ? 'bg-indigo-600 cursor-pointer'
          : 'bg-slate-200 cursor-pointer'
    }`}
  >
    <span
      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

// ── Category styling ──────────────────────────────────────────────────────────
const CATEGORY_ICON_BG: Record<ModuleCategory, string> = {
  core:         'bg-slate-100 text-slate-600',
  productivity: 'bg-indigo-50 text-indigo-600',
  wellness:     'bg-green-50 text-green-600',
  integrations: 'bg-blue-50 text-blue-600',
};

const CATEGORY_META: Record<ModuleCategory, { label: string; description: string }> = {
  core:         { label: 'Core',         description: 'Essential features that power the Family OS experience.' },
  productivity: { label: 'Productivity', description: 'Day-to-day tools for managing your family.' },
  integrations: { label: 'Integrations', description: 'Connect external services and AI-powered features.' },
  wellness:     { label: 'Wellness',     description: 'Health, habits, and wellbeing tracking.' },
};

// ── Module card ───────────────────────────────────────────────────────────────
interface ModuleCardProps {
  mod: ModuleDefinition;
  enabled: boolean;
  onToggle: () => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({ mod, enabled, onToggle }) => {
  const Icon = ICON_MAP[mod.icon] ?? LayoutDashboard;
  const bgClass = CATEGORY_ICON_BG[mod.category];

  return (
    <div className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-opacity ${!enabled && mod.canDisable ? 'opacity-60' : ''}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bgClass}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm">{mod.name}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{mod.description}</p>
        {mod.dependencies.length > 0 && (
          <p className="text-[10px] text-slate-400 mt-1">
            Requires: {mod.dependencies.join(', ')}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {mod.canDisable ? (
          <Toggle checked={enabled} onChange={onToggle} />
        ) : (
          <>
            <Toggle checked={true} disabled onChange={() => {}} />
            <span className="text-[10px] text-slate-400 font-medium">Always on</span>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ModuleSettings: React.FC = () => {
  const { allModules, isEnabled, toggleModule, enabledModules } = useModules();
  const [confirmDisable, setConfirmDisable] = useState<ModuleDefinition | null>(null);

  const handleToggle = (mod: ModuleDefinition) => {
    if (!mod.canDisable) return;
    if (isEnabled(mod.id)) {
      const dependents = getDependents(mod.id, enabledModules);
      if (dependents.length > 0) {
        setConfirmDisable(mod);
        return;
      }
    }
    toggleModule(mod.id);
  };

  const categories: ModuleCategory[] = ['core', 'productivity', 'integrations', 'wellness'];

  return (
    <div className="space-y-8">
      {categories.map(cat => {
        const mods = allModules.filter(m => m.category === cat);
        const meta = CATEGORY_META[cat];

        return (
          <div key={cat}>
            <div className="mb-3">
              <h4 className="font-bold text-slate-900">{meta.label}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
            </div>

            {cat === 'wellness' ? (
              <div className="bg-slate-50 border border-dashed rounded-xl p-6 text-center">
                <p className="text-sm text-slate-400 font-medium">Coming soon</p>
                <p className="text-xs text-slate-400 mt-1">
                  Health tracker, habits, and family goals are on the roadmap.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mods.map(mod => (
                  <ModuleCard
                    key={mod.id}
                    mod={mod}
                    enabled={isEnabled(mod.id)}
                    onToggle={() => handleToggle(mod)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Confirmation dialog for disabling a module with dependents */}
      {confirmDisable && (
        <div
          className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onKeyDown={e => e.key === 'Escape' && setConfirmDisable(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disable-module-heading"
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200"
          >
            <h3 id="disable-module-heading" className="font-bold text-slate-900 text-lg">Disable {confirmDisable.name}?</h3>
            <p className="text-sm text-slate-600">
              Other modules depend on <strong>{confirmDisable.name}</strong>. Disabling it will also
              disable:{' '}
              <strong>{getDependents(confirmDisable.id, enabledModules).join(', ')}</strong>.
            </p>
            <p className="text-xs text-slate-400">Your data is kept — you can re-enable at any time.</p>
            <div className="flex gap-3 pt-2">
              <button
                autoFocus
                onClick={() => setConfirmDisable(null)}
                className="flex-1 border border-slate-200 text-slate-700 font-semibold py-2 rounded-xl hover:bg-slate-50 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { toggleModule(confirmDisable.id); setConfirmDisable(null); }}
                className="flex-1 bg-red-600 text-white font-semibold py-2 rounded-xl hover:bg-red-700 text-sm transition-colors"
              >
                Disable anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleSettings;
