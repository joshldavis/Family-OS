
import React, { useState, useMemo } from 'react';
import { Recipe, MealPlanEntry, MealType, ShoppingList, ShoppingItem, ShoppingCategory } from '../types';
import {
  ChefHat,
  Plus,
  X,
  Clock,
  Users,
  Sparkles,
  ShoppingCart,
  BookOpen,
  Tag,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';

interface MealPlanningProps {
  recipes: Recipe[];
  mealPlan: MealPlanEntry[];
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  setMealPlan: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  setShoppingLists: React.Dispatch<React.SetStateAction<ShoppingList[]>>;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
};
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Get Monday of given week offset (0 = this week, 1 = next, -1 = last)
function getWeekDates(offset: number): string[] {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  d.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + i);
    return nd.toISOString().split('T')[0];
  });
}

function formatShortDate(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const MealPlanning: React.FC<MealPlanningProps> = ({
  recipes, mealPlan, setRecipes, setMealPlan, setShoppingLists,
}) => {
  const [activeTab, setActiveTab] = useState<'week' | 'library'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [pickerOpen, setPickerOpen] = useState<{ date: string; mealType: MealType } | null>(null);
  const [addRecipeOpen, setAddRecipeOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Recipe form state
  const [recipeForm, setRecipeForm] = useState({
    name: '', description: '', prepTime: '', cookTime: '', servings: '',
    tags: '', instructions: '',
    ingredients: [{ name: '', amount: '', unit: '' }],
  });

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const getMealEntry = (date: string, mealType: MealType) =>
    mealPlan.find(e => e.date === date && e.mealType === mealType);

  const getRecipe = (id: string | null) => id ? recipes.find(r => r.id === id) : null;

  const assignMeal = (recipeId: string | null, customMeal: string | null) => {
    if (!pickerOpen) return;
    const { date, mealType } = pickerOpen;
    const existing = getMealEntry(date, mealType);
    if (existing) {
      setMealPlan(prev => prev.map(e =>
        e.id === existing.id ? { ...e, recipeId, customMeal } : e
      ));
    } else {
      setMealPlan(prev => [...prev, {
        id: `mp-${Date.now()}`,
        familyId: 'fam-1',
        date,
        mealType,
        recipeId,
        customMeal,
      }]);
    }
    setPickerOpen(null);
    setPickerSearch('');
  };

  const clearMeal = (date: string, mealType: MealType) => {
    setMealPlan(prev => prev.filter(e => !(e.date === date && e.mealType === mealType)));
  };

  const generateShoppingList = () => {
    const weekEntries = mealPlan.filter(e => weekDates.includes(e.date));
    const items: ShoppingItem[] = [];
    weekEntries.forEach(entry => {
      const recipe = getRecipe(entry.recipeId);
      if (recipe) {
        recipe.ingredients.forEach(ing => {
          items.push({
            id: `si-gen-${Date.now()}-${Math.random()}`,
            name: ing.name,
            amount: `${ing.amount} ${ing.unit}`.trim(),
            category: 'Other',
            checked: false,
            recipeSource: recipe.name,
          });
        });
      }
    });

    if (items.length === 0) {
      alert('No recipes with ingredients found for this week.');
      return;
    }

    const newList: ShoppingList = {
      id: `sl-${Date.now()}`,
      familyId: 'fam-1',
      name: `Week of ${formatShortDate(weekDates[0])}`,
      createdAt: new Date().toISOString().split('T')[0],
      items,
    };
    setShoppingLists(prev => [newList, ...prev]);
    alert(`Shopping list created with ${items.length} items! Head to Shopping to view it.`);
  };

  const handleAddRecipe = () => {
    const newRecipe: Recipe = {
      id: `r-${Date.now()}`,
      familyId: 'fam-1',
      name: recipeForm.name,
      description: recipeForm.description,
      prepTime: parseInt(recipeForm.prepTime) || 0,
      cookTime: parseInt(recipeForm.cookTime) || 0,
      servings: parseInt(recipeForm.servings) || 4,
      tags: recipeForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      ingredients: recipeForm.ingredients.filter(i => i.name),
      instructions: recipeForm.instructions,
    };
    setRecipes(prev => [...prev, newRecipe]);
    setAddRecipeOpen(false);
    setRecipeForm({
      name: '', description: '', prepTime: '', cookTime: '', servings: '',
      tags: '', instructions: '',
      ingredients: [{ name: '', amount: '', unit: '' }],
    });
  };

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    r.tags.some(t => t.toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Meal Planning</h1>
          <p className="text-slate-500 mt-1">Plan the week's meals and auto-generate your grocery list.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateShoppingList}
            className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-sm text-sm"
          >
            <ShoppingCart size={18} />
            Generate Shopping List
          </button>
          <button
            onClick={() => setAddRecipeOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            Add Recipe
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'week', label: 'This Week', icon: ChefHat },
          { id: 'library', label: 'Recipe Library', icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors relative ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
          </button>
        ))}
      </div>

      {/* ── Week View ── */}
      {activeTab === 'week' && (
        <div>
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 font-semibold"
            >
              <ChevronLeft size={16} /> Previous Week
            </button>
            <span className="text-sm font-bold text-slate-700">
              {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : `Week of ${formatShortDate(weekDates[0])}`}
              &nbsp;·&nbsp;{formatShortDate(weekDates[0])} – {formatShortDate(weekDates[6])}
            </span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 font-semibold"
            >
              Next Week <ChevronRight size={16} />
            </button>
          </div>

          {/* 7-col grid */}
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="grid grid-cols-7 gap-2 min-w-[700px]">
              {/* Day headers */}
              {weekDates.map((date, i) => (
                <div key={date} className="text-center mb-2">
                  <p className={`text-xs font-bold uppercase tracking-widest ${date === todayStr ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {DAY_NAMES[i]}
                  </p>
                  <p className={`text-lg font-bold ${date === todayStr ? 'text-indigo-600' : 'text-slate-800'}`}>
                    {date.split('-')[2]}
                  </p>
                  {date === todayStr && <div className="w-1 h-1 rounded-full bg-indigo-500 mx-auto mt-0.5" />}
                </div>
              ))}

              {/* Meal rows */}
              {MEAL_TYPES.map(mealType => (
                <React.Fragment key={mealType}>
                  {weekDates.map(date => {
                    const entry = getMealEntry(date, mealType);
                    const recipe = entry ? getRecipe(entry.recipeId) : null;
                    const label = recipe?.name ?? entry?.customMeal ?? null;

                    return (
                      <div key={date + mealType} className="min-h-[80px]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                          {MEAL_LABELS[mealType].split(' ')[1]}
                        </p>
                        {label ? (
                          <div
                            className={`group relative rounded-xl p-2 text-xs font-semibold cursor-pointer transition-all border ${
                              mealType === 'breakfast' ? 'bg-amber-50 border-amber-100 text-amber-800 hover:border-amber-300' :
                              mealType === 'lunch' ? 'bg-sky-50 border-sky-100 text-sky-800 hover:border-sky-300' :
                              'bg-indigo-50 border-indigo-100 text-indigo-800 hover:border-indigo-300'
                            }`}
                            onClick={() => setPickerOpen({ date, mealType })}
                          >
                            {label}
                            <button
                              onClick={e => { e.stopPropagation(); clearMeal(date, mealType); }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPickerOpen({ date, mealType })}
                            className="w-full h-[60px] rounded-xl border-2 border-dashed border-slate-200 text-slate-300 hover:border-indigo-300 hover:text-indigo-400 transition-all flex items-center justify-center"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recipe Library ── */}
      {activeTab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map(recipe => (
            <div key={recipe.id} className="bg-white border rounded-2xl p-6 notion-shadow hover:border-indigo-200 transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <ChefHat size={20} />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock size={12} />
                  {recipe.prepTime + recipe.cookTime}m
                  <Users size={12} className="ml-1" />
                  {recipe.servings}
                </div>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{recipe.name}</h3>
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">{recipe.description}</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {recipe.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Tag size={8} /> {tag}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {recipe.ingredients.length} ingredients
              </p>
            </div>
          ))}
          <button
            onClick={() => setAddRecipeOpen(true)}
            className="border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all group min-h-[200px]"
          >
            <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold">Add New Recipe</span>
          </button>
        </div>
      )}

      {/* ── Meal Picker Modal ── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Pick a Meal</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {MEAL_LABELS[pickerOpen.mealType]} · {formatShortDate(pickerOpen.date)}
                  </p>
                </div>
                <button onClick={() => { setPickerOpen(null); setPickerSearch(''); }} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Search recipes or type a custom meal..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                className="mt-4 w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="p-4 max-h-72 overflow-y-auto space-y-2">
              {pickerSearch && (
                <button
                  onClick={() => assignMeal(null, pickerSearch)}
                  className="w-full text-left px-4 py-3 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors"
                >
                  + Add "{pickerSearch}" as custom meal
                </button>
              )}
              {filteredRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => assignMeal(recipe.id, null)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                >
                  <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ChefHat size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{recipe.name}</p>
                    <p className="text-xs text-slate-400">
                      {recipe.prepTime + recipe.cookTime}m · {recipe.servings} servings
                    </p>
                  </div>
                </button>
              ))}
              {filteredRecipes.length === 0 && !pickerSearch && (
                <p className="text-center text-slate-400 text-sm py-6">Type to search or add a custom meal.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Recipe Modal ── */}
      {addRecipeOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
              <h2 className="text-lg font-bold text-slate-900">New Recipe</h2>
              <button onClick={() => setAddRecipeOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Recipe Name *</label>
                <input
                  autoFocus
                  value={recipeForm.name}
                  onChange={e => setRecipeForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Chicken Stir Fry"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Description</label>
                <input
                  value={recipeForm.description}
                  onChange={e => setRecipeForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Quick description..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Prep (min)</label>
                  <input type="number" value={recipeForm.prepTime} onChange={e => setRecipeForm(f => ({ ...f, prepTime: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cook (min)</label>
                  <input type="number" value={recipeForm.cookTime} onChange={e => setRecipeForm(f => ({ ...f, cookTime: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Servings</label>
                  <input type="number" value={recipeForm.servings} onChange={e => setRecipeForm(f => ({ ...f, servings: e.target.value }))} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Tags (comma-separated)</label>
                <input
                  value={recipeForm.tags}
                  onChange={e => setRecipeForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Italian, Quick, Family Favorite"
                />
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ingredients</label>
                  <button
                    onClick={() => setRecipeForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: '', unit: '' }] }))}
                    className="text-xs text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {recipeForm.ingredients.map((ing, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={ing.name}
                        onChange={e => setRecipeForm(f => { const ings = [...f.ingredients]; ings[i] = { ...ings[i], name: e.target.value }; return { ...f, ingredients: ings }; })}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Ingredient"
                      />
                      <input
                        value={ing.amount}
                        onChange={e => setRecipeForm(f => { const ings = [...f.ingredients]; ings[i] = { ...ings[i], amount: e.target.value }; return { ...f, ingredients: ings }; })}
                        className="w-16 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Amt"
                      />
                      <input
                        value={ing.unit}
                        onChange={e => setRecipeForm(f => { const ings = [...f.ingredients]; ings[i] = { ...ings[i], unit: e.target.value }; return { ...f, ingredients: ings }; })}
                        className="w-16 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Unit"
                      />
                      {recipeForm.ingredients.length > 1 && (
                        <button
                          onClick={() => setRecipeForm(f => ({ ...f, ingredients: f.ingredients.filter((_, j) => j !== i) }))}
                          className="text-slate-300 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Instructions</label>
                <textarea
                  value={recipeForm.instructions}
                  onChange={e => setRecipeForm(f => ({ ...f, instructions: e.target.value }))}
                  rows={3}
                  className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Step-by-step instructions..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddRecipeOpen(false)} className="flex-1 border rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button
                  onClick={handleAddRecipe}
                  disabled={!recipeForm.name}
                  className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Save Recipe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlanning;
