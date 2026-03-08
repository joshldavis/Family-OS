
import { ModuleDefinition } from '../types';

const finance: ModuleDefinition = {
  id: 'finance',
  name: 'Finance',
  description: 'Track family budgets, spending, and savings goals.',
  icon: 'Wallet',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/finance', label: 'Finance', component: null },
  dataKeys: ['family_os_transactions', 'family_os_budgets', 'family_os_savings'],
};

export default finance;
