
import { ModuleDefinition } from '../types';

const chores: ModuleDefinition = {
  id: 'chores',
  name: 'Chores',
  description: 'Assign and track household chores with recurring schedules.',
  icon: 'ClipboardCheck',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/chores', label: 'Chores', component: null },
  dataKeys: ['family_os_chores'],
};

export default chores;
