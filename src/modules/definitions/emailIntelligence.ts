
import { ModuleDefinition } from '../types';

const emailIntelligence: ModuleDefinition = {
  id: 'email-intelligence',
  name: 'Email Intelligence',
  description: 'Paste school emails to auto-extract events, assignments, and action items using AI.',
  icon: 'Mail',
  category: 'integrations',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/email', label: 'Email Intel', component: null },
  dataKeys: [
    'family_os_email_config',
    'family_os_action_items',
    'family_os_announcements',
    'family_os_behavior_updates',
    'family_os_classified_emails',
    'family_os_last_scan',
  ],
};

export default emailIntelligence;
