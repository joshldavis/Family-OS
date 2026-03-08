
import { ModuleDefinition } from '../types';

const schoolwork: ModuleDefinition = {
  id: 'schoolwork',
  name: 'Schoolwork',
  description: 'Track assignments, due dates, and academic progress for each child.',
  icon: 'GraduationCap',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/schoolwork', label: 'Schoolwork', component: null },
  dataKeys: ['family_os_students', 'family_os_assignments'],
};

export default schoolwork;
