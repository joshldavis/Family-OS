
import { ModuleDefinition } from '../types';

const calendar: ModuleDefinition = {
  id: 'calendar',
  name: 'Calendar',
  description: 'Family calendar with event management and Google Calendar sync.',
  icon: 'Calendar',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/calendar', label: 'Calendar', component: null },
  dataKeys: ['family_os_events'],
};

export default calendar;
