
import { ModuleDefinition } from '../types';

const mealPlanning: ModuleDefinition = {
  id: 'meal-planning',
  name: 'Meal Planning',
  description: 'Plan weekly meals, manage recipes, and build shopping lists.',
  icon: 'ChefHat',
  category: 'productivity',
  defaultEnabled: true,
  canDisable: true,
  dependencies: [],
  route: { path: '/meals', label: 'Meal Planning', component: null },
  dataKeys: ['family_os_recipes', 'family_os_meal_plan'],
};

export default mealPlanning;
