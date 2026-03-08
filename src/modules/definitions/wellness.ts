
import { ModuleDefinition } from '../types';

const wellness: ModuleDefinition = {
  id: 'wellness',
  name: 'Wellness',
  description: 'Track family habits, shared goals, and daily health logs.',
  icon: 'Heart',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/wellness', label: 'Wellness', component: null },
  dataKeys: ['family_os_habits', 'family_os_habit_checkins', 'family_os_family_goals', 'family_os_health_log'],
};

export default wellness;
