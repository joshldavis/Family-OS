
import { ModuleDefinition } from '../types';

const insights: ModuleDefinition = {
  id: 'insights',
  name: 'Insights',
  description: 'AI-powered weekly summaries and analytics across all family activities.',
  icon: 'BarChart3',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/insights', label: 'Insights', component: null },
  dataKeys: [],
};

export default insights;
