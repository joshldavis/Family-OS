
export type ModuleCategory = 'core' | 'productivity' | 'wellness' | 'integrations';

export interface ModuleDefinition {
  /** Unique stable ID — never change once shipped */
  id: string;
  name: string;
  description: string;
  /** Lucide icon name string (e.g. 'GraduationCap') */
  icon: string;
  category: ModuleCategory;
  /** Whether this module is on by default for new families */
  defaultEnabled: boolean;
  /** false = Dashboard / Settings — cannot be toggled off */
  canDisable: boolean;
  /** Module IDs that must be enabled for this module to work */
  dependencies: string[];
  /** If this module contributes a top-level page route */
  route?: {
    path: string;
    label: string;
    /** Component is injected in App.tsx via MODULE_COMPONENTS map */
    component: null;
  };
  /** localStorage keys owned by this module — never deleted on disable, just un-loaded */
  dataKeys: string[];
  /** Optional lifecycle hooks */
  onEnable?: () => void;
  onDisable?: () => void;
}

/** What gets persisted to localStorage */
export interface ModulePreferences {
  enabledModules: string[];
}
