
import { ModuleDefinition } from '../types';

const dailyAgenda: ModuleDefinition = {
  id: 'daily-agenda',
  name: 'Daily Agenda',
  description: 'A printable one-pager for each kid — today\'s events, assignments, chores, lunch, plus a daily joke and fun fact.',
  icon: 'Newspaper',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/agenda', label: 'Daily Agenda', component: null },
  dataKeys: ['family_os_daily_agenda'],
};

export default dailyAgenda;
