
import { ModuleDefinition } from '../types';

const goals: ModuleDefinition = {
  id: 'goals',
  name: 'Goal Templates',
  description: 'Browse preset goal templates and track shared family progress.',
  icon: 'ListTodo',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/goals', label: 'Goal Templates', component: null },
  dataKeys: ['family_os_active_goals'],
};

export default goals;
