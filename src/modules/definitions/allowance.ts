
import { ModuleDefinition } from '../types';

const allowance: ModuleDefinition = {
  id: 'allowance',
  name: 'Allowance & Rewards',
  description: 'Track points earned from chores and let kids redeem rewards.',
  icon: 'Trophy',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: ['chores'],
  route: { path: '/allowance', label: 'Allowance', component: null },
  dataKeys: ['family_os_rewards', 'family_os_reward_txns'],
};

export default allowance;
