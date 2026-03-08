
/**
 * Maps Lucide icon name strings (stored in ModuleDefinition.icon)
 * to actual Lucide components.  Import from here — never from App.tsx.
 */
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardCheck,
  Calendar as CalendarIcon,
  BarChart3,
  Settings as SettingsIcon,
  Mail,
  ScanLine,
  ChefHat,
  ShoppingCart,
  Trophy,
  StickyNote,
  FolderOpen,
  Wallet,
  ListTodo,
  Target,
  Activity,
  type LucideIcon,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  GraduationCap,
  ClipboardCheck,
  Calendar: CalendarIcon,
  Wallet,
  BarChart3,
  Settings: SettingsIcon,
  Mail,
  ScanLine,
  ChefHat,
  ShoppingCart,
  Trophy,
  StickyNote,
  FolderOpen,
  ListTodo,
  Target,
  Activity,
};
