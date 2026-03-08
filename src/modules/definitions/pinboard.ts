
import { ModuleDefinition } from '../types';

const pinboard: ModuleDefinition = {
  id: 'pinboard',
  name: 'Pinboard',
  description: 'Sticky notes for quick family messages and reminders.',
  icon: 'StickyNote',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/pinboard', label: 'Pinboard', component: null },
  dataKeys: ['family_os_notes'],
};

export default pinboard;
