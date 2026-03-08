
import { ModuleDefinition } from '../types';

const shopping: ModuleDefinition = {
  id: 'shopping',
  name: 'Shopping Lists',
  description: 'Manage grocery and household shopping lists, organised by category.',
  icon: 'ShoppingCart',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/shopping', label: 'Shopping', component: null },
  dataKeys: ['family_os_shopping'],
};

export default shopping;
