
import { ModuleDefinition } from '../types';

const settings: ModuleDefinition = {
  id: 'settings',
  name: 'Settings',
  description: 'Configure your family workspace, integrations, and modules.',
  icon: 'Settings',
  category: 'core',
  defaultEnabled: true,
  canDisable: false,
  dependencies: [],
  route: { path: '/settings', label: 'Settings', component: null },
  dataKeys: [],
};

export default settings;
