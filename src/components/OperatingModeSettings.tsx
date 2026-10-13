import React, { useEffect, useMemo, useState } from 'react';
import { Layers3, Eye, ShieldCheck } from 'lucide-react';
import { getOperatingModeDefinition } from '../modes/registry';
import { useModeModules } from '../modes/ModeContext';
import type { OperatingModeId } from '../modes/types';

const CHOICES: OperatingModeId[] = ['general-family', 'learning-support', 'custom'];

/** A local-only preview with an explicit Apply step — no surprise changes. */
const OperatingModeSettings: React.FC = () => {
  const {
    activeMode, changeMode, previewMode,
    canChangeMode, allModules, enabledModules,
  } = useModeModules();
  const [proposedMode, setProposedMode] = useState<OperatingModeId>(activeMode);

  useEffect(() => setProposedMode(activeMode), [activeMode]);

  const preview = useMemo(() => previewMode(proposedMode), [previewMode, proposedMode]);
  const current = useMemo(() => new Set(enabledModules), [enabledModules]);
  const next = useMemo(() => new Set(preview.enabledModuleIds), [preview.enabledModuleIds]);
  const additions = allModules.filter(m => !current.has(m.id) && next.has(m.id));
  const hidden = allModules.filter(m => current.has(m.id) && !next.has(m.id));
  const unchanged = proposedMode === activeMode;

  return (
    <section className="bg-white border rounded-2xl notion-shadow overflow-hidden" aria-label="Operating mode">
      <div className="p-6 border-b bg-slate-50/50">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Layers3 size={18} className="text-indigo-500" />
          Operating Mode
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Choose how Family OS presents your family's information. Modes don't remove features or delete data.
        </p>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-3" role="group" aria-label="Choose operating mode">
          {CHOICES.map(id => {
            const definition = getOperatingModeDefinition(id);
            const selected = proposedMode === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                disabled={!canChangeMode}
                onClick={() => setProposedMode(id)}
                className={`rounded-xl p-4 border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'
                }`}
              >
                <span className="block font-semibold text-slate-900 text-sm">{definition.name}</span>
                <span className="block text-xs text-slate-600 mt-1">{definition.description}</span>
                {activeMode === id && (
                  <span className="block text-xs font-semibold text-indigo-600 mt-2">Current mode</span>
                )}
              </button>
            );
          })}
        </div>

        {canChangeMode ? (
          <div className="rounded-xl bg-slate-50 border p-4" aria-live="polite">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Eye size={16} /> Preview changes
            </p>
            {unchanged ? (
              <p className="text-sm text-slate-600 mt-2">This mode is already active.</p>
            ) : (
              <div className="text-sm text-slate-600 mt-2 space-y-2">
                <p>
                  {additions.length ? `Show: ${additions.map(m => m.name).join(', ')}.` : 'No additional modules shown.'}
                </p>
                <p>
                  {hidden.length ? `Hide from navigation: ${hidden.map(m => m.name).join(', ')}.` : 'No modules hidden.'}
                </p>
                <p className="text-xs">Hidden modules retain their existing saved information. You can switch back at any time.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-center mt-4">
              <button
                type="button"
                disabled={unchanged}
                onClick={() => changeMode(proposedMode)}
                className="bg-indigo-600 text-white font-semibold text-sm rounded-lg px-4 py-2 disabled:opacity-50 hover:bg-indigo-700"
              >
                Apply mode
              </button>
              {!unchanged && (
                <button
                  type="button"
                  onClick={() => setProposedMode(activeMode)}
                  className="border rounded-lg text-slate-700 font-semibold text-sm px-4 py-2 hover:bg-slate-50"
                >
                  Cancel preview
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Operating modes can be changed by an adult family account. Your current family data and modules are unchanged.
          </p>
        )}

        <p className="flex gap-2 items-start text-xs text-slate-500">
          <ShieldCheck size={16} className="shrink-0" />
          Agent permissions and background actions are separate from operating modes and remain off.
          This device stores your mode preference locally; cross-device mode sync is not enabled.
        </p>
      </div>
    </section>
  );
};

export default OperatingModeSettings;
