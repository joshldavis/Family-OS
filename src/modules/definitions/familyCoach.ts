
import { ModuleDefinition } from '../types';

const familyCoach: ModuleDefinition = {
  id: 'family-coach',
  name: 'Family Coach',
  description: 'Chat with an AI that has read your family documents — ask questions about policies, deadlines, and forms.',
  icon: 'MessagesSquare',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: ['documents'],
  route: { path: '/coach', label: 'Family Coach', component: null },
  dataKeys: ['family_os_coach_chat'],
};

export default familyCoach;
