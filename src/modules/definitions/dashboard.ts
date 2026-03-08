
import { ModuleDefinition } from '../types';

const dashboard: ModuleDefinition = {
  id: 'dashboard',
  name: 'Dashboard',
  description: 'The main overview of your family\'s day — always on.',
  icon: 'LayoutDashboard',
  category: 'core',
  defaultEnabled: true,
  canDisable: false,
  dependencies: [],
  route: { path: '/', label: 'Dashboard', component: null },
  dataKeys: [],
};

export default dashboard;
