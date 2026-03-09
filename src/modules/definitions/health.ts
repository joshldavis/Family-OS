import { ModuleDefinition } from '../types';

const health: ModuleDefinition = {
  id: 'health',
  name: 'Family Health',
  description: 'Track appointments, medications, and vitals for every family member.',
  icon: 'HeartPulse',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/health', label: 'Family Health', component: null },
  dataKeys: ['family_os_medications', 'family_os_appointments', 'family_os_vitals'],
};

export default health;
