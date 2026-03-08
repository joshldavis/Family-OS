
import { ModuleDefinition } from '../types';

const aiScan: ModuleDefinition = {
  id: 'ai-scan',
  name: 'AI Import Scan',
  description: 'Use AI to import data from screenshots, PDFs, and text across the app.',
  icon: 'ScanLine',
  category: 'integrations',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  // No top-level route — this is a modal triggered from within other pages
  dataKeys: [],
};

export default aiScan;
