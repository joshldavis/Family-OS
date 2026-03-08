
import { ModuleDefinition } from '../types';

const documents: ModuleDefinition = {
  id: 'documents',
  name: 'Document Vault',
  description: 'Store and organise important family documents with expiry tracking.',
  icon: 'FolderOpen',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/documents', label: 'Documents', component: null },
  dataKeys: ['family_os_documents'],
};

export default documents;
